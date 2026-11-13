import { describe, expect, test } from "bun:test";
import {
  type HomeChatOutput,
  homeChatContext,
  homeChatProblems,
  rulesOutput,
  toReply,
} from "../convex/homeChat";
import { FIND_TOOLS, findEvents, findGroupPosts, RECALL_FIND } from "../convex/homeChatFind";
import { recallFound, runHomeTool } from "../convex/homeChatTools";
import { hasContact } from "../convex/lib/chatText";
import { groupAsked } from "../convex/lib/homeChatRules";
import { type Found, factsIn, type ToolViewer } from "../convex/lib/homeChatThings";
import { NO_PLAN } from "../convex/lib/movePlan";
import { hasProtected } from "../convex/lib/protectedText";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

/* ---------- World: V is the viewer ----------
 * - F is V's friend; S is a stranger who posts and hosts; B has blocked V.
 * - gClimb is a public Group; gPrivate is private (V isn't in it); gHidden is
 *   private and hidden; gMine is hidden and V is a member.
 */

const NOW = Date.now();
const DAY = 86_400_000;
const MISSION = "neighborhoods:mission";

const user = (_id: string): Row => ({
  _id,
  kind: "person",
  name: `${_id}name Lastname`,
  firstName: `${_id}name`,
  username: _id.toLowerCase(),
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
  joinedAt: 0,
});
const group = (_id: string, name: string, over = {}): Row => ({
  _id,
  name,
  slug: _id.toLowerCase(),
  cover: "/seed/g.jpg",
  privacy: "public",
  visible: true,
  description: "Neighbors who climb together",
  category: "Sports",
  rules: [],
  tags: ["climbing"],
  createdBy: "S",
  createdAt: NOW - 30 * DAY,
  externalMemberCount: 0,
  memberCount: 120,
  lastActivityAt: NOW - DAY,
  neighborhoodId: MISSION,
  ...over,
});
let n = 0;
const post = (_id: string, groupId: string, authorId: string, text: string, over = {}): Row => ({
  _id,
  authorId,
  groupId,
  text,
  media: [],
  attachments: [],
  privacy: "public",
  createdAt: NOW - DAY + ++n,
  reactionCount: 0,
  commentCount: 3,
  shareCount: 0,
  ...over,
});
const event = (_id: string, title: string, over = {}): Row => ({
  _id,
  hostId: "S",
  privacy: "public",
  title,
  cover: "/seed/e.jpg",
  description: "Meet at the gym",
  category: "Fitness",
  startAt: NOW + 2 * DAY,
  online: false,
  venue: "Mission Cliffs",
  city: "San Francisco",
  externalGoingCount: 4,
  externalInterestedCount: 0,
  createdAt: NOW - DAY,
  neighborhoodId: MISSION,
  ...over,
});

function world(): Record<string, Row[]> {
  return {
    users: ["V", "F", "S", "B"].map(user),
    friendships: [
      { _id: "fr1", userId: "V", friendId: "F", createdAt: 0 },
      { _id: "fr2", userId: "F", friendId: "V", createdAt: 0 },
    ],
    blocks: [{ _id: "bl1", userId: "B", blockedId: "V", createdAt: 0 }],
    neighborhoods: [
      {
        _id: MISSION,
        slug: "mission",
        name: "Mission",
        center: { lat: 37.76, lng: -122.42 },
        bbox: { west: 0, south: 0, east: 0, north: 0 },
        polygon: [],
        citations: { first: { kind: "external", externalSourceId: "x1" }, rest: [] },
      },
    ],
    groups: [
      group("gClimb", "SF Climbing Crew"),
      group("gPrivate", "Valencia Climbers", { privacy: "private" }),
      group("gHidden", "Secret Climbing Club", { privacy: "private", visible: false }),
      group("gMine", "Our House", { privacy: "private", visible: false, tags: [] }),
    ],
    groupMembers: [{ _id: "gm1", groupId: "gMine", userId: "V", role: "member", joinedAt: 0 }],
    posts: [
      post(
        "pHike",
        "gClimb",
        "S",
        "Anyone up for a hike up Mt Davidson Saturday? Email s@example.com or call 415-555-1234, I'm at 123 Valencia St.",
      ),
      post("pProtected", "gClimb", "S", "Board games night, Muslim women only"),
      post("pBlocked", "gClimb", "B", "A hike from someone who blocked you"),
      post("pOnlyMe", "gClimb", "S", "A hike only I can see", { privacy: "only_me" }),
      post("pGone", "gClimb", "Deleted", "A hike from a deleted account"),
      post("pPhoto", "gClimb", "S", "  "),
      post("pOld", "gClimb", "S", "An old hike", { createdAt: NOW - 30 * DAY }),
      post("pPrivate", "gPrivate", "S", "A hike for members"),
      post("pHidden", "gHidden", "S", "A secret hike"),
      post("pMine", "gMine", "F", "House hike on Sunday"),
    ],
    events: [
      event("eClimb", "Bouldering night", { groupId: "gClimb" }),
      event("eClimb2", "Top rope clinic", { groupId: "gClimb", startAt: NOW + 3 * DAY }),
      event("eMembers", "Members-only send", {
        groupId: "gClimb",
        privacy: "group",
        startAt: NOW + 4 * DAY,
      }),
      event("eHiddenHost", "Secret dinner", { groupId: "gHidden", startAt: NOW + 5 * DAY }),
    ],
    eventResponses: [],
  } as Record<string, Row[]>;
}

const V = user("V") as unknown as ToolViewer;
const keys = (found: Found[]) => found.map((f) => f.key);
const run = (name: string, args: Record<string, unknown>, tables = world()) =>
  runHomeTool(fakeCtx(tables), "V" as never, name, args);

/** Nothing Muse reads or the chat shows carries contact details, protected traits or an address. */
function expectClean(value: unknown) {
  const text = JSON.stringify(value);
  expect(hasContact(text)).toBe(false);
  // Redacted text keeps its marker; nothing else about a protected trait remains.
  expect(hasProtected(text.replaceAll("[removed]", ""))).toBe(false);
  expect(text).not.toContain("Muslim");
  expect(text).not.toContain("123 Valencia");
}

describe("search_group_posts", () => {
  test("is one of Muse's tools", () => {
    const t = FIND_TOOLS.find((x) => x.name === "search_group_posts");
    expect(t?.args.kind).toBe("object");
    expect(t?.description).toContain("not an Event");
  });

  test("only posts the viewer may read: no private, hidden, blocked, only-me or deleted authors", async () => {
    const found = await findGroupPosts(fakeCtx(world()), V);
    expect(keys(found).sort()).toEqual(["post:pHike", "post:pMine", "post:pProtected"]);
    // Newest first.
    expect(keys(found)[0]).toBe("post:pMine");
  });

  test("a private or hidden Group's posts read the same as a Group that doesn't exist", async () => {
    const errors = await Promise.all(
      ["gPrivate", "gHidden", "gprivate", "nope"].map((group) =>
        run("search_group_posts", { group }).then(
          () => "no error",
          (e: Error) => e.message.replace(/"[^"]*"/, '""'),
        ),
      ),
    );
    expect(new Set(errors).size).toBe(1);
    expect(errors[0]).toContain("no Group");
  });

  test("a member reads their private Group's posts", async () => {
    const out = await run("search_group_posts", { group: "gMine" });
    expect(keys(out.found)).toContain("post:pMine");
  });

  test("one Group by id, slug or key; a query; and how far back", async () => {
    for (const group of ["gClimb", "gclimb", "group:gClimb"]) {
      const out = await run("search_group_posts", { group, query: "hikes" });
      expect(keys(out.found).filter((k) => k.startsWith("post:"))).toEqual(["post:pHike"]);
    }
    const older = await run("search_group_posts", { group: "gClimb", withinDays: 60 });
    expect(keys(older.found)).toContain("post:pOld");
    const recent = await run("search_group_posts", { group: "gClimb" });
    expect(keys(recent.found)).not.toContain("post:pOld");
  });

  test("each post is a card with its Group, excerpt, author, when, comments and link", async () => {
    const out = await run("search_group_posts", { group: "gClimb", query: "hike" });
    const hike = out.found.find((f) => f.key === "post:pHike");
    expect(hike?.facts).toMatchObject({
      kind: "post",
      author: "Sname",
      comments: 3,
      group: { kind: "group", key: "group:gClimb", name: "SF Climbing Crew" },
    });
    expect(hike?.card).toMatchObject({
      kind: "post",
      title: "Sname's post in SF Climbing Crew",
      href: "/s/posts/pHike",
    });
    expect(hike?.card?.lines[1]).toMatch(/^Posted .+ · 3 comments$/);
    expect(hike?.card?.lines[2]).toBe("A Group post, not an Event");
    expect(hike?.card?.actions).toBeUndefined();
    expect(hike?.link).toEqual({
      label: "Sname's post in SF Climbing Crew",
      href: "/s/posts/pHike",
    });
    // Citing the post cites its Group too, and the Group can be cited and shown.
    expect(hike?.sources).toEqual([{ label: "SF Climbing Crew", href: "/groups/gclimb" }]);
    expect(keys(out.found)).toContain("group:gClimb");
    // What Muse reads is what the reply may cite.
    const read = [...factsIn(out.result).keys()];
    for (const k of read) expect(keys(out.found)).toContain(k);
    expect(JSON.stringify(out.result)).toContain("not Events");
  });

  test("protected traits, contact details and addresses never reach Muse or the card", async () => {
    const out = await run("search_group_posts", {});
    expectClean(out);
    const prot = out.found.find((f) => f.key === "post:pProtected");
    expect(prot?.facts).toMatchObject({ excerpt: expect.stringContaining("[removed]") });
  });

  test("where someone is right now, or lives, never reaches Muse or the card", async () => {
    const tables = world();
    tables.posts.push(
      post(
        "pHere",
        "gClimb",
        "S",
        "Climbing later! I'm at the southwest corner of 18th and Dolores right now.",
      ),
      post(
        "pNear",
        "gClimb",
        "S",
        "Join the hike Saturday!\nCurrently near Dolores Park with snacks.",
      ),
      post("pHome", "gClimb", "S", "We live on Valencia near 20th, come by for board games."),
      post("pSaint", "gClimb", "S", "I'm at St. Mary's Park right now."),
      post("pPark", "gClimb", "S", "Bring chalk!\nI'm at Bernal Heights Park"),
      post("pHood", "gClimb", "S", "I live in the Mission near 20th and Valencia."),
      post("pIn", "gClimb", "S", "I'm in! Meet at Mission Cliffs Saturday at 7."),
    );
    const out = await run("search_group_posts", { group: "gClimb" }, tables);
    const text = JSON.stringify(out);
    for (const where of [
      "18th and Dolores",
      "Dolores Park",
      "Valencia near 20th",
      "Mary's Park",
      "Bernal Heights",
      "20th and Valencia",
    ])
      expect(text).not.toContain(where);
    // The plans themselves stay, with where to meet.
    expect(text).toContain("Join the hike Saturday");
    expect(text).toContain("Climbing later!");
    expect(text).toContain("Bring chalk!");
    expect(text).toContain("I'm in! Meet at Mission Cliffs Saturday at 7.");
  });

  test("arguments are checked", async () => {
    await expect(run("search_group_posts", { withinDays: "soon" })).rejects.toThrow(
      /Wrong arguments/,
    );
    await expect(run("search_group_posts", { withinDays: -1 })).rejects.toThrow(/withinDays/);
    await expect(run("search_group_posts", { neighborhood: "atlantis" })).rejects.toThrow(
      /no neighborhood/,
    );
    await expect(run("search_group_posts", { group: 3 })).rejects.toThrow(/Wrong arguments/);
    const hood = await run("search_group_posts", { neighborhood: "mission" });
    expect(keys(hood.found)).toContain("post:pHike");
  });

  test("reads are bounded however many Groups and posts there are", async () => {
    const tables = world();
    for (let g = 0; g < 60; g++) {
      tables.groups.push(group(`gMany${g}`, `Hiking ${g}`, { lastActivityAt: NOW - g }));
      for (let p = 0; p < 60; p++)
        tables.posts.push(post(`pMany${g}_${p}`, `gMany${g}`, "S", `Post ${p}`));
    }
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const out = await findGroupPosts(fakeCtx(tables, stats), V, { query: "hike" });
    expect(out.length).toBeLessThanOrEqual(8);
    // 12 Groups of 25 posts, plus the Groups scanned and the viewer's own reads.
    expect(stats.docs).toBeLessThan(12 * 25 + 400);
    expect(stats.ranges).toBeLessThan(30);
  });

  test("a post is recalled only while the viewer may still read it", async () => {
    const w = world();
    expect((await RECALL_FIND.post(fakeCtx(w), V, "pHike"))?.key).toBe("post:pHike");
    for (const id of ["pPrivate", "pHidden", "pBlocked", "pOnlyMe", "nope"])
      expect(await RECALL_FIND.post(fakeCtx(w), V, id)).toBeNull();
    const recalled = await recallFound(fakeCtx(w), "V" as never, ["post:pHike", "post:pHidden"]);
    expect(keys(recalled).sort()).toEqual(["group:gClimb", "post:pHike"]);
  });
});

describe("Events name their Group", () => {
  test("an Event in a Group says who hosts it, linked and cited", async () => {
    const found = await findEvents(fakeCtx(world()), V);
    const e = found.find((f) => f.key === "event:eClimb");
    expect(e?.facts).toMatchObject({
      hostedBy: { kind: "group", key: "group:gClimb", name: "SF Climbing Crew" },
    });
    expect(e?.card?.host).toEqual({ label: "SF Climbing Crew", href: "/groups/gclimb" });
    expect(e?.sources).toEqual([{ label: "SF Climbing Crew", href: "/groups/gclimb" }]);
  });

  test("a hidden Group the viewer isn't in stays unnamed; a members-only Event stays hidden", async () => {
    const found = await findEvents(fakeCtx(world()), V);
    const secret = found.find((f) => f.key === "event:eHiddenHost");
    expect(secret).toBeDefined();
    expect(secret?.facts.hostedBy).toBeUndefined();
    expect(secret?.card?.host).toBeUndefined();
    expect(JSON.stringify(secret)).not.toContain("Secret Climbing Club");
    expect(keys(found)).not.toContain("event:eMembers");
  });

  test("search_events hands the hosting Group on, so the reply can cite and show it", async () => {
    const out = await run("search_events", {});
    expect(keys(out.found)).toContain("group:gClimb");
  });
});

describe("get_details on a Group", () => {
  test("its next Events and newest posts the viewer can see", async () => {
    const out = await run("get_details", { key: "group:gClimb" });
    const facts = out.result as Record<string, unknown>;
    const upcoming = facts.upcomingEvents as { key: string; hostedBy?: unknown }[];
    const recent = facts.recentPosts as { key: string }[];
    expect(upcoming.map((e) => e.key)).toEqual(["event:eClimb", "event:eClimb2"]);
    // Shown as its own card, an Event still says who hosts it.
    expect(upcoming[0]?.hostedBy).toMatchObject({ key: "group:gClimb" });
    expect(out.found.find((f) => f.key === "event:eClimb")?.card?.host?.label).toBe(
      "SF Climbing Crew",
    );
    // The newest three, however old.
    expect(recent.map((p) => p.key)).toEqual(["post:pProtected", "post:pHike", "post:pOld"]);
    expect(facts.postsNote).toBeUndefined();
    // Each can be cited and shown.
    for (const k of [...upcoming, ...recent].map((x) => x.key))
      expect(keys(out.found)).toContain(k);
    expectClean(out);
  });

  test("at most three of each", async () => {
    const tables = world();
    for (let i = 0; i < 5; i++) {
      tables.events.push(
        event(`eMore${i}`, `Session ${i}`, { groupId: "gClimb", startAt: NOW + (6 + i) * DAY }),
      );
      tables.posts.push(post(`pMore${i}`, "gClimb", "S", `Beta for route ${i}`));
    }
    const facts = (await run("get_details", { key: "group:gClimb" }, tables)).result as Record<
      string,
      unknown[]
    >;
    expect(facts.upcomingEvents).toHaveLength(3);
    expect(facts.recentPosts).toHaveLength(3);
  });

  test("a private Group's posts stay with its members", async () => {
    const out = await run("get_details", { key: "group:gPrivate" });
    const facts = out.result as Record<string, unknown>;
    expect(facts.recentPosts).toEqual([]);
    expect(facts.postsNote).toBe("Its posts are for members only.");
    expect(JSON.stringify(out)).not.toContain("A hike for members");
  });
});

/* ---------- The chat ---------- */

const contextFor = (message: string, tables = world()) =>
  homeChatContext(fakeCtx(tables), {
    viewerId: "V" as never,
    message,
    context: { stage: "city" },
    recent: [],
  });

describe("what's happening in a Group", () => {
  const hoods = [{ slug: "mission", name: "Mission" }];

  test("groupAsked finds the words naming the Group", () => {
    expect(groupAsked("What's happening in the climbing Group?", hoods)).toBe("climbing");
    expect(groupAsked("whats going on in SF Climbing Crew", hoods)).toBe("SF Climbing Crew");
    expect(groupAsked("Any news from the climbing club?", hoods)).toBe("climbing");
    expect(groupAsked("anything planned in Our House group", hoods)).toBe("House");
    // A neighborhood is a neighborhood, unless they say Group.
    expect(groupAsked("What's happening in the Mission?", hoods)).toBeNull();
    expect(groupAsked("What's happening in the Mission group?", hoods)).toBe("Mission");
    expect(groupAsked("rooms under $2,000", hoods)).toBeNull();
    expect(groupAsked("show me events this weekend", hoods)).toBeNull();
  });

  test("Muse is given the Group with its Events and posts, all of which it may cite", async () => {
    const c = await contextFor("What's happening in the climbing Group?");
    expect(c.input.group?.key).toBe("group:gClimb");
    const read = [...factsIn(c.input.group as never).keys()];
    expect(read).toEqual(
      expect.arrayContaining(["group:gClimb", "event:eClimb", "post:pHike", "post:pProtected"]),
    );
    for (const k of read) expect(c.found.map((f) => f.key)).toContain(k);
    expectClean(c.input.group);
  });

  test("a Group the viewer can't see isn't found by name", async () => {
    const c = await contextFor("What's happening in the Secret Climbing Club?");
    expect(c.input.group?.key).not.toBe("group:gHidden");
    expect(JSON.stringify(c.input)).not.toContain("A secret hike");
  });

  test("other messages look nothing up", async () => {
    expect((await contextFor("rooms under $2,000")).input.group).toBeNull();
    expect((await contextFor("What's happening in the Mission?")).input.group).toBeNull();
  });

  test("with AI off, the rules list its upcoming Events and recent posts, cited and shown", async () => {
    const c = await contextFor("What's happening in the climbing Group?");
    const out = rulesOutput(c.input);
    expect(out.command).toEqual({ kind: "none" });
    expect(out.text).toContain("SF Climbing Crew");
    expect(out.text).toContain("Bouldering night");
    expect(out.text).toContain("informal plans rather than Events");
    expect(out.sourceIds).toEqual(["group:gClimb"]);
    expect(out.show).toEqual([
      "event:eClimb",
      "event:eClimb2",
      "post:pProtected",
      "post:pHike",
      "post:pOld",
    ]);
    const reply = toReply(out, "rules", c.input, new Map(c.found.map((f) => [f.key, f])));
    expect(reply.cards.map((x) => x.kind)).toEqual(["event", "event", "post", "post", "post"]);
    // Every post it mentions links to the post, and the Group is cited.
    const hrefs = reply.sources.map((s) => s.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/groups/gclimb", "/s/posts/pHike", "/s/posts/pProtected"]),
    );
    expectClean(reply);
  });

  test("with nothing to show, the rules say so", async () => {
    const c = await contextFor("What's happening in the Valencia Climbers group?");
    expect(c.input.group?.key).toBe("group:gPrivate");
    const out = rulesOutput(c.input);
    expect(out.text).toContain("its posts are for members");
    expect(out.show).toEqual([]);
  });

  test("Muse's answer cites every post it talks about", async () => {
    const c = await contextFor("What's happening in the climbing Group?");
    const answer = (o: Partial<HomeChatOutput>): HomeChatOutput => ({
      text: "Sname posted about a hike up Mt Davidson on Saturday. It's a Group post, not an Event.",
      command: { kind: "none" },
      sourceIds: [],
      show: [],
      actions: [],
      plan: NO_PLAN,
      ...o,
    });
    expect(homeChatProblems(answer({}), c.input)).toContain(
      "sourceIds: cite the key of every Group post you mention",
    );
    expect(homeChatProblems(answer({ show: ["post:pHike"] }), c.input)).toEqual([]);
    // Each author it names cites their post: one cited isn't enough for two described.
    const tables = world();
    tables.users.push(user("A"));
    tables.posts.push(post("pGames", "gClimb", "A", "Board games at the gym after climbing"));
    const two = await contextFor("What's happening in the climbing Group?", tables);
    const both = "Sname posted about a hike, and Aname posted about board games.";
    expect(homeChatProblems(answer({ text: both, show: ["post:pHike"] }), two.input)).toContain(
      "sourceIds: cite the key of every Group post you mention",
    );
    expect(
      homeChatProblems(answer({ text: both, show: ["post:pHike", "post:pGames"] }), two.input),
    ).toEqual([]);
    // Two posts by one author need two citations too.
    const same = "Sname posted about a hike Saturday and posted about board games Sunday.";
    expect(homeChatProblems(answer({ text: same, show: ["post:pHike"] }), c.input)).toContain(
      "sourceIds: cite the key of every Group post you mention",
    );
    expect(
      homeChatProblems(answer({ text: same, show: ["post:pHike", "post:pProtected"] }), c.input),
    ).toEqual([]);
    // Naming the Group cites it too.
    expect(
      homeChatProblems(
        answer({ text: "SF Climbing Crew has a post about a hike.", show: ["post:pHike"] }),
        c.input,
      ),
    ).toContain("sourceIds: cite group:gClimb, which the reply names");
  });
});

import { describe, expect, test } from "bun:test";
import type { QueryCtx } from "../convex/_generated/server";
import { webUrl } from "../convex/citations";
import {
  assertCitable,
  type CitedSource,
  cite,
  isPublicSource,
  resolveCitations,
  resolveSources,
  snippet,
  sourcesOf,
  tryCite,
} from "../convex/lib/citations";
import { loadAudience } from "../convex/lib/posts";
import type { Source } from "../convex/validators";
import { chipLabel, sourceMeta, timeAgo } from "../src/lib/citations";

/* ---------- A tiny in-memory stand-in for ctx.db (get + indexed equality queries) ---------- */

type Row = { _id: string } & Record<string, unknown>;

function fakeCtx(tables: Record<string, Row[]>): QueryCtx {
  const byId = new Map<string, Row>();
  for (const rows of Object.values(tables)) for (const r of rows) byId.set(r._id, r);
  const db = {
    get: async (id: string) => byId.get(id) ?? null,
    query: (table: string) => {
      let rows = tables[table] ?? [];
      const chain = {
        withIndex: (_index: string, range?: (q: unknown) => unknown) => {
          const conds: [string, unknown][] = [];
          const q = {
            eq: (field: string, value: unknown) => {
              conds.push([field, value]);
              return q;
            },
          };
          range?.(q);
          rows = rows.filter((r) => conds.every(([f, val]) => r[f] === val));
          return chain;
        },
        order: () => chain,
        collect: async () => rows,
        first: async () => rows[0] ?? null,
        unique: async () => rows[0] ?? null,
        take: async (n: number) => rows.slice(0, n),
      };
      return chain;
    },
  };
  return { db } as unknown as QueryCtx;
}

const id = (s: string) => s as never;
const NOW = Date.UTC(2026, 10, 12);
const DAY = 86_400_000;

const user = (_id: string) => ({
  _id,
  name: `User ${_id}`,
  firstName: _id,
  username: _id,
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
});
const group = (_id: string, privacy: "public" | "private", visible: boolean) => ({
  _id,
  name: `Group ${_id}`,
  slug: _id,
  cover: `/seed/${_id}.jpg`,
  privacy,
  visible,
  description: `About ${_id}`,
  memberCount: 120,
  lastActivityAt: NOW - DAY,
});
const post = (_id: string, authorId: string, privacy: string, extra: Partial<Row> = {}) => ({
  _id,
  authorId,
  privacy,
  text: `Text of ${_id}`,
  media: [],
  attachments: [],
  createdAt: NOW - 14 * DAY,
  commentCount: 15,
  reactionCount: 3,
  ...extra,
});
const comment = (_id: string, postId: string, authorId: string) => ({
  _id,
  postId,
  authorId,
  text: `Comment ${_id}`,
  createdAt: NOW - DAY,
  replyCount: 2,
  reactionCount: 0,
});
const event = (_id: string, hostId: string, privacy: string) => ({
  _id,
  hostId,
  privacy,
  title: `Event ${_id}`,
  cover: "/seed/e.jpg",
  description: "Run Club, Golden Gate Park, 8am Saturday",
  startAt: NOW + 2 * DAY,
  online: false,
  venue: "Golden Gate Park",
  externalGoingCount: 10,
});

// V is the viewer. F is V's friend, S a stranger, B has blocked V.
const world = {
  users: ["V", "F", "S", "B"].map(user),
  friendships: [
    { _id: "fr1", userId: "V", friendId: "F", createdAt: 0 },
    { _id: "fr2", userId: "F", friendId: "V", createdAt: 0 },
  ],
  blocks: [{ _id: "bl1", userId: "B", blockedId: "V", createdAt: 0 }],
  groups: [
    group("gPublic", "public", true),
    group("gPrivate", "private", true),
    group("gHidden", "private", false),
    group("gMine", "private", false),
  ],
  groupMembers: [{ _id: "gm1", groupId: "gMine", userId: "V", role: "member", joinedAt: 0 }],
  posts: [
    post("pPublic", "S", "public"),
    post("pFriendOfViewer", "F", "friends"),
    post("pStrangerFriends", "S", "friends"),
    post("pOnlyMe", "F", "only_me"),
    post("pPrivateGroup", "S", "public", { groupId: "gPrivate" }),
    post("pPublicGroup", "S", "public", { groupId: "gPublic" }),
    post("pMyGroup", "S", "public", { groupId: "gMine" }),
    post("pBlocker", "B", "public"),
    // On F's timeline, by S: F's "who can see posts on your profile" decides.
    post("pWall", "S", "public", { timelineUserId: "F" }),
    // In the Discussion tab of a private event V wasn't invited to.
    post("pPrivateEventTalk", "S", "public", { eventId: "ePrivate" }),
    // Public posts that share or attach something restricted.
    post("pSharesFriendsPost", "S", "public", { sharedPostId: "pFriendOfViewer" }),
    post("pSharesPublicPost", "S", "public", { sharedPostId: "pPublic" }),
    post("pSharesOnlyMe", "S", "public", { sharedPostId: "pOnlyMe" }),
    post("pSharesDeleted", "S", "public", { sharedPostId: "pDeleted" }),
    post("pAttachesPrivateEvent", "S", "public", {
      attachments: [{ kind: "event", eventId: "ePrivate" }],
    }),
  ],
  comments: [
    comment("cPublic", "pPublic", "S"),
    comment("cPrivateGroup", "pPrivateGroup", "S"),
    comment("cByBlocker", "pPublic", "B"),
    { ...comment("cReplyToBlocker", "pPublic", "S"), parentId: "cByBlocker" },
    comment("cOnSharesOnlyMe", "pSharesOnlyMe", "S"),
    comment("cNoAuthor", "pPublic", "Deleted"),
  ],
  events: [
    event("ePublic", "S", "public"),
    event("ePrivate", "S", "private"),
    event("eInvited", "S", "private"),
    { ...event("eMyGroup", "S", "group"), groupId: "gMine" },
    { ...event("eOtherGroup", "S", "group"), groupId: "gPrivate" },
    event("eNoHost", "Deleted", "public"),
  ],
  eventResponses: [
    { _id: "er1", eventId: "ePublic", userId: "F", status: "going", createdAt: 0 },
    { _id: "er2", eventId: "eInvited", userId: "V", status: "invited", createdAt: 0 },
  ],
  listings: [
    {
      _id: "lS",
      sellerId: "S",
      title: "Desk lamp",
      description: "Warm light",
      photos: [],
      price: 20,
      status: "active",
      location: { city: "San Francisco", neighborhood: "Mission" },
      createdAt: NOW - 3 * DAY,
    },
    {
      _id: "lB",
      sellerId: "B",
      title: "Couch",
      description: "Blue",
      photos: [],
      price: 100,
      status: "active",
      location: { city: "San Francisco" },
      createdAt: NOW,
    },
    {
      _id: "lGoneSeller",
      sellerId: "Deleted",
      title: "Chair",
      description: "Wood",
      photos: [],
      price: 5,
      status: "active",
      location: { city: "San Francisco" },
      createdAt: NOW,
    },
  ],
  externalSources: [
    {
      _id: "x1",
      url: "https://data.sfgov.org/streetlights",
      title: "Streetlights",
      publisher: "DataSF",
      snippet: "Streetlight locations",
      fetchedAt: NOW - DAY / 2,
    },
  ],
  userSettings: [],
};

const P = (postId: string): Source => ({ kind: "post", postId: id(postId) });
const C = (commentId: string): Source => ({ kind: "comment", commentId: id(commentId) });
const E = (eventId: string): Source => ({ kind: "event", eventId: id(eventId) });
const L = (listingId: string): Source => ({ kind: "listing", listingId: id(listingId) });
const G = (groupId: string): Source => ({ kind: "group", groupId: id(groupId) });
const X = (externalSourceId: string): Source => ({
  kind: "external",
  externalSourceId: id(externalSourceId),
});

async function visibleKeys(sources: Source[]) {
  const ctx = fakeCtx(world);
  const a = await loadAudience(ctx, id("V"));
  return (await resolveSources(ctx, sources, a)).map((s) => s.key);
}

describe("per-viewer filtering", () => {
  test("posts follow audience, Group and block rules", async () => {
    expect(
      await visibleKeys([
        P("pPublic"),
        P("pFriendOfViewer"),
        P("pStrangerFriends"),
        P("pOnlyMe"),
        P("pPrivateGroup"),
        P("pPublicGroup"),
        P("pMyGroup"),
        P("pBlocker"),
        P("pPrivateEventTalk"),
        P("pDeleted"),
      ]),
    ).toEqual(["post:pPublic", "post:pFriendOfViewer", "post:pPublicGroup", "post:pMyGroup"]);
  });

  test("posts are hidden when what they share or attach is hidden", async () => {
    expect(
      await visibleKeys([
        P("pSharesFriendsPost"),
        P("pSharesOnlyMe"),
        P("pSharesDeleted"),
        P("pAttachesPrivateEvent"),
        C("cOnSharesOnlyMe"),
      ]),
    ).toEqual(["post:pSharesFriendsPost", "post:pSharesDeleted"]);
    // A result citing a public post whose shared original later turned only-me is withheld.
    const ctx = fakeCtx(world);
    const a = await loadAudience(ctx, id("V"));
    expect(await resolveCitations(ctx, cite([P("pPublic"), P("pSharesOnlyMe")]), a)).toBeNull();
  });

  test("wall posts follow the timeline owner's setting", async () => {
    // V is F's friend, so F's default setting lets V see posts on F's timeline.
    expect(await visibleKeys([P("pWall")])).toEqual(["post:pWall"]);
    const onlyMe = {
      ...world,
      userSettings: [
        {
          _id: "us1",
          userId: "F",
          prefs: { "who-can-see-profile-posts": "Only me" },
          updatedAt: 0,
        },
      ],
    };
    const ctx = fakeCtx(onlyMe);
    const a = await loadAudience(ctx, id("V"));
    expect(await resolveSources(ctx, [P("pWall")], a)).toEqual([]);
  });

  test("comments inherit their post's visibility and drop blocked threads", async () => {
    expect(
      await visibleKeys([C("cPublic"), C("cPrivateGroup"), C("cByBlocker"), C("cReplyToBlocker")]),
    ).toEqual(["comment:cPublic"]);
  });

  test("events, listings, Groups and external sources", async () => {
    expect(
      await visibleKeys([
        E("ePublic"),
        E("ePrivate"),
        E("eInvited"),
        E("eMyGroup"),
        E("eOtherGroup"),
        E("eNoHost"),
        L("lS"),
        L("lB"),
        L("lGoneSeller"),
        G("gPublic"),
        G("gPrivate"),
        G("gHidden"),
        G("gMine"),
        X("x1"),
        X("xDeleted"),
      ]),
    ).toEqual([
      "event:ePublic",
      "event:eInvited",
      "event:eMyGroup",
      "listing:lS",
      "group:gPublic",
      "group:gPrivate",
      "group:gMine",
      "external:x1",
    ]);
  });

  test("resolveCitations drops deleted sources but withholds results with a hidden one", async () => {
    const ctx = fakeCtx(world);
    const a = await loadAudience(ctx, id("V"));
    const shown = await resolveCitations(ctx, cite([P("pDeleted"), P("pPublic")]), a);
    expect(shown?.map((s) => s.key)).toEqual(["post:pPublic"]);
    // A source that is hidden from V (e.g. made friends-only after the result was built).
    expect(await resolveCitations(ctx, cite([P("pOnlyMe"), P("pPublic")]), a)).toBeNull();
    expect(await resolveCitations(ctx, cite([P("pPublic"), C("cReplyToBlocker")]), a)).toBeNull();
    expect(await resolveCitations(ctx, cite([P("pDeleted"), X("xDeleted")]), a)).toBeNull();
  });

  test("the author always sees their own only-me post", async () => {
    const ctx = fakeCtx(world);
    const a = await loadAudience(ctx, id("F"));
    expect((await resolveSources(ctx, [P("pOnlyMe")], a)).length).toBe(1);
  });
});

describe("live fields", () => {
  test("counts come from the records", async () => {
    const ctx = fakeCtx(world);
    const a = await loadAudience(ctx, id("V"));
    const [p, e] = await resolveSources(ctx, [P("pPublicGroup"), E("ePublic")], a);
    expect(p).toMatchObject({ kind: "post", commentCount: 15, group: { name: "Group gPublic" } });
    expect(e).toMatchObject({ kind: "event", goingCount: 11 });
  });
});

describe("public sources (for results shared by every viewer)", () => {
  test("only sources everyone can see", async () => {
    const ctx = fakeCtx(world);
    const checks: [Source, boolean][] = [
      [P("pPublic"), true],
      [P("pFriendOfViewer"), false],
      [P("pPrivateGroup"), false],
      [P("pPublicGroup"), true],
      [P("pWall"), false],
      [P("pPrivateEventTalk"), false],
      [P("pSharesFriendsPost"), false],
      [P("pSharesPublicPost"), true],
      [P("pAttachesPrivateEvent"), false],
      [C("cPublic"), true],
      [C("cPrivateGroup"), false],
      [C("cNoAuthor"), false],
      [E("ePublic"), true],
      [E("eInvited"), false],
      [E("eMyGroup"), false],
      [E("eNoHost"), false],
      [L("lGoneSeller"), false],
      [G("gPrivate"), true],
      [G("gHidden"), false],
      [L("lS"), true],
      [X("x1"), true],
      [P("pDeleted"), false],
    ];
    for (const [s, expected] of checks)
      expect([s, await isPublicSource(ctx, s)]).toEqual([s, expected]);
  });

  test("assertCitable checks sources against who will see the result", async () => {
    const ctx = fakeCtx(world);
    const v = await loadAudience(ctx, id("V"));
    await assertCitable(ctx, cite([P("pPublic"), P("pFriendOfViewer")]), v);
    await assertCitable(ctx, cite([P("pPublic"), E("ePublic")]), "everyone");
    await expect(assertCitable(ctx, cite([P("pPublic"), P("pDeleted")]), v)).rejects.toThrow(
      "post:pDeleted",
    );
    await expect(assertCitable(ctx, cite([P("pOnlyMe")]), v)).rejects.toThrow("this viewer");
    await expect(assertCitable(ctx, cite([P("pFriendOfViewer")]), "everyone")).rejects.toThrow(
      "everyone",
    );
  });
});

describe("building citations", () => {
  test("cite dedupes and keeps order; tryCite is null for no sources", () => {
    const c = cite([P("pPublic"), E("ePublic"), P("pPublic")]);
    expect(c).toEqual({ first: P("pPublic"), rest: [E("ePublic")] });
    expect(sourcesOf(c)).toEqual([P("pPublic"), E("ePublic")]);
    expect(tryCite([])).toBeNull();
    expect(tryCite([L("lS")])).toEqual({ first: L("lS"), rest: [] });
  });

  test("snippet cuts on a word boundary", () => {
    expect(snippet("  short\n text ")).toBe("short text");
    const long = "word ".repeat(60);
    const s = snippet(long, 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("word…")).toBe(true);
  });
});

test("external URLs are stored in canonical http(s) form only", () => {
  expect(webUrl(" https:data.sfgov.org/x ")).toBe("https://data.sfgov.org/x");
  expect(webUrl("http://sfmta.com")).toBe("http://sfmta.com/");
  expect(webUrl("javascript:alert(1)")).toBeNull();
  expect(webUrl("data.sfgov.org")).toBeNull();
});

describe("formatting", () => {
  test("timeAgo", () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe("just now");
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(timeAgo(NOW - DAY, NOW)).toBe("1 day ago");
    expect(timeAgo(NOW - 14 * DAY, NOW)).toBe("2 weeks ago");
    expect(timeAgo(NOW - 400 * DAY, NOW)).toBe("1 year ago");
    expect(timeAgo(NOW + 3 * DAY, NOW)).toBe("in 3 days");
  });

  test("meta and chip label", async () => {
    const ctx = fakeCtx(world);
    const a = await loadAudience(ctx, id("V"));
    const [p, l, x] = (await resolveSources(ctx, [P("pPublic"), L("lS"), X("x1")], a)) as [
      CitedSource,
      CitedSource,
      CitedSource,
    ];
    expect(sourceMeta(p, NOW)).toBe("15 comments · 2 weeks ago");
    expect(sourceMeta(l, NOW)).toBe("$20 · Mission · listed 3 days ago");
    // The date is local to the machine: Nov 11 12:00 UTC.
    expect(sourceMeta(x, NOW)).toMatch(/^DataSF · fetched Nov 1[12], 2026$/);
    expect(chipLabel([p], NOW)).toBe("15 comments · 2 weeks ago");
    expect(chipLabel([p, l, x], NOW)).toBe("3 sources");
  });
});

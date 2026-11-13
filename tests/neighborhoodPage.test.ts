import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import type { Fact } from "../convex/lib/cityProfile";
import type { InterestId } from "../convex/lib/interests";
import {
  becauseOf,
  type CrewLike,
  diverse,
  EVENT_WINDOW_MS,
  type ForYouItem,
  interestsForPlace,
  matchInterests,
  mentions,
  type neighborhoodDirectory,
  neighborhoodPage,
} from "../convex/lib/neighborhoodPage";
import { directory, page } from "../convex/neighborhoods";
import { fakeCtx, type Row } from "./fakeDb";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const MISSION = "neighborhoods:mission";
const SUNSET = "neighborhoods:sunset";

let n = 0;
const user = (name: string, over: Partial<Row> = {}): Row => ({
  _id: `users:${name}`,
  name,
  firstName: name,
  username: name,
  avatar: `/seed/${name}.jpg`,
  verified: false,
  lastActiveAt: 0,
  ...over,
});
const hood = (id: string, slug: string, name: string): Row => ({
  _id: id,
  slug,
  name,
  center: { lat: 37.76, lng: -122.42 },
  bbox: { west: -122.43, south: 37.75, east: -122.41, north: 37.77 },
  polygon: [],
  citations: { first: { kind: "external", externalSourceId: "x" }, rest: [] },
});
const group = (over: Partial<Row> = {}): Row => ({
  _id: `groups:${++n}`,
  name: `Group ${n}`,
  slug: `group-${n}`,
  cover: "/seed/g.jpg",
  privacy: "public",
  visible: true,
  description: "",
  category: "Neighborhood",
  tags: [],
  memberCount: 100,
  lastActivityAt: n,
  neighborhoodId: MISSION,
  ...over,
});
const event = (over: Partial<Row> = {}): Row => ({
  _id: `events:${++n}`,
  hostId: "users:host",
  title: `Event ${n}`,
  cover: "/seed/e.jpg",
  description: "",
  category: "Community",
  startAt: NOW + DAY,
  online: false,
  venue: "Somewhere",
  city: "San Francisco, CA",
  privacy: "public",
  externalGoingCount: 10,
  externalInterestedCount: 20,
  neighborhoodId: MISSION,
  ...over,
});
const member = (groupId: string, userId: string): Row => ({
  _id: `groupMembers:${++n}`,
  groupId,
  userId,
  role: "member",
  joinedAt: n,
});
const rsvp = (eventId: string, userId: string, status = "going"): Row => ({
  _id: `eventResponses:${++n}`,
  eventId,
  userId,
  status,
  createdAt: n,
});
const friends = (a: string, b: string): Row[] => [
  { _id: `friendships:${++n}`, userId: a, friendId: b },
  { _id: `friendships:${++n}`, userId: b, friendId: a },
];
const fact = (userId: string, key: string, value: unknown, over: Partial<Row> = {}): Row => ({
  _id: `cityProfileFacts:${++n}`,
  userId,
  key,
  value,
  source: "stated",
  evidence: { kind: "brief", summary: "You said so in your brief" },
  confidence: 1,
  updatedAt: 1,
  ...over,
});
const post = (groupId: string, text: string, over: Partial<Row> = {}): Row => ({
  _id: `posts:${++n}`,
  authorId: "users:local",
  userId: "users:local",
  groupId,
  text,
  media: [],
  attachments: [],
  privacy: "public",
  createdAt: n,
  reactionCount: 0,
  commentCount: 0,
  shareCount: 0,
  ...over,
});

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  const base: Record<string, Row[]> = {
    users: ["viewer", "host", "local", "friend", "fof", "stranger", "mutual"].map((u) => user(u)),
    neighborhoods: [hood(MISSION, "mission", "Mission"), hood(SUNSET, "sunset-parkside", "Sunset")],
  };
  for (const [k, rows] of Object.entries(extra)) base[k] = [...(base[k] ?? []), ...rows];
  return base;
}

const viewer = { _id: "users:viewer" } as Doc<"users">;
const run = (tables: Record<string, Row[]>, crew: CrewLike[] | null = null, slug = "mission") =>
  neighborhoodPage(fakeCtx(tables), viewer, slug, { crew, now: NOW });
const keys = (items: ForYouItem[]) => items.map((i) => i.key);

describe("neighborhoodPage", () => {
  test("null for an unknown slug", async () => {
    expect(await run(world(), null, "atlantis")).toBeNull();
  });

  test("Groups: visible ones here, plus hidden ones the viewer is in", async () => {
    const pub = group();
    const priv = group({ privacy: "private" });
    const hidden = group({ visible: false, privacy: "private" });
    const hiddenMine = group({ visible: false, privacy: "private" });
    const elsewhere = group({ neighborhoodId: SUNSET });
    const r = await run(
      world({
        groups: [pub, priv, hidden, hiddenMine, elsewhere],
        groupMembers: [member(hiddenMine._id, "users:viewer")],
      }),
    );
    expect(r?.groups.map((g) => g._id).sort()).toEqual([pub._id, priv._id, hiddenMine._id].sort());
    expect(r?.groups.find((g) => g._id === hiddenMine._id)?.joined).toBe(true);
  });

  test("Events: in person, visible, not over, within 30 days", async () => {
    const soon = event();
    const ongoing = event({ startAt: NOW - 3_600_000, endAt: NOW + 3_600_000 });
    const over = event({ startAt: NOW - DAY });
    const tooFar = event({ startAt: NOW + EVENT_WINDOW_MS + DAY });
    const online = event({ online: true });
    const privateEv = event({ privacy: "private" });
    const invited = event({ privacy: "private" });
    const friendsOnly = event({ privacy: "friends", hostId: "users:friend" });
    const strangersOnly = event({ privacy: "friends", hostId: "users:stranger" });
    const blockedHost = event({ hostId: "users:stranger" });
    const r = await run(
      world({
        events: [
          soon,
          ongoing,
          over,
          tooFar,
          online,
          privateEv,
          invited,
          friendsOnly,
          strangersOnly,
          blockedHost,
        ],
        eventResponses: [rsvp(invited._id, "users:viewer", "invited")],
        friendships: friends("users:viewer", "users:friend"),
        blocks: [{ _id: "blocks:1", userId: "users:stranger", blockedId: "users:viewer" }],
      }),
    );
    expect(r?.events.map((e) => e._id).sort()).toEqual(
      [soon._id, ongoing._id, invited._id, friendsOnly._id].sort(),
    );
    expect(r?.events.find((e) => e._id === invited._id)?.viewerStatus).toBe("invited");
  });

  test("Event counts include seeded outside counts and friends going", async () => {
    const e = event();
    const r = await run(
      world({
        events: [e],
        eventResponses: [rsvp(e._id, "users:friend"), rsvp(e._id, "users:local", "interested")],
        friendships: friends("users:viewer", "users:friend"),
      }),
    );
    expect(r?.events[0]).toMatchObject({ goingCount: 11, interestedCount: 21 });
    expect(r?.events[0].friendsGoing.map((u) => u.username)).toEqual(["friend"]);
  });
});

describe("For you", () => {
  test("no interests in the City Profile asks for the brief", async () => {
    const r = await run(world({ groups: [group({ tags: ["Climbing"] })] }));
    expect(r?.forYou).toEqual({ state: "no_profile" });
  });

  test("ranked by interest weights, each saying why", async () => {
    const climb = group({ name: "Mission Climbers", tags: ["Climbing"] });
    const games = event({ title: "Board Game Night", category: "Games" });
    const surf = group({ name: "Surf Crew", tags: ["Surfing"] });
    const r = await run(
      world({
        groups: [climb, surf],
        events: [games],
        cityProfileFacts: [
          fact("users:viewer", "interest", { id: "climbing" }),
          fact(
            "users:viewer",
            "interest",
            { id: "board_games" },
            {
              source: "inferred",
              confidence: 0.6,
              evidence: { kind: "activity", summary: "RSVP'd to 2 board games Events" },
            },
          ),
        ],
      }),
    );
    if (r?.forYou.state !== "ready") throw new Error("expected ready");
    expect(keys(r.forYou.items)).toEqual([`group:${climb._id}`, `event:${games._id}`]);
    expect(r.forYou.items.map((i) => `${i.reason.label} · ${i.reason.because}`)).toEqual([
      "Climbing · from your brief",
      "Board games · you RSVP'd to 2 board games Events",
    ]);
  });

  test("leaves out Groups the viewer is in and Events they're going to; flags skips", async () => {
    const joined = group({ tags: ["Climbing"] });
    const skipped = group({ tags: ["Bouldering"] });
    const going = event({ title: "Climbing night" });
    const r = await run(
      world({
        groups: [joined, skipped],
        events: [going],
        groupMembers: [member(joined._id, "users:viewer")],
        eventResponses: [rsvp(going._id, "users:viewer")],
        cityProfileFacts: [fact("users:viewer", "interest", { id: "climbing" })],
        dismissals: [
          {
            _id: "dismissals:1",
            userId: "users:viewer",
            targetKind: "group",
            targetId: skipped._id,
            at: 1,
          },
        ],
      }),
    );
    if (r?.forYou.state !== "ready") throw new Error("expected ready");
    expect(keys(r.forYou.items)).toEqual([`group:${skipped._id}`]);
    expect(r.forYou.items[0].kind === "group" && r.forYou.items[0].group.skipped).toBe(true);
    expect(r.groups.find((g) => g._id === joined._id)?.skipped).toBe(false);
  });

  test("skipped picks don't take a slot; they follow, flagged, for Undo", async () => {
    const climbs = [1, 2, 3, 4].map((i) => group({ name: `Climbers ${i}`, tags: ["Climbing"] }));
    const skip = (g: Row, i: number): Row => ({
      _id: `dismissals:s${i}`,
      userId: "users:viewer",
      targetKind: "group",
      targetId: g._id,
      at: 1,
    });
    const r = await run(
      world({
        groups: climbs,
        cityProfileFacts: [fact("users:viewer", "interest", { id: "climbing" })],
        // The least active one is the only one not skipped.
        dismissals: climbs.slice(1).map(skip),
      }),
    );
    if (r?.forYou.state !== "ready") throw new Error("expected ready");
    const shown = r.forYou.items.filter((i) => i.kind === "group" && !i.group.skipped);
    expect(shown.map((i) => i.key)).toEqual([`group:${climbs[0]._id}`]);
    expect(r.forYou.items).toHaveLength(4);
  });

  test("skips come from dismissals, with learning off and on cards with no interest", async () => {
    const plain = group({ name: "Neighbors", tags: [], category: "Neighborhood" });
    const other = group({ name: "Gardeners", tags: [], category: "Neighborhood" });
    const party = event({ title: "Block party", category: "Neighborhood" });
    const mine = { userId: "users:viewer", at: 1 };
    const r = await run(
      world({
        groups: [plain, other],
        events: [party],
        cityProfiles: [
          { _id: "cityProfiles:v", userId: "users:viewer", updatedAt: 1, learnFromActivity: false },
        ],
        dismissals: [
          { _id: "dismissals:1", ...mine, targetKind: "group", targetId: plain._id },
          { _id: "dismissals:2", ...mine, targetKind: "event", targetId: party._id },
          // Someone else's dismissal doesn't hide anything for the viewer.
          {
            _id: "dismissals:3",
            userId: "users:friend",
            at: 1,
            targetKind: "group",
            targetId: other._id,
          },
        ],
      }),
    );
    const skipped = new Map(r?.groups.map((g) => [g._id, g.skipped]));
    expect([skipped.get(plain._id), skipped.get(other._id)]).toEqual([true, false]);
    expect(r?.events.map((e) => e.skipped)).toEqual([true]);
  });

  test("places match by kind and cite the Group posts that name them", async () => {
    const locals = group({ name: "Mission Locals" });
    const secret = group({ privacy: "private", visible: true });
    const named = post(locals._id, "9:00 Moonrise Coffee for a cortado");
    const hiddenMention = post(secret._id, "Pocket Moth Coffee is the best", { privacy: "public" });
    const r = await run(
      world({
        groups: [locals, secret],
        posts: [named, hiddenMention],
        comments: [
          {
            _id: "comments:1",
            postId: named._id,
            authorId: "users:friend",
            text: "moonrise coffee buns are gone by 10",
            createdAt: 5,
            reactionCount: 0,
            replyCount: 0,
          },
        ],
        cityProfileFacts: [fact("users:viewer", "interest", { id: "coffee" })],
      }),
    );
    if (r?.forYou.state !== "ready") throw new Error("expected ready");
    const places = r.forYou.items.filter((i) => i.kind === "place");
    expect(places.map((p) => p.kind === "place" && p.place.name)).toEqual(["Moonrise Coffee"]);
    const first = places[0];
    if (first.kind !== "place") throw new Error("expected place");
    expect(first.sources.map((s) => s.kind)).toEqual(["post", "comment"]);
    expect(first.reason.label).toBe("Coffee");
  });
});

describe("People", () => {
  test("friends and friends of friends in visible Groups and Events, never strangers", async () => {
    const pub = group({ name: "Mission Locals" });
    const priv = group({ privacy: "private", name: "Secret Supper" });
    const e = event({ title: "Mural walk" });
    const r = await run(
      world({
        groups: [pub, priv],
        events: [e],
        groupMembers: [
          member(pub._id, "users:fof"),
          member(pub._id, "users:stranger"),
          member(priv._id, "users:friend"),
        ],
        eventResponses: [rsvp(e._id, "users:friend")],
        friendships: [
          ...friends("users:viewer", "users:friend"),
          ...friends("users:viewer", "users:mutual"),
          ...friends("users:fof", "users:mutual"),
        ],
      }),
    );
    expect(r?.people.map((p) => [p.user.username, p.tie])).toEqual([
      ["friend", "friend"],
      ["fof", "friend_of_friend"],
    ]);
    // The private Group's member list isn't visible to a non-member.
    expect(r?.people[0].via).toEqual([{ kind: "event", _id: e._id as never, title: "Mural walk" }]);
    expect(r?.people[1]).toMatchObject({ mutualCount: 1 });
    expect(r?.people[1].mutual.map((u) => u.username)).toEqual(["mutual"]);
  });

  test("blocked people never appear, and Pages aren't people", async () => {
    const pub = group();
    const r = await run(
      world({
        users: [user("page", { kind: "page" })],
        groups: [pub],
        groupMembers: [member(pub._id, "users:friend"), member(pub._id, "users:page")],
        friendships: [
          ...friends("users:viewer", "users:friend"),
          ...friends("users:viewer", "users:page"),
        ],
        blocks: [{ _id: "blocks:1", userId: "users:viewer", blockedId: "users:friend" }],
      }),
    );
    expect(r?.people).toEqual([]);
  });

  test("crew members show only when this neighborhood is an anchor you share", async () => {
    const summary = (name: string) =>
      ({ _id: `users:${name}`, username: name, kind: "person" }) as CrewLike["user"];
    const crew: CrewLike[] = [
      { user: summary("local"), anchors: [{ kind: "neighborhood", slugs: ["mission"] }] },
      { user: summary("stranger"), anchors: [{ kind: "month", month: "2027-02" }] },
    ];
    const r = await run(world(), crew);
    expect(r?.people.map((p) => [p.user.username, p.tie, p.crew])).toEqual([
      ["local", "crew", true],
    ]);
  });
});

describe("through the Convex functions", () => {
  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
  const call = (fn: unknown, ctx: MutationCtx, args = {}) =>
    (fn as { _handler: Handler })._handler(ctx, { viewerId: "users:viewer", ...args });

  test("page reads the viewer's crew from their opt-in", async () => {
    const tables = world({
      users: [user("ana")],
      cityProfiles: ["viewer", "ana"].map((p) => ({
        _id: `cityProfiles:${p}`,
        userId: `users:${p}`,
        briefCompletedAt: 1,
      })),
      cityProfileFacts: ["viewer", "ana"].flatMap((p) => [
        fact(`users:${p}`, "neighborhood", { slug: "mission" }),
        fact(`users:${p}`, "interest", { id: "climbing" }),
      ]),
      crewOptIns: ["viewer", "ana"].map((p) => ({
        _id: `crewOptIns:${p}`,
        userId: `users:${p}`,
        matchBy: { month: false, neighborhood: true, employer: false },
        createdAt: 1,
        updatedAt: 1,
      })),
    });
    const r = (await call(page, fakeCtx(tables), { slug: "mission" })) as Awaited<
      ReturnType<typeof run>
    >;
    expect(r?.people.map((p) => p.user.username)).toEqual(["ana"]);
    const sunset = (await call(page, fakeCtx(tables), { slug: "sunset-parkside" })) as Awaited<
      ReturnType<typeof run>
    >;
    expect(sunset?.people).toEqual([]);
  });

  test("directory counts visible Groups, upcoming Events and matches", async () => {
    const tables = world({
      groups: [
        group({ tags: ["Climbing"] }),
        group({ visible: false }),
        group({ neighborhoodId: SUNSET }),
      ],
      events: [event({ startAt: Date.now() + DAY }), event({ privacy: "private" })],
      cityProfileFacts: [
        fact("users:viewer", "interest", { id: "climbing" }),
        fact("users:viewer", "neighborhood", { slug: "mission" }),
      ],
    });
    const r = (await call(directory, fakeCtx(tables))) as Awaited<
      ReturnType<typeof neighborhoodDirectory>
    >;
    const mission = r.neighborhoods.find((x) => x.slug === "mission");
    expect(mission).toMatchObject({ groupCount: 1, eventCount: 1, matchCount: 1, yours: true });
    expect(r.neighborhoods.find((x) => x.slug === "sunset-parkside")).toMatchObject({
      groupCount: 1,
      eventCount: 0,
      yours: false,
    });
    expect(r.hasProfile).toBe(true);
  });
});

describe("helpers", () => {
  const f = (evidence: Fact<"interest">["evidence"]) =>
    ({ key: "interest", value: { id: "climbing" }, evidence }) as Fact<"interest">;

  test("becauseOf says where the fact came from", () => {
    expect(becauseOf(f({ kind: "brief", summary: "" }))).toBe("from your brief");
    expect(becauseOf(f({ kind: "free_text", summary: "" }))).toBe("you mentioned it");
    expect(becauseOf(f({ kind: "activity", summary: "Joined Bay Area Climbers" }))).toBe(
      "you joined Bay Area Climbers",
    );
    expect(becauseOf(f({ kind: "activity", summary: "From your activity" }))).toBe(
      "from your activity",
    );
  });

  test("matchInterests sums shared weights and explains with the strongest", () => {
    const weights = new Map<InterestId, number>([
      ["climbing", 0.5],
      ["coffee", 1],
    ]);
    const facts = new Map<InterestId, Fact<"interest">>([
      ["climbing", f({ kind: "brief", summary: "" })],
      ["coffee", f({ kind: "brief", summary: "" })],
    ]);
    const m = matchInterests(["climbing", "coffee", "surfing"], weights, facts);
    expect(m?.score).toBe(1.5);
    expect(m?.reason).toMatchObject({ interest: "coffee", label: "Coffee", also: ["Climbing"] });
    expect(matchInterests(["surfing"], weights, facts)).toBeNull();
  });

  test("diverse gives each interest a slot before any gets a second", () => {
    const xs = [
      { id: "a", score: 1, i: "coffee" },
      { id: "b", score: 1, i: "coffee" },
      { id: "c", score: 1, i: "coffee" },
      { id: "d", score: 0.6, i: "live_music" },
    ];
    expect(
      diverse(
        xs,
        3,
        (x) => x.score,
        (x) => x.i,
      ).map((x) => x.id),
    ).toEqual(["a", "b", "d"]);
  });

  test("place interests and mentions", () => {
    expect(interestsForPlace({ kind: "cafe", name: "Moonrise Coffee" })).toEqual(["coffee"]);
    expect(interestsForPlace({ kind: "street", name: "Valencia Street" })).toEqual([]);
    expect(interestsForPlace({ kind: "shop", name: "Mission Cliffs Climbing" })).toEqual([
      "climbing",
    ]);
    expect(mentions("then Kumo Ramen Bar on mission & 22nd", "Kumo Ramen Bar")).toBe(true);
    expect(mentions("Kumo ramen", "Kumo Ramen Bar")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import * as events from "../convex/events";
import * as groups from "../convex/groups";
import { cloneTemplate, TEMPLATE_GROUP_SLUGS, TEMPLATE_USERNAME } from "../convex/lib/demoClone";
import { neighborhoodPage } from "../convex/lib/neighborhoodPage";
import { fakeCtx, type Row } from "./fakeDb";

/**
 * Guests (`demo.start`, one per browser, `users.isDemo`) are private to
 * themselves: nobody else sees them among a neighborhood's people, a Group's
 * members or an Event's guests, nor counts their memberships. Seeded
 * personas stay visible.
 */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = <T>(fn: unknown, ctx: MutationCtx, viewer: string, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, {
    viewerId: `users:${viewer}`,
    ...args,
  }) as Promise<T>;

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const MISSION = "neighborhoods:mission";

const user = (name: string, over: Partial<Row> = {}): Row => ({
  _id: `users:${name}`,
  name,
  firstName: name,
  username: name,
  avatar: "",
  verified: false,
  kind: "person",
  joinedAt: 1,
  lastActiveAt: 0,
  ...over,
});
const guest = (name: string) => user(name, { name: "Sofia (guest)", isDemo: true });

let n = 0;
const member = (groupId: string, userId: string, joinedAt = NOW): Row => ({
  _id: `groupMembers:${++n}`,
  groupId,
  userId: `users:${userId}`,
  role: "member",
  joinedAt,
});
const friends = (a: string, b: string): Row[] => [
  { _id: `friendships:${++n}`, userId: `users:${a}`, friendId: `users:${b}`, createdAt: 1 },
  { _id: `friendships:${++n}`, userId: `users:${b}`, friendId: `users:${a}`, createdAt: 1 },
];
/** A guest's copied friendship: from the guest only (`lib/demoClone.ts`). */
const oneWay = (from: string, to: string): Row => ({
  _id: `friendships:${++n}`,
  userId: `users:${from}`,
  friendId: `users:${to}`,
  createdAt: 1,
});

const GROUP: Row = {
  _id: "groups:locals",
  name: "Mission Locals",
  slug: "mission-locals",
  cover: "",
  privacy: "public",
  visible: true,
  description: "",
  category: "Neighborhood",
  rules: [],
  tags: [],
  createdBy: "users:maya",
  createdAt: 1,
  externalMemberCount: 0,
  memberCount: 3,
  lastActivityAt: 1,
  neighborhoodId: MISSION,
};
const EVENT: Row = {
  _id: "events:walk",
  hostId: "users:maya",
  title: "Mural walk",
  cover: "",
  description: "",
  category: "Community",
  startAt: NOW + DAY,
  online: false,
  venue: "Balmy Alley",
  city: "San Francisco, CA",
  privacy: "public",
  externalGoingCount: 0,
  externalInterestedCount: 0,
  neighborhoodId: MISSION,
};

/**
 * Viewer is friends with Maya, who is friends with Jordan (a seeded friend of
 * a friend). Two guests copied Sofia's friendship with Maya. Everyone is in
 * the Mission Group and going to its walk.
 */
function world(): Record<string, Row[]> {
  return {
    users: [user("viewer"), user("maya"), user("jordan"), guest("g1"), guest("g2")],
    neighborhoods: [
      {
        _id: MISSION,
        slug: "mission",
        name: "Mission",
        center: { lat: 37.76, lng: -122.42 },
        bbox: { west: -122.43, south: 37.75, east: -122.41, north: 37.77 },
        polygon: [],
        citations: { first: { kind: "external", externalSourceId: "x" }, rest: [] },
      },
    ],
    friendships: [
      ...friends("viewer", "maya"),
      ...friends("maya", "jordan"),
      oneWay("g1", "maya"),
      oneWay("g2", "maya"),
    ],
    groups: [{ ...GROUP }],
    groupMembers: ["maya", "jordan", "g1", "g2"].map((u) => member(GROUP._id, u)),
    events: [{ ...EVENT }],
    eventResponses: ["jordan", "g1", "g2"].map((u) => ({
      _id: `eventResponses:${++n}`,
      eventId: EVENT._id,
      userId: `users:${u}`,
      status: "going",
      createdAt: 1,
    })),
  };
}

const people = async (tables: Record<string, Row[]>, viewer: string) => {
  const r = await neighborhoodPage(
    fakeCtx(tables),
    { _id: `users:${viewer}` } as Doc<"users">,
    "mission",
    { crew: null, now: NOW },
  );
  return r?.people.map((p) => [p.user.username, p.tie, p.mutualCount]);
};

describe("neighborhood people", () => {
  test("guests never show to another viewer, even sharing a friend", async () => {
    expect(await people(world(), "viewer")).toEqual([
      ["maya", "friend", 0],
      ["jordan", "friend_of_friend", 1],
    ]);
  });

  test("a guest the viewer befriended isn't counted as a mutual friend", async () => {
    const tables = world();
    tables.friendships = [...friends("viewer", "g1"), ...friends("g1", "jordan")];
    expect(await people(tables, "viewer")).toEqual([]);
  });

  test("a guest sees seeded people through its copied friendships, never other guests", async () => {
    expect(await people(world(), "g1")).toEqual([
      ["maya", "friend", 0],
      ["jordan", "friend_of_friend", 1],
    ]);
  });
});

type Members = { total: number; everyone: { username: string; relation: string }[] };

describe("Group members", () => {
  test("guests aren't listed to anyone else", async () => {
    const r = await call<Members>(groups.members, fakeCtx(world()), "viewer", {
      groupId: GROUP._id,
    });
    expect(r.everyone.map((m) => m.username)).toEqual(["jordan", "maya"]);
    expect(r.total).toBe(3);
  });

  test("a guest still sees itself", async () => {
    const r = await call<Members>(groups.members, fakeCtx(world()), "g1", { groupId: GROUP._id });
    expect(r.everyone.map((m) => [m.username, m.relation])).toEqual([
      ["jordan", "none"],
      ["maya", "friend"],
      ["g1", "self"],
    ]);
  });

  test("the Group header's avatars and new-member count leave guests out", async () => {
    type Header = { memberPreview: { username: string }[]; stats: { newMembersWeek: number } };
    const ctx = fakeCtx(world());
    const mine = await call<Header>(groups.get, ctx, "viewer", { idOrSlug: GROUP._id });
    expect(mine.memberPreview.map((u) => u.username)).toEqual(["maya", "jordan"]);
    expect(mine.stats.newMembersWeek).toBe(2);
    const theirs = await call<Header>(groups.get, ctx, "g1", { idOrSlug: GROUP._id });
    expect(theirs.memberPreview.map((u) => u.username).sort()).toEqual(["g1", "jordan", "maya"]);
  });

  test("a guest joining or leaving doesn't change the member count", async () => {
    const tables = world();
    tables.groupMembers = [];
    const ctx = fakeCtx(tables);
    await call(groups.join, ctx, "g1", { groupId: GROUP._id });
    expect(tables.groupMembers).toHaveLength(1);
    expect(tables.groups?.[0]?.memberCount).toBe(3);
    await call(groups.leave, ctx, "g1", { groupId: GROUP._id });
    expect(tables.groupMembers).toHaveLength(0);
    expect(tables.groups?.[0]?.memberCount).toBe(3);
  });
});

describe("Event guests", () => {
  type Guests = { user: { username: string } }[];
  test("guests going aren't listed to anyone else, but see themselves", async () => {
    const ctx = fakeCtx(world());
    const mine = await call<Guests>(events.guests, ctx, "viewer", {
      eventId: EVENT._id,
      status: "going",
    });
    expect(mine.map((g) => g.user.username)).toEqual(["jordan"]);
    const theirs = await call<Guests>(events.guests, ctx, "g1", {
      eventId: EVENT._id,
      status: "going",
    });
    expect(theirs.map((g) => g.user.username).sort()).toEqual(["g1", "jordan"]);
  });
});

describe("cloneTemplate", () => {
  test("joins Sofia's Groups without bumping their member counts", async () => {
    const slug = TEMPLATE_GROUP_SLUGS[0] as string;
    const tables: Record<string, Row[]> = {
      users: [user("sofia", { username: TEMPLATE_USERNAME }), user("maya")],
      friendships: friends("sofia", "maya"),
      groups: [{ ...GROUP, _id: "groups:sofia", slug, memberCount: 40 }],
    };
    const id = await cloneTemplate(fakeCtx(tables), NOW);
    expect(tables.users?.find((u) => u._id === id)).toMatchObject({ isDemo: true });
    expect(tables.groupMembers?.map((m) => m.userId)).toEqual([id]);
    expect(tables.groups?.[0]?.memberCount).toBe(40);
  });
});

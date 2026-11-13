import { describe, expect, test } from "bun:test";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import * as events from "../convex/events";
import * as groups from "../convex/groups";
import { pinsInBounds } from "../convex/lib/mapPins";
import { executeProposal } from "../convex/lib/proposals";
import * as listings from "../convex/listings";
import { fakeCtx, type Row } from "./fakeDb";

/**
 * Groups, Events and Marketplace privacy: private and hidden Groups admit only
 * people a member invited, Muse's private crew Groups stay hidden, blocking
 * hides the other person's Events and listings, "Hide from friends" works,
 * and Events created from a Group's Events tab belong to the Group.
 */

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, viewer: string, args: Record<string, unknown> = {}) =>
  (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args });

const PEOPLE = ["maya", "ana", "zed", "blocky"];

function group(id: string, privacy: "public" | "private", visible: boolean): Row {
  return {
    _id: `groups:${id}`,
    name: id,
    slug: id,
    cover: "",
    privacy,
    visible,
    description: "Zoe and Daniel both love climbing",
    category: "Social",
    rules: [],
    tags: [],
    createdBy: "users:maya",
    createdAt: 1,
    externalMemberCount: 0,
    memberCount: 1,
    lastActivityAt: 1,
  };
}

/** Maya runs every group; Ana is her friend; Zed is a stranger; Blocky blocked Maya. */
function world() {
  let n = 0;
  const friend = (a: string, b: string): Row[] => [
    { _id: `friendships:${++n}`, userId: `users:${a}`, friendId: `users:${b}`, createdAt: 1 },
    { _id: `friendships:${++n}`, userId: `users:${b}`, friendId: `users:${a}`, createdAt: 1 },
  ];
  const groupRows = [
    group("open", "public", true),
    group("closed", "private", true),
    group("secret", "private", false),
  ];
  const tables: Record<string, Row[]> = {
    users: PEOPLE.map((p) => ({
      _id: `users:${p}`,
      name: p,
      firstName: p,
      username: p,
      avatar: "",
      verified: false,
      kind: "person",
      joinedAt: 1,
    })),
    friendships: [...friend("maya", "ana"), ...friend("maya", "blocky")],
    blocks: [{ _id: "blocks:1", userId: "users:blocky", blockedId: "users:maya", createdAt: 1 }],
    groups: groupRows,
    groupMembers: groupRows.map((g, i) => ({
      _id: `groupMembers:${i}`,
      groupId: g._id,
      userId: "users:maya",
      role: "admin",
      joinedAt: 1,
    })),
    houses: [],
    houseInvites: [],
    notifications: [],
    userSettings: [],
    profileSignals: [],
    cityProfiles: [],
    posts: [],
    events: [],
    eventResponses: [],
    listings: [],
    saved: [],
    conversations: [],
    friendRequests: [],
    follows: [],
    proposals: [],
  };
  const ctx = fakeCtx(tables);
  Object.assign(ctx, { scheduler: { runAfter: async () => null } });
  Object.assign(ctx.db, {
    normalizeId: (table: string, id: string) => (id.startsWith(`${table}:`) ? id : null),
  });
  return { ctx, tables };
}

type GroupView = { canJoin: boolean; invite: unknown } | null;

describe("private and hidden Groups", () => {
  test("anyone can join a public group", async () => {
    const { ctx, tables } = world();
    expect(((await call(groups.get, ctx, "zed", { idOrSlug: "open" })) as GroupView)?.canJoin).toBe(
      true,
    );
    await call(groups.join, ctx, "zed", { groupId: "groups:open" });
    expect(tables.groupMembers.some((m) => m.userId === "users:zed")).toBe(true);
  });

  test("a private group needs an invite to join", async () => {
    const { ctx, tables } = world();
    const page = (await call(groups.get, ctx, "zed", { idOrSlug: "closed" })) as GroupView;
    expect(page?.canJoin).toBe(false);
    await expect(call(groups.join, ctx, "zed", { groupId: "groups:closed" })).rejects.toThrow(
      "private",
    );
    expect(tables.groupMembers.some((m) => m.userId === "users:zed")).toBe(false);

    await call(groups.invite, ctx, "maya", { groupId: "groups:closed", userIds: ["users:zed"] });
    const invited = (await call(groups.get, ctx, "zed", { idOrSlug: "closed" })) as GroupView;
    expect(invited?.canJoin).toBe(true);
    expect(invited?.invite).not.toBeNull();
    await call(groups.join, ctx, "zed", { groupId: "groups:closed" });
    expect(tables.groupMembers.some((m) => m.userId === "users:zed")).toBe(true);
    // Joining uses the invite up.
    expect(tables.notifications.filter((x) => x.kind === "group_invite")).toHaveLength(0);
  });

  test("an invite stops counting when whoever sent it leaves", async () => {
    const { ctx } = world();
    await call(groups.join, ctx, "ana", { groupId: "groups:open" });
    // Ana joins the private group through Maya, invites Zed, then leaves.
    await call(groups.invite, ctx, "maya", { groupId: "groups:closed", userIds: ["users:ana"] });
    await call(groups.join, ctx, "ana", { groupId: "groups:closed" });
    await call(groups.invite, ctx, "ana", { groupId: "groups:closed", userIds: ["users:zed"] });
    await call(groups.leave, ctx, "ana", { groupId: "groups:closed" });
    await expect(call(groups.join, ctx, "zed", { groupId: "groups:closed" })).rejects.toThrow(
      "private",
    );
    // A member can invite Zed again; the stale invite doesn't stop it.
    await call(groups.invite, ctx, "maya", { groupId: "groups:closed", userIds: ["users:zed"] });
    await call(groups.join, ctx, "zed", { groupId: "groups:closed" });
  });

  test("a hidden group shows only to members and invitees", async () => {
    const { ctx } = world();
    expect(await call(groups.get, ctx, "zed", { idOrSlug: "secret" })).toBeNull();
    await expect(call(groups.members, ctx, "zed", { groupId: "groups:secret" })).rejects.toThrow(
      "Group not found",
    );
    await expect(call(groups.join, ctx, "zed", { groupId: "groups:secret" })).rejects.toThrow(
      "private",
    );
    await call(groups.invite, ctx, "maya", { groupId: "groups:secret", userIds: ["users:zed"] });
    expect(await call(groups.get, ctx, "zed", { idOrSlug: "secret" })).not.toBeNull();
    await call(groups.join, ctx, "zed", { groupId: "groups:secret" });
    expect(await call(groups.members, ctx, "zed", { groupId: "groups:secret" })).toMatchObject({
      canSee: true,
    });
  });

  test("members-only posts stay with members", async () => {
    const { ctx, tables } = world();
    tables.posts.push({
      _id: "posts:1",
      authorId: "users:maya",
      groupId: "groups:closed",
      text: "Members only",
      media: [],
      attachments: [],
      privacy: "public",
      createdAt: 1,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
    });
    const feed = (await call(groups.feed, ctx, "zed", {
      groupId: "groups:closed",
      sort: "new",
      limit: 10,
    })) as { posts: unknown[] };
    expect(feed.posts).toHaveLength(0);
    await expect(call(groups.join, ctx, "zed", { groupId: "groups:closed" })).rejects.toThrow();
  });

  test("Muse's private crew Group is hidden; its invitees can still join", async () => {
    const { ctx, tables } = world();
    const proposal = {
      _id: "proposals:1",
      ownerId: "users:maya",
      status: "approved",
      origin: { agent: "muse" },
      payload: {
        kind: "group",
        name: "February movers",
        description: "Zoe and Daniel both love climbing",
        privacy: "private",
        inviteIds: ["users:ana"],
      },
    } as unknown as Doc<"proposals">;
    const result = await executeProposal(ctx, proposal);
    const groupId = result.kind === "group" ? result.groupId : null;
    const g = tables.groups.find((x) => x._id === groupId);
    expect(g).toMatchObject({ privacy: "private", visible: false });
    expect(await call(groups.get, ctx, "zed", { idOrSlug: g?.slug })).toBeNull();
    await call(groups.join, ctx, "ana", { groupId });
    expect(tables.groupMembers.some((m) => m.groupId === groupId && m.userId === "users:ana")).toBe(
      true,
    );
  });
});

describe("Events", () => {
  const fields = {
    title: "Climb night",
    description: "",
    category: "Sports",
    startAt: Date.now() + 86_400_000,
    online: false,
    venue: "Sutro Boulders",
  };

  test("an event made from a Group's Events tab belongs to the Group, and stays there", async () => {
    const { ctx, tables } = world();
    const eventId = await call(events.create, ctx, "maya", {
      ...fields,
      privacy: "group",
      groupId: "groups:closed",
    });
    expect(tables.events[0]).toMatchObject({ groupId: "groups:closed", privacy: "group" });
    const tab = (await call(groups.events, ctx, "maya", { groupId: "groups:closed" })) as {
      upcoming: { _id: string }[];
    };
    expect(tab.upcoming.map((e) => e._id)).toEqual([eventId as string]);

    // Editing keeps it in the Group: it can't become a Friends event.
    await expect(
      call(events.update, ctx, "maya", { eventId, ...fields, privacy: "friends" }),
    ).rejects.toThrow("for its members");
    await call(events.update, ctx, "maya", {
      eventId,
      ...fields,
      title: "Climb",
      privacy: "group",
    });
    expect(tables.events[0]).toMatchObject({ title: "Climb", privacy: "group" });

    // A public Group can also hold public events; a private one can't.
    await call(events.create, ctx, "maya", {
      ...fields,
      privacy: "public",
      groupId: "groups:open",
    });
    await expect(
      call(events.create, ctx, "maya", { ...fields, privacy: "public", groupId: "groups:closed" }),
    ).rejects.toThrow("for its members");

    // Only members create events in a Group, and "group" needs a Group.
    await expect(
      call(events.create, ctx, "zed", { ...fields, privacy: "group", groupId: "groups:closed" }),
    ).rejects.toThrow("Join the group");
    await expect(
      call(events.create, ctx, "maya", { ...fields, privacy: "group" }),
    ).rejects.toThrow();
  });

  test("a members-only event stays with members, even when someone outside is invited", async () => {
    const { ctx, tables } = world();
    const eventId = await call(events.create, ctx, "maya", {
      ...fields,
      privacy: "group",
      groupId: "groups:secret",
    });
    // Ana is Maya's friend but not in the Group: the invite isn't sent.
    expect(await call(events.invite, ctx, "maya", { eventId, userIds: ["users:ana"] })).toBe(0);
    expect(tables.eventResponses.filter((r) => r.userId === "users:ana")).toHaveLength(0);
    // Even with a response row, the event stays hidden from her.
    tables.eventResponses.push({
      _id: "eventResponses:x",
      eventId,
      userId: "users:ana",
      status: "invited",
      createdAt: 1,
    });
    expect(await call(events.get, ctx, "ana", { eventId })).toBeNull();
    await expect(call(events.respond, ctx, "ana", { eventId, status: "going" })).rejects.toThrow(
      "Event not found",
    );
  });

  test("blocking hides the other person's Events", async () => {
    const { ctx } = world();
    const eventId = await call(events.create, ctx, "maya", { ...fields, privacy: "public" });
    expect(await call(events.get, ctx, "zed", { eventId })).not.toBeNull();
    expect(await call(events.get, ctx, "blocky", { eventId })).toBeNull();
    await expect(call(events.respond, ctx, "blocky", { eventId, status: "going" })).rejects.toThrow(
      "Event not found",
    );
  });
});

describe("Marketplace", () => {
  function listing(id: string, seller: string, extra: Partial<Row> = {}): Row {
    return {
      _id: `listings:${id}`,
      sellerId: `users:${seller}`,
      title: id,
      price: 10,
      category: "household",
      description: "",
      photos: ["/p.jpg"],
      location: { city: "San Francisco, CA", neighborhood: "Mission", lat: 0, lng: 0 },
      status: "active",
      badges: [],
      createdAt: 1,
      updatedAt: 1,
      viewCount: 0,
      ...extra,
    };
  }

  const browse = async (ctx: MutationCtx, viewer: string) =>
    (
      (await call(listings.browse, ctx, viewer, { limit: 20, sort: "newest" })) as {
        items: { title: string }[];
      }
    ).items
      .map((i) => i.title)
      .sort();

  test("blocking hides listings both ways", async () => {
    const { ctx, tables } = world();
    tables.listings.push(listing("lamp", "maya"), listing("chair", "blocky"));
    expect(await browse(ctx, "zed")).toEqual(["chair", "lamp"]);
    expect(await browse(ctx, "maya")).toEqual(["lamp"]);
    expect(await browse(ctx, "blocky")).toEqual(["chair"]);
    expect(await call(listings.get, ctx, "blocky", { listingId: "listings:lamp" })).toBeNull();
    await expect(
      call(listings.messageSeller, ctx, "blocky", { listingId: "listings:lamp", text: "Hi" }),
    ).rejects.toThrow("isn't available");
  });

  test("Hide from friends keeps a listing out of friends' browsing", async () => {
    const { ctx, tables } = world();
    tables.listings.push(listing("lamp", "maya", { hideFromFriends: true }));
    expect(await browse(ctx, "ana")).toEqual([]);
    expect(await browse(ctx, "zed")).toEqual(["lamp"]);
    expect(await browse(ctx, "maya")).toEqual(["lamp"]);
    // The Find map follows the same rule.
    const pins = async (viewer: string) =>
      (
        await pinsInBounds(
          ctx,
          `users:${viewer}` as Id<"users">,
          { west: -1, south: -1, east: 1, north: 1 },
          ["items"],
        )
      ).listings.map((l) => l.title);
    expect(await pins("ana")).toEqual([]);
    expect(await pins("zed")).toEqual(["lamp"]);
  });
});

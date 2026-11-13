import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { factsForModel, renterTrust } from "../convex/lib/renterTrust";
import { subletLadder, subletMoveProblems } from "../convex/lib/subleases";
import * as myPlace from "../convex/myPlace";
import * as subleases from "../convex/subleases";
import { fakeCtx, type Row } from "./fakeDb";

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = <R = unknown>(
  fn: unknown,
  ctx: MutationCtx,
  viewer: string,
  args: Record<string, unknown> = {},
) => (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args }) as R;
const internal = <R = unknown>(fn: unknown, ctx: MutationCtx, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, args) as R;

const TODAY = "2026-11-13";
const NOW = new Date(`${TODAY}T20:00:00Z`).getTime();
const DAY = 86_400_000;
beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => setSystemTime());

let n = 0;
const friends = (a: string, b: string): Row[] => [
  { _id: `friendships:${++n}`, userId: `users:${a}`, friendId: `users:${b}`, createdAt: 0 },
  { _id: `friendships:${++n}`, userId: `users:${b}`, friendId: `users:${a}`, createdAt: 0 },
];
const member = (user: string, group: string): Row => ({
  _id: `groupMembers:${++n}`,
  groupId: `groups:${group}`,
  userId: `users:${user}`,
  role: "member",
  joinedAt: 0,
});

/**
 * Priya (lister) took a Mission rental and is moving out. Theo (renter) is
 * verified, on Facebook for years, a friend of her friend Ana, vouched for by
 * Ana, and in two Groups with her: one plain, one whose name is a protected
 * trait. Zed is unconnected and new.
 */
function world() {
  const person = (u: string, extra: Partial<Row> = {}): Row => ({
    _id: `users:${u}`,
    name: `${u} Lastname`,
    firstName: u,
    username: u,
    avatar: "",
    verified: false,
    joinedAt: NOW - 5 * 365 * DAY,
    lastActiveAt: 0,
    ...extra,
  });
  const tables: Record<string, Row[]> = {
    users: [
      person("priya"),
      person("theo", { verified: true, joinedAt: new Date("2019-03-15T12:00:00Z").getTime() }),
      person("ana"),
      person("zed", { joinedAt: NOW - 3 * DAY }),
      person("landlord"),
    ],
    friendships: [...friends("priya", "ana"), ...friends("theo", "ana")],
    vouches: [
      {
        _id: "vouches:1",
        voucherId: "users:ana",
        subjectId: "users:theo",
        relationship: "roommate",
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    groups: [
      { _id: "groups:climb", slug: "sf-climbers", name: "SF Climbers", description: "Bouldering" },
      {
        _id: "groups:faith",
        slug: "catholic-young-adults",
        name: "Catholic Young Adults SF",
        description: "Mass and brunch",
      },
    ],
    groupMembers: [
      member("priya", "climb"),
      member("theo", "climb"),
      member("priya", "faith"),
      member("theo", "faith"),
    ],
    blocks: [],
    userSettings: [],
    notifications: [],
    neighborhoods: [
      { _id: "neighborhoods:mission", slug: "mission", name: "Mission" },
      {
        _id: "neighborhoods:castro",
        slug: "castro-upper-market",
        name: "Castro/Upper Market",
        shortName: "Castro",
      },
    ],
    listings: [
      {
        _id: "listings:taken",
        sellerId: "users:landlord",
        title: "Sunny Mission 1BR",
        description: "Bay windows",
        price: 2400,
        photos: ["/seed/a1.jpg", "/seed/a2.jpg"],
        category: "propertyrentals",
        status: "active",
        badges: [],
        location: { neighborhood: "Mission", city: "San Francisco, CA" },
        rental: {
          propertyType: "condo",
          listingType: "rent",
          bedrooms: 1,
          bathrooms: 1,
          furnished: false,
        },
        neighborhoodId: "neighborhoods:mission",
        createdAt: 1,
      },
    ],
    places: [
      {
        _id: "places:priya",
        userId: "users:priya",
        listingId: "listings:taken",
        neighborhoodId: "neighborhoods:mission",
        moveIn: "2025-08-20",
        moveOut: "2027-01-04",
        status: "moving_out",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        _id: "places:zed",
        userId: "users:zed",
        neighborhoodId: "neighborhoods:castro",
        moveIn: "2026-01-01",
        status: "living",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    sublets: [],
    subletChats: [],
    conversations: [],
    messages: [],
    proposals: [],
    rooms: [],
    unitScenes: [],
  };
  return { ctx: fakeCtx(tables), tables };
}

const form = (extra: Record<string, unknown> = {}) => ({
  title: "Sublet in Mission",
  rent: 2400,
  minRent: 2200,
  description: "My 1BR while I'm away",
  photos: [{ url: "/seed/a1.jpg" }],
  neighborhood: "Mission",
  propertyType: "apartment",
  bedrooms: 1,
  bathrooms: 1,
  availableFrom: new Date("2027-01-04T12:00:00").getTime(),
  availableTo: new Date("2027-06-30T12:00:00").getTime(),
  furnished: true,
  ...extra,
});

/** Priya lists from her place and Theo writes; returns the chat. */
async function renterWrites(ctx: MutationCtx, tables: Record<string, Row[]>, renter = "theo") {
  const listingId = await call<Id<"listings">>(subleases.create, ctx, "priya", {
    ...form(),
    placeId: "places:priya",
  });
  const conversationId = "conversations:chat";
  tables.conversations.push({
    _id: conversationId,
    kind: "marketplace",
    listingId,
    memberIds: [`users:${renter}`, "users:priya"],
    createdAt: NOW,
    lastMessageAt: NOW,
  });
  tables.messages.push({
    _id: "messages:1",
    conversationId,
    senderId: `users:${renter}`,
    text: "Hi! Is it still available in January?",
    status: "sent",
    attachments: [],
    createdAt: NOW,
  });
  return { listingId, conversationId, ctx: fakeCtx(tables) };
}

describe("sublet my place", () => {
  test("the form fills in from a place taken on Landing", async () => {
    const { ctx } = world();
    const draft = await call<Record<string, unknown>>(subleases.fromPlace, ctx, "priya");
    expect(draft).toMatchObject({
      placeId: "places:priya",
      title: "Sublet in Mission",
      neighborhood: "Mission",
      // A condo is a whole place.
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      furnished: false,
      rent: 2400,
      photos: ["/seed/a1.jpg", "/seed/a2.jpg"],
      availableFrom: "2027-01-04",
      open: null,
    });
  });

  test("a place found elsewhere prefills only what it has", async () => {
    const { ctx } = world();
    const draft = await call<Record<string, unknown>>(subleases.fromPlace, ctx, "zed");
    expect(draft).toMatchObject({
      placeId: "places:zed",
      title: "Sublet in Castro",
      neighborhood: "Castro",
      propertyType: null,
      bedrooms: null,
      rent: null,
      photos: [],
      availableFrom: null,
    });
  });

  test("no place, no prefill; the blank form still lists a sublet", async () => {
    const { ctx, tables } = world();
    expect(await call(subleases.fromPlace, ctx, "ana")).toBeNull();
    await call(subleases.create, ctx, "ana", form());
    expect(tables.sublets[0]).toMatchObject({ ownerId: "users:ana", placeId: undefined });
  });

  test("listing from the place links them, once, and shows on the place", async () => {
    const { ctx, tables } = world();
    const listingId = await call(subleases.create, ctx, "priya", {
      ...form(),
      placeId: "places:priya",
    });
    expect(tables.sublets[0]).toMatchObject({ placeId: "places:priya", listingId });
    await expect(
      call(subleases.create, ctx, "priya", { ...form(), placeId: "places:priya" }),
    ).rejects.toThrow("already listed");
    const draft = await call<{ open: unknown }>(subleases.fromPlace, ctx, "priya");
    expect(draft.open).toMatchObject({ listingId, status: "active" });

    type Mine = { current: { sublet: unknown }; past: { sublet: unknown }[] };
    const mine = await call<Mine>(myPlace.mine, ctx, "priya");
    expect(mine.current.sublet).toMatchObject({ listingId, status: "active", chats: 0 });

    // Moved out, and the sublet was taken: the past place says so.
    await call(myPlace.update, ctx, "priya", {
      placeId: "places:priya",
      status: "moved_out",
      moveOut: TODAY,
    });
    tables.listings.find((l) => l._id === listingId)!.status = "sold";
    const after = await call<Mine>(myPlace.mine, fakeCtx(tables), "priya");
    expect(after.current).toBeNull();
    expect(after.past[0].sublet).toMatchObject({ listingId, status: "sold" });
  });

  test("only your own current place can be linked", async () => {
    const { ctx, tables } = world();
    await expect(
      call(subleases.create, ctx, "ana", { ...form(), placeId: "places:priya" }),
    ).rejects.toThrow("Place not found");
    tables.places[0].endedAt = NOW;
    await expect(
      call(subleases.create, fakeCtx(tables), "priya", { ...form(), placeId: "places:priya" }),
    ).rejects.toThrow("Place not found");
    expect(tables.sublets).toHaveLength(0);
  });

  test("someone else's sublet never shows on your place", async () => {
    const { ctx, tables } = world();
    await call(subleases.create, ctx, "priya", { ...form(), placeId: "places:priya" });
    tables.sublets[0].ownerId = "users:zed";
    const mine = await call<{ current: { sublet: unknown } }>(myPlace.mine, ctx, "priya");
    expect(mine.current.sublet).toBeNull();
  });
});

describe("renter trust", () => {
  const priya = "users:priya" as Id<"users">;
  const theo = "users:theo" as Id<"users">;

  test("cited facts from the lister's network, never a protected trait", async () => {
    const { ctx } = world();
    const trust = await renterTrust(ctx, priya, theo, NOW);
    expect(trust?.renter.firstName).toBe("theo");
    const facts = trust?.facts ?? [];
    expect(facts.map((f) => f.key)).toEqual([
      "identity",
      "vouches",
      "mutual_friends",
      "mutual_groups",
      "tenure",
    ]);
    expect(facts.find((f) => f.key === "vouches")).toMatchObject({
      text: "Vouched for by 1 person in your network",
      sources: [{ kind: "person", user: { username: "ana" } }],
    });
    expect(facts.find((f) => f.key === "mutual_friends")?.text).toBe("1 mutual friend");
    // The faith Group is left out entirely, from the count and the sources.
    expect(facts.find((f) => f.key === "mutual_groups")).toMatchObject({
      text: "In 1 Group with you",
      sources: [{ kind: "group", slug: "sf-climbers" }],
    });
    expect(facts.find((f) => f.key === "tenure")?.text).toBe("On Facebook since March 2019");
    for (const f of facts) {
      expect(f.sources.length).toBeGreaterThan(0);
      expect(f.sourceLabel).not.toBe("");
    }
  });

  test("Muse reads facts and sources without anyone's name", async () => {
    const { ctx } = world();
    const trust = await renterTrust(ctx, priya, theo, NOW);
    const forModel = JSON.stringify(factsForModel(trust?.facts ?? []));
    for (const name of ["ana", "theo", "Climbers", "Catholic"])
      expect(forModel.toLowerCase()).not.toContain(name.toLowerCase());
    expect(forModel).toContain("Identity verified");
  });

  test("a new, unconnected renter gets only their join date", async () => {
    const { ctx } = world();
    const trust = await renterTrust(ctx, priya, "users:zed" as Id<"users">, NOW);
    expect(trust?.facts).toEqual([
      expect.objectContaining({ key: "tenure", text: "Joined Facebook 3 days ago" }),
    ]);
  });

  test("blocked either way: nothing", async () => {
    const { tables } = world();
    tables.blocks.push({ _id: "blocks:1", userId: "users:theo", blockedId: priya, createdAt: 0 });
    expect(await renterTrust(fakeCtx(tables), priya, theo, NOW)).toBeNull();
  });

  test("only the sublet's lister sees them in the chat", async () => {
    const { ctx: base, tables } = world();
    const { ctx, conversationId } = await renterWrites(base, tables);
    const forLister = await call<{ facts: unknown[] }>(subleases.renterTrustFor, ctx, "priya", {
      conversationId,
    });
    expect(forLister.facts.length).toBeGreaterThan(0);
    for (const viewer of ["theo", "ana", "zed"])
      expect(await call(subleases.renterTrustFor, ctx, viewer, { conversationId })).toBeNull();
  });

  test("Muse's input carries them, and the AI-off reply works the same", async () => {
    const { ctx: base, tables } = world();
    const { ctx, conversationId } = await renterWrites(base, tables);
    const c = await internal<{ input: Parameters<typeof subletLadder>[0] }>(
      subleases.context,
      ctx,
      { conversationId },
    );
    expect(c.input.renter).toContainEqual({
      fact: "Identity verified",
      source: "Their Facebook profile",
    });
    const fallback = subletLadder(c.input);
    expect(fallback.move).toBe("message");
    expect(subletMoveProblems(fallback, c.input)).toEqual([]);
  });

  test("the reply to the renter never repeats the facts", () => {
    const input = {
      listing: {
        title: "Room",
        askingRent: 1600,
        neighborhood: "Mission",
        bedrooms: 1,
        bathrooms: 1,
        furnished: true,
        availableFrom: null,
        availableTo: null,
        description: "",
      },
      limits: { minRent: 1500, notes: null },
      yourLastPrice: null,
      chat: [{ from: "renter" as const, text: "Hi!" }],
      renter: [{ fact: "Identity verified", source: "Their Facebook profile" }],
    };
    const reply = (text: string) => ({
      move: "message" as const,
      amount: 0,
      text,
      rationale: "ok",
    });
    expect(subletMoveProblems(reply("Hi! I see Ana vouched for you."), input)).toContain(
      "text must not mention the renter's trust facts; put them in rationale",
    );
    expect(subletMoveProblems(reply("Hi! We have 2 mutual friends."), input).length).toBe(1);
    for (const leak of [
      "Hi! I see you joined Facebook 3 days ago.",
      "Hi! You've been on Facebook since 2019.",
      "Hi! Looks like we're friends on Facebook.",
      "Hi! We're in the same Group, SF Climbers.",
      "Hi! Nice, we have 2 Groups in common.",
      "Hi! Your identity is verified.",
    ])
      expect(subletMoveProblems(reply(leak), input)).toHaveLength(1);
    expect(subletMoveProblems(reply("Hi! Want to see it this week?"), input)).toEqual([]);
    expect(
      subletMoveProblems(reply("Hi! My friends and I can show you around Saturday."), input),
    ).toEqual([]);
  });
});

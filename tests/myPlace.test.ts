import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { getProfile, saveStatedFacts } from "../convex/lib/cityProfile";
import { currentPlace, placeProblem } from "../convex/lib/myPlace";
import * as museKnows from "../convex/museKnows";
import * as myPlace from "../convex/myPlace";
import * as rooms from "../convex/rooms";
import * as unitScenes from "../convex/unitScenes";
import { fakeCtx, type Row } from "./fakeDb";

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = <R = unknown>(
  fn: unknown,
  ctx: MutationCtx,
  viewer: string,
  args: Record<string, unknown> = {},
) => (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args }) as R;

const TODAY = "2026-11-13";
beforeEach(() => setSystemTime(new Date(`${TODAY}T20:00:00Z`)));
afterEach(() => setSystemTime());

const rental = (id: string, extra: Partial<Row> = {}): Row => ({
  _id: `listings:${id}`,
  sellerId: "users:lister",
  title: `Rental ${id}`,
  description: "Sunny one-bedroom",
  price: 2400,
  photos: [`/seed/${id}.jpg`],
  category: "property_rentals",
  status: "active",
  location: { neighborhood: "Mission", city: "San Francisco, CA" },
  rental: { propertyType: "apartment", listingType: "rent", bedrooms: 1, bathrooms: 1 },
  neighborhoodId: "neighborhoods:mission",
  createdAt: 1,
  ...extra,
});

function world() {
  const tables: Record<string, Row[]> = {
    users: ["maya", "lister", "zed"].map((u) => ({
      _id: `users:${u}`,
      name: u,
      firstName: u,
      username: u,
      avatar: "",
    })),
    friendships: [],
    groupMembers: [],
    blocks: [],
    userSettings: [],
    notifications: [],
    neighborhoods: [
      { _id: "neighborhoods:mission", slug: "mission", name: "Mission" },
      { _id: "neighborhoods:noe", slug: "noe-valley", name: "Noe Valley" },
      { _id: "neighborhoods:ggp", slug: "golden-gate-park", name: "Golden Gate Park", park: true },
    ],
    listings: [
      rental("a"),
      rental("b", { neighborhoodId: "neighborhoods:noe" }),
      rental("sale", {
        rental: { propertyType: "house", listingType: "sale", bedrooms: 3, bathrooms: 2 },
      }),
      rental("mine", { sellerId: "users:maya" }),
      rental("oakland", { neighborhoodId: undefined }),
    ],
    places: [],
    rooms: [],
    unitScenes: [],
    cityProfiles: [],
    cityProfileFacts: [],
    profileSignals: [],
    dismissals: [],
  };
  return { ctx: fakeCtx(tables), tables };
}

const take = (ctx: MutationCtx, listing: string, moveIn = "2026-12-01", viewer = "maya") =>
  call<Id<"places">>(myPlace.takeListing, ctx, viewer, {
    listingId: `listings:${listing}`,
    moveIn,
  });

type Mine = Awaited<ReturnType<(typeof myPlace.mine)["_handler"]>>;
const mine = (ctx: MutationCtx, viewer = "maya") => call<Promise<Mine>>(myPlace.mine, ctx, viewer);

describe("placeProblem", () => {
  test("dates must be real and in order", () => {
    expect(placeProblem({ status: "moving_in", moveIn: "2026-12-01" }, TODAY)).toBeNull();
    expect(placeProblem({ status: "moving_in", moveIn: "2026-02-31" }, TODAY)).not.toBeNull();
    expect(placeProblem({ status: "moving_in", moveIn: "2029-01-01" }, TODAY)).not.toBeNull();
    expect(
      placeProblem({ status: "moving_out", moveIn: "2026-10-01", moveOut: "2026-09-01" }, TODAY),
    ).toBe("Your move-out date is before your move-in date");
  });
  test("the status has to fit the dates", () => {
    // Moving in can start in the past; living there can't start in the future.
    expect(placeProblem({ status: "moving_in", moveIn: "2026-10-01" }, TODAY)).toBeNull();
    expect(placeProblem({ status: "living", moveIn: "2026-12-01" }, TODAY)).not.toBeNull();
    expect(placeProblem({ status: "moved_out", moveIn: "2026-01-01" }, TODAY)).toBe(
      "Add the day you moved out",
    );
    expect(
      placeProblem({ status: "moved_out", moveIn: "2026-01-01", moveOut: "2026-12-01" }, TODAY),
    ).not.toBeNull();
    expect(
      placeProblem({ status: "moving_out", moveIn: "2026-01-01", moveOut: "2026-12-01" }, TODAY),
    ).toBeNull();
  });
});

describe("setting the place", () => {
  test("taking a rental makes it the current place, moving in", async () => {
    const { ctx, tables } = world();
    await take(ctx, "a");
    const p = await currentPlace(ctx, "users:maya" as Id<"users">);
    expect(p).toMatchObject({
      listingId: "listings:a",
      neighborhoodId: "neighborhoods:mission",
      moveIn: "2026-12-01",
      status: "moving_in",
    });
    const view = await mine(ctx);
    expect(view.current?.listing?.title).toBe("Rental a");
    expect(view.current?.neighborhood).toEqual({ slug: "mission", name: "Mission" });
    // The lister is never told.
    expect(tables.notifications).toEqual([]);
    expect(await call(myPlace.isMine, ctx, "maya", { listingId: "listings:a" })).toBe(true);
    expect(await call(myPlace.isMine, ctx, "maya", { listingId: "listings:b" })).toBe(false);
  });

  test("only someone else's rental in San Francisco can be taken", async () => {
    const { ctx } = world();
    await expect(take(ctx, "sale")).rejects.toThrow("Only a rental");
    await expect(take(ctx, "mine")).rejects.toThrow("your own listing");
    await expect(take(ctx, "oakland")).rejects.toThrow("Add it on My Place");
    await expect(take(ctx, "a", "2026-02-30")).rejects.toThrow();
  });

  test("a blocked lister's rental can't be taken", async () => {
    const { tables } = world();
    tables.blocks.push({
      _id: "blocks:1",
      userId: "users:lister",
      blockedId: "users:maya",
      createdAt: 1,
    });
    const fresh = fakeCtx(tables);
    await expect(take(fresh, "a")).rejects.toThrow("isn't available");
  });

  test("a place found elsewhere has a neighborhood and a move-in date, no listing", async () => {
    const { ctx } = world();
    await call(myPlace.addFound, ctx, "maya", { neighborhood: "noe-valley", moveIn: "2026-11-20" });
    const view = await mine(ctx);
    expect(view.current).toMatchObject({
      listing: null,
      listingGone: false,
      neighborhood: { slug: "noe-valley" },
      moveIn: "2026-11-20",
    });
    await expect(
      call(myPlace.addFound, ctx, "maya", { neighborhood: "golden-gate-park", moveIn: TODAY }),
    ).rejects.toThrow("neighborhood");
  });
});

describe("changing and clearing it", () => {
  test("taking another place while moving in replaces it", async () => {
    const { ctx, tables } = world();
    await take(ctx, "a");
    await take(ctx, "b");
    expect(tables.places).toHaveLength(1);
    expect(tables.places[0]).toMatchObject({ listingId: "listings:b" });
  });

  test("taking the same place again only moves the date", async () => {
    const { ctx, tables } = world();
    const first = await take(ctx, "a");
    expect(await take(ctx, "a", "2026-12-15")).toBe(first);
    expect(tables.places).toEqual([expect.objectContaining({ moveIn: "2026-12-15" })]);
  });

  test("a place they lived in moves to history when they take the next one", async () => {
    const { ctx, tables } = world();
    const first = await take(ctx, "a", "2026-01-10");
    await call(myPlace.update, ctx, "maya", { placeId: first, status: "living" });
    await take(ctx, "b", "2026-12-01");
    expect(tables.places).toHaveLength(2);
    const view = await mine(ctx);
    expect(view.current?.listing?._id).toBe("listings:b");
    expect(view.past).toHaveLength(1);
    // They leave on the day they report it, since the new move-in is still ahead.
    expect(view.past[0]).toMatchObject({ status: "moved_out", moveOut: TODAY });
  });

  test("a planned move-out still ahead doesn't end up in history", async () => {
    const { ctx } = world();
    const first = await take(ctx, "a", "2026-01-10");
    await call(myPlace.update, ctx, "maya", {
      placeId: first,
      status: "moving_out",
      moveOut: "2027-01-31",
    });
    await take(ctx, "b", "2026-11-01");
    expect((await mine(ctx)).past[0]).toMatchObject({ status: "moved_out", moveOut: "2026-11-01" });
  });

  test("status and dates change; moved out ends it", async () => {
    const { ctx } = world();
    const id = await take(ctx, "a", "2026-10-01");
    await call(myPlace.update, ctx, "maya", { placeId: id, status: "living" });
    await expect(
      call(myPlace.update, ctx, "maya", { placeId: id, moveIn: "2026-12-01" }),
    ).rejects.toThrow("still ahead");
    await call(myPlace.update, ctx, "maya", {
      placeId: id,
      status: "moving_out",
      moveOut: "2027-01-31",
    });
    expect((await mine(ctx)).current).toMatchObject({
      status: "moving_out",
      moveOut: "2027-01-31",
    });
    await call(myPlace.update, ctx, "maya", { placeId: id, moveOut: null });
    expect((await mine(ctx)).current?.moveOut).toBeNull();
    await call(myPlace.update, ctx, "maya", { placeId: id, status: "moved_out" });
    const view = await mine(ctx);
    expect(view.current).toBeNull();
    expect(view.past[0]).toMatchObject({ status: "moved_out", moveOut: TODAY });
    await expect(
      call(myPlace.update, ctx, "maya", { placeId: id, status: "living" }),
    ).rejects.toThrow("moved out");
  });

  test("a listing's neighborhood can't be changed by hand", async () => {
    const { ctx } = world();
    const id = await take(ctx, "a");
    await expect(
      call(myPlace.update, ctx, "maya", { placeId: id, neighborhood: "noe-valley" }),
    ).rejects.toThrow("from its listing");
    await call(myPlace.addFound, ctx, "maya", { neighborhood: "mission", moveIn: TODAY });
    const found = (await mine(ctx)).current?._id;
    await call(myPlace.update, ctx, "maya", { placeId: found, neighborhood: "noe-valley" });
    expect((await mine(ctx)).current?.neighborhood?.slug).toBe("noe-valley");
  });

  test("clearing removes it", async () => {
    const { ctx, tables } = world();
    const id = await take(ctx, "a");
    await call(myPlace.remove, ctx, "maya", { placeId: id });
    expect(tables.places).toEqual([]);
    expect((await mine(ctx)).current).toBeNull();
  });
});

describe("ownership", () => {
  test("nobody else can read, change or clear someone's place", async () => {
    const { ctx } = world();
    const id = await take(ctx, "a");
    expect((await mine(ctx, "zed")).current).toBeNull();
    expect((await mine(ctx, "lister")).current).toBeNull();
    expect(await call(myPlace.isMine, ctx, "zed", { listingId: "listings:a" })).toBe(false);
    await expect(
      call(myPlace.update, ctx, "zed", { placeId: id, status: "living" }),
    ).rejects.toThrow("Place not found");
    await expect(call(myPlace.remove, ctx, "zed", { placeId: id })).rejects.toThrow(
      "Place not found",
    );
    expect((await mine(ctx)).current?._id).toBe(id);
  });

  test("a place whose listing disappeared stays, without the listing", async () => {
    const { ctx, tables } = world();
    await take(ctx, "a");
    tables.users = tables.users.filter((u) => u._id !== "users:lister");
    const view = await mine(fakeCtx(tables));
    expect(view.current).toMatchObject({ listing: null, listingGone: true });
  });
});

describe("City Profile", () => {
  const maya = "users:maya" as Id<"users">;

  test("records where they live and when they move in, as 'Your place'", async () => {
    const { ctx } = world();
    await take(ctx, "a");
    const p = await getProfile(ctx, maya);
    expect(p.home).toMatchObject({
      value: { slug: "mission" },
      source: "stated",
      evidence: { kind: "place", summary: "Your place" },
    });
    expect(p.moveIn?.value).toEqual({ month: "2026-12", date: "2026-12-01" });
    // Where they live never becomes a neighborhood they're looking in.
    expect(p.neighborhoods).toEqual([]);
    // "What Muse knows about you" shows it.
    const known = await call<Promise<{ facts: { key: string }[] }>>(museKnows.facts, ctx, "maya");
    expect(known.facts.map((f) => f.key).sort()).toEqual(["home", "moveIn"]);
  });

  test("follows changes and goes away when the place is cleared", async () => {
    const { ctx, tables } = world();
    const id = await take(ctx, "a");
    await take(ctx, "b", "2026-12-20");
    let p = await getProfile(ctx, maya);
    expect(p.home?.value.slug).toBe("noe-valley");
    expect(p.moveIn?.value.date).toBe("2026-12-20");
    expect(tables.cityProfileFacts).toHaveLength(2);
    await call(myPlace.remove, ctx, "maya", {
      placeId: (await currentPlace(ctx, maya))?._id ?? id,
    });
    p = await getProfile(ctx, maya);
    expect([p.home, p.moveIn]).toEqual([null, null]);
    expect(tables.cityProfileFacts).toEqual([]);
  });

  test("never overrides a move-in date they stated", async () => {
    const { ctx, tables } = world();
    await saveStatedFacts(
      ctx,
      maya,
      ["moveIn"],
      [
        {
          entry: { key: "moveIn", value: { month: "2027-01" } },
          evidence: { kind: "brief", summary: "You said so in your brief" },
        },
      ],
    );
    await take(ctx, "a");
    const p = await getProfile(ctx, maya);
    expect(p.moveIn).toMatchObject({ value: { month: "2027-01" }, evidence: { kind: "brief" } });
    expect(p.home?.value.slug).toBe("mission");
    // Clearing the place leaves what they stated alone.
    await call(myPlace.remove, ctx, "maya", { placeId: tables.places[0]._id });
    expect((await getProfile(ctx, maya)).moveIn?.evidence.kind).toBe("brief");
  });

  test("keeps a removal while the place is the same, and shows a new place again", async () => {
    const { ctx } = world();
    const id = await take(ctx, "a");
    const home = (await getProfile(ctx, maya)).home;
    await call(museKnows.removeFact, ctx, "maya", { factId: home?._id });
    await call(myPlace.update, ctx, "maya", { placeId: id, moveIn: "2026-12-05" });
    expect((await getProfile(ctx, maya)).home).toBeNull();
    await take(ctx, "b");
    expect((await getProfile(ctx, maya)).home?.value.slug).toBe("noe-valley");
  });
});

describe("rooms and the 3D unit", () => {
  test("default to the place's listing", async () => {
    const { ctx, tables } = world();
    await take(ctx, "a");
    await call(rooms.create, ctx, "maya", { name: "Bedroom", kind: "bedroom" });
    expect(tables.rooms[0]).toMatchObject({ listingId: "listings:a" });
    const unit = await call(unitScenes.create, ctx, "maya", {});
    expect(tables.unitScenes).toEqual([
      expect.objectContaining({ _id: unit, listingId: "listings:a", ownerId: "users:maya" }),
    ]);
    // The same unit comes back, and My Place links it and the room.
    expect(await call(unitScenes.create, ctx, "maya", {})).toBe(unit);
    const view = await mine(ctx);
    expect(view.current?.unit?._id).toBe(unit);
    expect(view.current?.rooms.map((r) => r.name)).toEqual(["Bedroom"]);
  });

  test("a chosen room or listing wins, and no place means no default", async () => {
    const { ctx, tables } = world();
    await call(rooms.create, ctx, "maya", { name: "Studio", kind: "bedroom" });
    expect(tables.rooms[0].listingId).toBeUndefined();
    await call(unitScenes.create, ctx, "maya", {});
    expect(tables.unitScenes[0].listingId).toBeUndefined();
    await take(ctx, "a");
    await call(unitScenes.create, ctx, "maya", { listingId: "listings:b" });
    expect(tables.unitScenes[1]).toMatchObject({ listingId: "listings:b" });
    const roomId = tables.rooms[0]._id;
    await call(unitScenes.create, ctx, "maya", { roomId });
    expect(tables.unitScenes[2]).toMatchObject({ roomId });
    expect(tables.unitScenes[2].listingId).toBeUndefined();
  });

  test("a found place has no listing to start from", async () => {
    const { ctx, tables } = world();
    await call(myPlace.addFound, ctx, "maya", { neighborhood: "mission", moveIn: TODAY });
    await call(rooms.create, ctx, "maya", { name: "Bedroom", kind: "bedroom" });
    expect(tables.rooms[0].listingId).toBeUndefined();
  });
});

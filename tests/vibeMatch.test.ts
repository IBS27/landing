import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import { hasTerm, type MatchVibe, matchListing, rankVibeMatches } from "../convex/lib/vibeMatch";
import { matches } from "../convex/rooms";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

const vibe: MatchVibe = {
  styles: ["mid_century", "vintage"],
  palette: ["walnut", "mustard"],
  keywords: ["reading chair", "walnut"],
};

const l = (id: string, title: string, description = "", createdAt = 0) => ({
  id,
  title,
  description,
  createdAt,
});

describe("hasTerm", () => {
  test("whole words and phrases, plural s allowed", () => {
    expect(hasTerm("two vintage wool rugs", "wool rug")).toBe(true);
    expect(hasTerm("a teak credenza", "teak")).toBe(true);
    expect(hasTerm("steakhouse chairs", "teak")).toBe(false);
    expect(hasTerm("anything", "  ")).toBe(false);
  });
});

describe("matchListing", () => {
  test("names the style words that matched", () => {
    const m = matchListing(vibe, l("a", "Mid-century cane armchair, solid teak"));
    expect(m.reasons).toEqual(['Mid-century: "mid-century", "teak"']);
    expect(m.score).toBe(4);
  });
  test("each word counts once across style, keywords and palette", () => {
    const m = matchListing(vibe, l("a", "Walnut side table"));
    expect(m.reasons).toEqual(['Mid-century: "walnut"']);
    expect(m.score).toBe(2);
  });
  test("keywords and palette colors add their own reasons", () => {
    const m = matchListing(vibe, l("a", "Reading chair", "Upholstered in mustard velvet"));
    expect(m.reasons).toEqual(['Your keyword: "reading chair"', "Matches your palette: mustard"]);
  });
  test("a word inside a longer phrase that already matched counts once", () => {
    const m = matchListing(vibe, l("a", "Vintage lamp", "Brass base"));
    expect(m.reasons).toEqual(['Vintage: "vintage lamp", "brass"']);
    expect(m.score).toBe(4);
  });
  test("no matching words, no score", () => {
    expect(matchListing(vibe, l("a", "Glass top desk", "Chrome legs")).score).toBe(0);
  });
});

describe("rankVibeMatches", () => {
  test("best match first, ties to the newer listing, non-matches dropped", () => {
    const ranked = rankVibeMatches(vibe, [
      l("lamp", "Vintage lamp", "", 1),
      l("chair", "Mid-century teak chair with brass feet", "", 2),
      l("desk", "Glass top desk", "", 3),
      l("lamp2", "Vintage lamp", "", 5),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["chair", "lamp2", "lamp"]);
  });
});

/* ---------------- rooms.matches, through the Convex function ---------------- */

describe("rooms.matches", () => {
  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
  type Result = { _id: string; title: string; reasons: string[] }[];
  const call = (ctx: MutationCtx, viewer: string, roomId: string) =>
    (matches as unknown as { _handler: Handler })._handler(ctx, {
      viewerId: `users:${viewer}`,
      roomId,
    }) as Promise<Result>;

  let n = 0;
  const listing = (title: string, extra: Partial<Row> = {}): Row => ({
    _id: `listings:${++n}`,
    sellerId: "users:seller",
    title,
    description: "",
    price: 40,
    category: "furniture",
    photos: [],
    location: { neighborhood: "Mission" },
    status: "active",
    createdAt: n,
    ...extra,
  });
  const room = (id: string, withVibe = true): Row => ({
    _id: id,
    userId: "users:me",
    name: "Living room",
    kind: "living_room",
    photos: [],
    vibe: withVibe
      ? {
          summary: "Warm",
          styles: ["mid_century"],
          palette: ["mustard", "sage"],
          keywords: [],
          origin: "typed",
          updatedAt: 1,
        }
      : undefined,
    createdAt: 1,
    updatedAt: 1,
  });
  function world(listings: Row[], blocks: Row[] = []) {
    return {
      users: ["me", "seller", "blocker", "blockee", "other"].map((u) => ({
        _id: `users:${u}`,
        name: u,
      })),
      rooms: [room("rooms:1"), room("rooms:2", false)],
      listings,
      blocks,
    };
  }

  test("ranks visible matches best first, each with its reasons", async () => {
    const ctx = fakeCtx(
      world([
        listing("Teak credenza"),
        listing("Mid-century walnut credenza", { description: "Mustard drawers" }),
        listing("Glass desk"),
      ]),
    );
    const out = await call(ctx, "me", "rooms:1");
    expect(out.map((m) => m.title)).toEqual(["Mid-century walnut credenza", "Teak credenza"]);
    expect(out[0]?.reasons).toEqual([
      'Mid-century: "mid-century", "credenza", "walnut"',
      "Matches your palette: mustard",
    ]);
  });

  test("shows only listings the viewer can buy: available, not theirs, no blocks either way, no rentals or cars", async () => {
    const ctx = fakeCtx(
      world(
        [
          listing("Teak chair"),
          listing("Teak chair sold", { status: "sold" }),
          listing("Teak chair pending", { status: "pending" }),
          listing("Teak chair mine", { sellerId: "users:me" }),
          listing("Teak chair blocked me", { sellerId: "users:blocker" }),
          listing("Teak chair I blocked", { sellerId: "users:blockee" }),
          listing("Teak-trim sedan", { category: "vehicles" }),
          listing("Teak-floored studio", { category: "propertyrentals" }),
        ],
        [
          { _id: "blocks:1", userId: "users:blocker", blockedId: "users:me" },
          { _id: "blocks:2", userId: "users:me", blockedId: "users:blockee" },
        ],
      ),
    );
    expect((await call(ctx, "me", "rooms:1")).map((m) => m.title)).toEqual(["Teak chair"]);
  });

  test("a room with no vibe has no matches; another person's room is not found", async () => {
    const ctx = fakeCtx(world([listing("Teak chair")]));
    expect(await call(ctx, "me", "rooms:2")).toEqual([]);
    await expect(call(ctx, "other", "rooms:1")).rejects.toThrow("Room not found");
  });

  test("reads a bounded window of recent listings and returns at most 12", async () => {
    const many = Array.from({ length: 450 }, (_, i) => listing(`Teak stool ${i}`));
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const out = await call(fakeCtx(world(many), stats), "me", "rooms:1");
    expect(out).toHaveLength(12);
    expect(out[0]?.title).toBe("Teak stool 449");
    expect(stats.docs).toBeLessThan(410);
  });
});

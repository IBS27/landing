import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import {
  BADGE,
  badgesAfterEdit,
  isBayArea,
  lowPriceSignal,
  MIN_COMPS,
  newAccountSignal,
  phraseFlags,
  reusedPhotosSignal,
} from "../convex/lib/trust";
import {
  CHAT_CHECK_COOLDOWN_MS,
  chatNotes,
  listingTrust,
  requestCheck,
  saveCheck,
  seedTrustDemo,
} from "../convex/trust";
import { fakeCtx, type Row } from "./fakeDb";

const id = (s: string) => s as never;
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

let n = 0;
const user = (_id: string, extra: Partial<Doc<"users">> = {}): Row => ({
  _id,
  name: `${_id} Lastname`,
  firstName: _id,
  username: _id.toLowerCase(),
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
  joinedAt: NOW - 1000 * DAY,
  city: "San Francisco, CA",
  ...extra,
});
const friends = (a: string, b: string): Row[] => [
  { _id: `fr${++n}`, userId: a, friendId: b, createdAt: 0 },
  { _id: `fr${++n}`, userId: b, friendId: a, createdAt: 0 },
];
const rental = (
  _id: string,
  sellerId: string,
  price: number,
  o: {
    hood?: string;
    city?: string;
    bedrooms?: number;
    createdAt?: number;
    photos?: string[];
    badges?: { kind: string; label: string }[];
  } = {},
): Row & Doc<"listings"> =>
  ({
    _id,
    sellerId,
    title: `Listing ${_id}`,
    price,
    category: "propertyrentals",
    description: "A place",
    photos: o.photos ?? [`/p/${_id}.jpg`],
    location: { city: o.city ?? "San Francisco, CA", neighborhood: o.hood, lat: 0, lng: 0 },
    status: "active",
    rental: {
      propertyType: "apartment",
      listingType: "rent",
      bedrooms: o.bedrooms ?? 1,
      bathrooms: 1,
    },
    badges: o.badges ?? [],
    createdAt: o.createdAt ?? NOW - 10 * DAY,
    updatedAt: 0,
    viewCount: 0,
  }) as never;

describe("isBayArea", () => {
  test("matches the city exactly, in California", () => {
    expect(isBayArea("San Rafael, CA")).toBe(true);
    expect(isBayArea("San Francisco, California")).toBe(true);
    expect(isBayArea("Oakland")).toBe(true);
    expect(isBayArea("Richmond, Virginia")).toBe(false);
    expect(isBayArea("Sacramento, CA")).toBe(false);
    expect(isBayArea("San Francisco Bay Hotel, Las Vegas")).toBe(false);
    expect(isBayArea("Phoenix, Arizona")).toBe(false);
  });
});

describe("lowPriceSignal", () => {
  const me = rental("me", "L", 1500, { hood: "Mission" });
  test("needs MIN_COMPS comparables, otherwise no signal", () => {
    const two = [rental("a", "x", 3000, { hood: "Mission" }), rental("b", "x", 3100)];
    expect(MIN_COMPS).toBe(3);
    expect(lowPriceSignal(me, two)).toBeNull();
  });
  test("neighborhood first, then the city, citing the comparables", () => {
    const comps = [
      rental("a", "x", 3000, { hood: "Mission" }),
      rental("b", "x", 3200, { hood: "Mission" }),
      rental("c", "x", 3100, { hood: "Mission" }),
      rental("d", "x", 9000, { hood: "Mission", bedrooms: 3 }),
    ];
    const s = lowPriceSignal(me, comps);
    expect(s).toMatchObject({ kind: "low_price", area: "the Mission", comps: 3, median: 3100 });
    expect(s?.kind === "low_price" && [...s.compIds].sort()).toEqual(id(["a", "b", "c"]));
    const cityOnly = comps.map((c) => ({
      ...c,
      location: { ...c.location, neighborhood: "SoMa" },
    }));
    expect(lowPriceSignal(me, cityOnly)).toMatchObject({ area: "San Francisco", comps: 3 });
  });
  test("a neighborhood with the same name in another city doesn't count", () => {
    const comps = ["a", "b", "c"].map((x) =>
      rental(x, "x", 4000, { hood: "Mission", city: "Sacramento, CA" }),
    );
    expect(lowPriceSignal(me, comps)).toBeNull();
  });
  test("the Bay Area tier only uses Bay Area listings", () => {
    const sac = ["a", "b", "c"].map((x) => rental(x, "x", 4000, { city: "Sacramento, CA" }));
    expect(lowPriceSignal(me, sac)).toBeNull();
    const bay = ["a", "b", "c"].map((x) => rental(x, "x", 4000, { city: "Oakland, CA" }));
    expect(lowPriceSignal(me, bay)).toMatchObject({ area: "the Bay Area" });
  });
});

describe("newAccountSignal", () => {
  const fresh = user("L", { joinedAt: NOW - 5 * DAY }) as never;
  const none = { relation: "none" as const, mutualFriendCount: 0, vouchTotal: 0 };
  test("flags a new account no one in the viewer's network knows", () => {
    expect(newAccountSignal(fresh, none, NOW)).toEqual({ kind: "new_account", daysOld: 5 });
    expect(newAccountSignal(fresh, null, NOW)).not.toBeNull();
  });
  test("not for friends, mutual friends, network vouches or older accounts", () => {
    expect(newAccountSignal(fresh, { ...none, relation: "friend" }, NOW)).toBeNull();
    expect(newAccountSignal(fresh, { ...none, mutualFriendCount: 1 }, NOW)).toBeNull();
    expect(newAccountSignal(fresh, { ...none, vouchTotal: 1 }, NOW)).toBeNull();
    expect(newAccountSignal(user("O") as never, none, NOW)).toBeNull();
  });
});

describe("reusedPhotosSignal", () => {
  test("counts distinct photos found on older listings by others, not the original", () => {
    const orig1 = rental("o1", "A", 1, { photos: ["/x.jpg", "/y.jpg"], createdAt: 1 });
    const orig2 = rental("o2", "B", 1, { photos: ["/x.jpg"], createdAt: 2 });
    const copy = rental("c", "M", 1, { photos: ["/x.jpg", "/z.jpg"], createdAt: 3 });
    expect(reusedPhotosSignal(copy, [orig1, orig2, copy])).toEqual({
      kind: "reused_photos",
      count: 1,
      listingIds: id(["o1", "o2"]),
    });
    expect(reusedPhotosSignal(orig1, [orig1, orig2, copy])).toBeNull();
  });
});

describe("phraseFlags", () => {
  const cats = (text: string) => phraseFlags(text).map((f) => f.category);
  test("catches #11's phrases", () => {
    expect(cats("Please send the deposit before the viewing.")).toContain("deposit_before_viewing");
    expect(cats("I'm out of the country right now so I can't show it.")).toEqual(["away_lister"]);
    expect(cats("You can pay with gift cards or a wire transfer.")).toEqual([
      "untraceable_payment",
    ]);
    expect(
      cats(
        "If you send the first month and deposit through Zelle to hold it, I'll mail you the keys.",
      ),
    ).toEqual(["deposit_before_viewing", "away_lister", "untraceable_payment"]);
  });
  test("harmless messages stay unflagged", () => {
    expect(cats("What time works before the viewing?")).toEqual([]);
    expect(cats("Please do not pay by wire or gift card.")).toEqual([]);
    expect(cats("Never send a deposit before you see it. Come by Saturday!")).toEqual([]);
    expect(cats("The place is great, see you at the showing.")).toEqual([]);
  });
  test("reasons describe the message without accusing anyone", () => {
    for (const f of phraseFlags("Send the deposit by Zelle to hold it, I'm overseas."))
      expect(f.reason).not.toMatch(/scam|fraud|fake/i);
  });
});

describe("badgesAfterEdit", () => {
  const badges = [
    { kind: BADGE.identity, label: "Identity verified" },
    { kind: BADGE.property, label: "Property verified" },
    { kind: BADGE.toured, label: "priya" },
  ];
  const before = { ...rental("l", "L", 2000, { hood: "Mission", photos: ["/a.jpg"] }), badges };
  test("a price or text edit keeps every badge", () => {
    expect(badgesAfterEdit(before, before)).toEqual(badges);
    expect(badgesAfterEdit(before, { ...before, photos: ["/a.jpg"] })).toEqual(badges);
  });
  test("a new place, photos or unit drops the property badges", () => {
    const kept = [badges[0]];
    expect(badgesAfterEdit(before, { ...before, photos: ["/b.jpg"] })).toEqual(kept);
    expect(
      badgesAfterEdit(before, {
        ...before,
        location: { ...before.location, neighborhood: "SoMa" },
      }),
    ).toEqual(kept);
    expect(
      badgesAfterEdit(before, {
        ...before,
        rental: { ...before.rental, bedrooms: 3 } as Doc<"listings">["rental"],
      }),
    ).toEqual(kept);
  });
});

/** V views L's listing. F is V's friend; T is a friend of F; B is blocked by V. */
function world() {
  const conv = {
    _id: "conv1",
    kind: "marketplace",
    listingId: "lst",
    memberIds: ["V", "L"],
    createdAt: 0,
    lastMessageAt: 100,
  };
  return {
    users: [
      user("V"),
      user("L", { joinedAt: Date.now() - 3 * DAY, city: "Phoenix, Arizona" }),
      user("F"),
      user("T"),
      user("B"),
      user("O"),
    ],
    friendships: [...friends("V", "F"), ...friends("F", "T"), ...friends("F", "B")],
    blocks: [{ _id: "bl1", userId: "V", blockedId: "B", createdAt: 0 }],
    listings: [
      rental("lst", "L", 1000, {
        hood: "Mission",
        photos: ["/orig.jpg"],
        createdAt: 50,
        badges: [{ kind: BADGE.toured, label: "t" }],
      }),
      rental("orig", "O", 3000, { hood: "Mission", photos: ["/orig.jpg"], createdAt: 10 }),
      rental("c2", "O", 3100, { hood: "Mission", createdAt: 20 }),
      rental("c3", "O", 3200, { hood: "Mission", createdAt: 30 }),
    ],
    conversations: [conv],
    messages: [
      {
        _id: "m1",
        conversationId: "conv1",
        senderId: "L",
        text: "Send the deposit by Zelle to hold it.",
        status: "sent",
        createdAt: 100,
      },
    ],
  };
}

describe("listingTrust", () => {
  test("signals cite resolved sources, never raw ids", async () => {
    const t = await listingTrust(fakeCtx(world()), id("V"), id("lst"));
    expect(t?.signals.map((s) => s.kind).sort()).toEqual([
      "lister_far_away",
      "low_price",
      "new_account",
      "reused_photos",
    ]);
    const low = t?.signals.find((s) => s.kind === "low_price");
    expect(low && "compIds" in low).toBe(false);
    expect(low?.sources?.map((s) => s.kind === "listing" && s.listingId).sort()).toEqual(
      id(["c2", "c3", "orig"]),
    );
    const photos = t?.signals.find((s) => s.kind === "reused_photos");
    expect(photos?.sources?.[0]).toMatchObject({ kind: "listing", listingId: "orig" });
  });

  test("toured badge: shown for the viewer's network, hidden when blocked or unconnected", async () => {
    const w = world();
    const t = await listingTrust(fakeCtx(w), id("V"), id("lst"));
    expect(t?.badges).toMatchObject([{ kind: "toured", relation: "friend_of_friend" }]);
    w.listings[0].badges = [{ kind: BADGE.toured, label: "b" }];
    expect((await listingTrust(fakeCtx(w), id("V"), id("lst")))?.badges).toEqual([]);
    w.listings[0].badges = [{ kind: BADGE.toured, label: "o" }];
    expect((await listingTrust(fakeCtx(w), id("V"), id("lst")))?.badges).toEqual([]);
  });

  test("the chat check is the renter's only; the lister gets no signals or chat", async () => {
    const w = world();
    const renter = await listingTrust(fakeCtx(w), id("V"), id("lst"));
    expect(renter?.chat).toMatchObject({ conversationId: "conv1", status: "needed", flags: [] });
    const own = await listingTrust(fakeCtx(w), id("L"), id("lst"));
    expect(own).toMatchObject({ isOwn: true, signals: [], chat: null });
  });
});

describe("chat check", () => {
  test("only the renter in the chat gets notes", async () => {
    const w = world();
    expect(await chatNotes(fakeCtx(w), id("V"), id("conv1"))).toMatchObject({
      listingId: "lst",
    });
    expect(await chatNotes(fakeCtx(w), id("L"), id("conv1"))).toBeNull();
    expect(await chatNotes(fakeCtx(w), id("O"), id("conv1"))).toBeNull();
  });

  test("flags on messages outside the new window are kept; an older run never overwrites", async () => {
    const w = world();
    const ctx = fakeCtx(w);
    const base = { conversationId: id("conv1"), viewerId: id("V"), listingId: id("lst") };
    const flag = (messageId: string) => ({
      messageId: id(messageId),
      category: "pressure" as const,
      reason: "r",
    });
    await saveCheck(ctx, {
      ...base,
      flags: [flag("old"), flag("m1")],
      checkedIds: id(["old", "m1"]),
      checkedThrough: 100,
      via: "fallback",
    });
    await saveCheck(ctx, {
      ...base,
      flags: [],
      checkedIds: id(["m1", "m2"]),
      checkedThrough: 200,
      via: "fallback",
    });
    const rows = (w as Record<string, Row[]>).chatChecks;
    expect(rows).toHaveLength(1);
    expect((rows[0].flags as { messageId: string }[]).map((f) => f.messageId)).toEqual(["old"]);
    await saveCheck(ctx, {
      ...base,
      flags: [flag("m1")],
      checkedIds: id(["m1"]),
      checkedThrough: 150,
      via: "fallback",
    });
    expect(rows[0].checkedThrough).toBe(200);
  });

  test("requestCheck: up to date, cooldown, and only for the renter's own chat", async () => {
    const w = world() as Record<string, Row[]>;
    w.chatChecks = [
      {
        _id: "cc1",
        conversationId: "conv1",
        viewerId: "V",
        listingId: "lst",
        flags: [],
        checkedThrough: 100,
        via: "fallback",
        createdAt: 0,
      },
    ];
    expect(await requestCheck(fakeCtx(w), id("V"), id("lst"))).toEqual({ status: "current" });
    w.chatChecks[0].checkedThrough = 50;
    const now = 1_000_000;
    w.aiJobs = [
      {
        _id: "job1",
        kind: "rentalChatCheck",
        key: "conv1:V",
        userId: "V",
        status: "succeeded",
        createdAt: now - 1000,
      },
    ];
    expect(await requestCheck(fakeCtx(w), id("V"), id("lst"), now)).toEqual({
      status: "wait",
      retryInMs: CHAT_CHECK_COOLDOWN_MS - 1000,
    });
    w.aiJobs[0].status = "running";
    expect(await requestCheck(fakeCtx(w), id("V"), id("lst"), now)).toEqual({
      status: "started",
      jobId: id("job1"),
    });
    await expect(requestCheck(fakeCtx(w), id("L"), id("lst"))).rejects.toThrow();
    await expect(requestCheck(fakeCtx(w), id("O"), id("lst"))).rejects.toThrow();
  });
});

describe("seedTrustDemo", () => {
  test("running it twice changes nothing", async () => {
    const w: Record<string, Row[]> = {
      users: [user("maya.chen"), user("derek.holloway"), user("priya.raman")].map((u) => ({
        ...u,
        username: u._id,
      })),
      listings: [rental("dm", "derek.holloway", 3000, { hood: "Mission" })],
    };
    const ctx = fakeCtx(w);
    await seedTrustDemo(ctx, NOW);
    const counts = () => Object.fromEntries(Object.entries(w).map(([k, rows]) => [k, rows.length]));
    const first = counts();
    await seedTrustDemo(ctx, NOW);
    expect(counts()).toEqual(first);
    expect(first.conversations).toBe(1);
  });
});

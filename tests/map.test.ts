import { describe, expect, test } from "bun:test";
import {
  AREA_CELL,
  approximatePoint,
  type Bounds,
  PINS_MAX,
  pinsInBounds,
} from "../convex/lib/mapPins";
import { fakeCtx, type Row } from "./fakeDb";

const id = (s: string) => s as never;
const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

/** Roughly San Francisco. */
const SF: Bounds = { west: -122.52, south: 37.7, east: -122.35, north: 37.82 };
const MISSION = { lat: 37.7568, lng: -122.4233 };
const BERKELEY = { lat: 37.8663, lng: -122.2634 };

let n = 0;
const listing = (over: Partial<Row> & { at?: { lat: number; lng: number } } = {}): Row => {
  const { at = MISSION, ...rest } = over;
  return {
    _id: `listings:${++n}`,
    sellerId: "seller",
    title: `Listing ${n}`,
    price: 3250,
    photos: [`/seed/l${n}.jpg`],
    location: { city: "San Francisco, CA", neighborhood: "Mission", ...at },
    status: "active",
    createdAt: n,
    ...rest,
  };
};
const rental = { propertyType: "apartment", listingType: "rent", bedrooms: 1, bathrooms: 1 };

const event = (over: Partial<Row> = {}): Row => ({
  _id: `events:${++n}`,
  hostId: "host",
  title: `Event ${n}`,
  cover: "/seed/e.jpg",
  startAt: NOW + 24 * HOUR,
  online: false,
  venue: "Dolores Park",
  city: "San Francisco, CA",
  privacy: "public",
  point: MISSION,
  ...over,
});

const group = (over: Partial<Row> = {}): Row => ({
  _id: `groups:${++n}`,
  name: `Group ${n}`,
  slug: `group-${n}`,
  cover: "/seed/g.jpg",
  privacy: "public",
  visible: true,
  memberCount: 1200,
  lastActivityAt: n,
  point: MISSION,
  ...over,
});

const run = (tables: Record<string, Row[]>, kinds = ["homes", "items", "events", "groups"]) =>
  pinsInBounds(
    fakeCtx({ users: [{ _id: "viewer" }], ...tables }),
    id("viewer"),
    SF,
    kinds as never,
    NOW,
  );

describe("approximatePoint", () => {
  test("stays inside the listing's grid cell and is stable", () => {
    const p = approximatePoint("listings:1", MISSION);
    expect(approximatePoint("listings:1", MISSION)).toEqual(p);
    expect(Math.floor(p.lat / AREA_CELL.lat)).toBe(Math.floor(MISSION.lat / AREA_CELL.lat));
    expect(Math.floor(p.lng / AREA_CELL.lng)).toBe(Math.floor(MISSION.lng / AREA_CELL.lng));
    expect(p).not.toEqual(MISSION);
  });

  test("doesn't move with the exact point inside one cell", () => {
    const base = {
      lat: (Math.floor(MISSION.lat / AREA_CELL.lat) + 0.1) * AREA_CELL.lat,
      lng: (Math.floor(MISSION.lng / AREA_CELL.lng) + 0.1) * AREA_CELL.lng,
    };
    const moved = { lat: base.lat + AREA_CELL.lat * 0.8, lng: base.lng + AREA_CELL.lng * 0.8 };
    expect(approximatePoint("listings:9", moved)).toEqual(approximatePoint("listings:9", base));
  });

  test("spreads listings that share a cell", () => {
    const a = approximatePoint("listings:1", MISSION);
    const b = approximatePoint("listings:2", MISSION);
    expect(a).not.toEqual(b);
  });
});

describe("pinsInBounds: listings", () => {
  test("returns active listings in bounds at their approximate area", async () => {
    const home = listing({ rental });
    const out = await run({ listings: [home, listing({ at: BERKELEY })] });
    expect(out.listings.map((l) => l._id)).toEqual([home._id as never]);
    const pin = out.listings[0];
    expect(pin?.point).toEqual(approximatePoint(home._id, MISSION));
    expect(pin?.area).toBe("Mission, San Francisco");
    expect(pin?.home).toEqual({ ...rental } as never);
    expect(JSON.stringify(out)).not.toContain(String(MISSION.lat));
  });

  test("splits homes from items", async () => {
    const home = listing({ rental });
    const desk = listing({ title: "Desk" });
    const homes = await run({ listings: [home, desk] }, ["homes"]);
    const items = await run({ listings: [home, desk] }, ["items"]);
    expect(homes.listings.map((l) => l._id)).toEqual([home._id as never]);
    expect(items.listings.map((l) => l._id)).toEqual([desk._id as never]);
  });

  test("skips sold and pending listings and ones without coordinates", async () => {
    const noCoords = listing();
    noCoords.location = { city: "San Francisco, CA" };
    const out = await run({
      listings: [listing({ status: "sold" }), listing({ status: "pending" }), noCoords],
    });
    expect(out.listings).toEqual([]);
  });

  test("hides listings from sellers blocked either way", async () => {
    const mine = listing({ sellerId: "blocked" });
    const theirs = listing({ sellerId: "blocker" });
    const out = await run({
      listings: [mine, theirs, listing()],
      blocks: [
        { _id: "b1", userId: "viewer", blockedId: "blocked", createdAt: 0 },
        { _id: "b2", userId: "blocker", blockedId: "viewer", createdAt: 0 },
      ],
    });
    expect(out.listings.map((l) => l.title)).toEqual([expect.stringMatching(/^Listing/)]);
    expect(out.listings.some((l) => l._id === mine._id || l._id === theirs._id)).toBe(false);
  });

  test("caps the pins returned", async () => {
    const many = Array.from({ length: PINS_MAX + 20 }, () => listing());
    const out = await run({ listings: many }, ["items"]);
    expect(out.listings).toHaveLength(PINS_MAX);
  });
});

describe("pinsInBounds: Events", () => {
  test("returns upcoming in-person Events the viewer can see", async () => {
    const open = event();
    const out = await run({
      events: [
        open,
        event({ online: true }),
        event({ startAt: NOW - 30 * HOUR, endAt: NOW - 26 * HOUR }),
        event({ point: BERKELEY }),
        event({ point: undefined }),
      ],
    });
    expect(out.events.map((e) => e._id)).toEqual([open._id as never]);
    expect(out.events[0]?.place).toBe("Dolores Park");
  });

  test("follows Facebook's audience rules", async () => {
    const friends = event({ privacy: "friends", hostId: "friend" });
    const stranger = event({ privacy: "friends", hostId: "stranger" });
    const mine = event({ privacy: "group", groupId: "g1" });
    const other = event({ privacy: "group", groupId: "g2" });
    const invited = event({ privacy: "private" });
    const hidden = event({ privacy: "private" });
    const blocked = event({ hostId: "blocked" });
    const out = await run({
      events: [friends, stranger, mine, other, invited, hidden, blocked],
      friendships: [{ _id: "f1", userId: "viewer", friendId: "friend", createdAt: 0 }],
      groupMembers: [{ _id: "m1", groupId: "g1", userId: "viewer", role: "member", joinedAt: 0 }],
      eventResponses: [{ _id: "r1", eventId: invited._id, userId: "viewer", status: "invited" }],
      blocks: [{ _id: "b1", userId: "viewer", blockedId: "blocked", createdAt: 0 }],
    });
    expect(out.events.map((e) => e._id).sort()).toEqual(
      [friends._id, mine._id, invited._id].sort() as never,
    );
  });
});

describe("pinsInBounds: Groups", () => {
  test("shows visible Groups and hidden ones the viewer is in", async () => {
    const open = group();
    const closed = group({ privacy: "private" });
    const secret = group({ visible: false });
    const secretMember = group({ visible: false });
    const out = await run({
      groups: [open, closed, secret, secretMember, group({ point: BERKELEY }), group({ point: 1 })],
      groupMembers: [
        { _id: "m1", groupId: secretMember._id, userId: "viewer", role: "member", joinedAt: 0 },
      ],
    });
    expect(out.groups.map((g) => g._id).sort()).toEqual(
      [open._id, closed._id, secretMember._id].sort() as never,
    );
  });

  test("only reads the kinds asked for", async () => {
    const out = await run({ groups: [group()], events: [event()], listings: [listing()] }, [
      "groups",
    ]);
    expect(out.listings).toEqual([]);
    expect(out.events).toEqual([]);
    expect(out.groups).toHaveLength(1);
  });
});

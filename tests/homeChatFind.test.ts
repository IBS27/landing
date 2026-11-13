import { describe, expect, test } from "bun:test";
import {
  FIND_TOOLS,
  findEvents,
  findGroups,
  findMarketplace,
  findPlaces,
  findRentals,
  listerFacts,
  RECALL_FIND,
} from "../convex/homeChatFind";
import { hasContact } from "../convex/lib/chatText";
import type { ChatActionCard } from "../convex/lib/homeChatRules";
import { type Found, factsIn, said, type ToolViewer } from "../convex/lib/homeChatThings";
import { hasProtected } from "../convex/lib/protectedText";
import { fakeCtx, type Row } from "./fakeDb";

/* ---------- World: V is the viewer ----------
 * - F is V's friend. L is F's friend (a friend of a friend of V) and shares lifestyle answers.
 * - N shares lifestyle answers too, but has no connection to V.
 * - S is a stranger who sells and hosts things. B has blocked V.
 */

const NOW = Date.now();
const DAY = 86_400_000;
const MISSION = "neighborhoods:mission";
const NOE = "neighborhoods:noe-valley";

let n = 0;
const user = (_id: string): Row => ({
  _id,
  kind: "person",
  name: `${_id}name Lastname`,
  firstName: `${_id}name`,
  username: _id.toLowerCase(),
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
  joinedAt: NOW - 400 * DAY,
});
const friends = (a: string, b: string): Row[] => [
  { _id: `fr${++n}`, userId: a, friendId: b, createdAt: n },
  { _id: `fr${++n}`, userId: b, friendId: a, createdAt: n },
];
const lifestyle = (userId: string, shared = true): Row => ({
  _id: `rl_${userId}`,
  userId,
  answers: { sleep: "early", quietHours: "10pm", cleanliness: "tidy" },
  shared,
  sharedAt: shared ? 1 : undefined,
  updatedAt: 1,
});
const hood = (slug: string, name: string): Row => ({
  _id: `neighborhoods:${slug}`,
  slug,
  name,
  center: { lat: 37.76, lng: -122.42 },
  bbox: { west: 0, south: 0, east: 0, north: 0 },
  polygon: [],
  citations: { first: { kind: "external", externalSourceId: "x1" }, rest: [] },
});
const listing = (_id: string, sellerId: string, title: string, price: number, over = {}): Row => ({
  _id,
  sellerId,
  title,
  description: "",
  photos: [`/seed/${_id}.jpg`],
  price,
  category: "furniture",
  status: "active",
  badges: [],
  location: { city: "San Francisco", neighborhood: "Mission", lat: 37.7612, lng: -122.4193 },
  neighborhoodId: MISSION,
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  viewCount: 0,
  ...over,
});
const rental = (_id: string, sellerId: string, title: string, price: number, over = {}): Row =>
  listing(_id, sellerId, title, price, {
    category: "propertyrentals",
    description:
      "Bright room at 123 Valencia St. Email scammer@example.com or call 415-555-1234 to wire a deposit.",
    rental: {
      propertyType: "room",
      listingType: "rent",
      bedrooms: 1,
      bathrooms: 1,
      address: "123 Valencia St",
      furnished: true,
    },
    ...over,
  });
const event = (_id: string, hostId: string, privacy: string, over = {}): Row => ({
  _id,
  hostId,
  privacy,
  title: `Event ${_id}`,
  cover: "/seed/e.jpg",
  description: "Run Club, 8am Saturday",
  category: "Fitness",
  startAt: NOW + 2 * DAY,
  online: false,
  venue: "Dolores Park",
  city: "San Francisco",
  externalGoingCount: 10,
  externalInterestedCount: 4,
  createdAt: NOW - DAY,
  point: { lat: 37.7596, lng: -122.4269 },
  neighborhoodId: MISSION,
  ...over,
});
const group = (_id: string, name: string, over = {}): Row => ({
  _id,
  name,
  slug: _id.toLowerCase(),
  cover: "/seed/g.jpg",
  privacy: "public",
  visible: true,
  description: "Neighbors who run together",
  category: "Sports",
  rules: [{ title: "Be kind", body: "Always" }],
  tags: ["running"],
  createdBy: "S",
  createdAt: NOW - 30 * DAY,
  externalMemberCount: 0,
  memberCount: 120,
  lastActivityAt: NOW - DAY,
  point: { lat: 37.76, lng: -122.42 },
  neighborhoodId: MISSION,
  ...over,
});

function world(over: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    users: ["V", "F", "L", "N", "S", "B"].map(user),
    friendships: [...friends("V", "F"), ...friends("F", "L")],
    blocks: [{ _id: "bl1", userId: "B", blockedId: "V", createdAt: 0 }],
    vouches: [],
    roommateLifestyles: ["V", "L", "N"].map((u) => lifestyle(u)),
    neighborhoods: [hood("mission", "Mission"), hood("noe-valley", "Noe Valley")],
    externalSources: [
      {
        _id: "x1",
        url: "https://data.sfgov.org/neighborhoods",
        title: "Analysis Neighborhoods",
        publisher: "DataSF",
        snippet: "Boundaries",
        fetchedAt: NOW - DAY,
      },
    ],
    cityProfiles: [{ _id: "cp1", userId: "V", briefCompletedAt: NOW - DAY }],
    cityProfileFacts: [
      {
        _id: "f1",
        userId: "V",
        key: "budget",
        value: { max: 2000 },
        source: "stated",
        evidence: { kind: "brief", summary: "From your brief" },
        confidence: 1,
        updatedAt: NOW - DAY,
      },
    ],
    listings: [
      rental("rL", "L", "Sunny room near Dolores", 1500),
      rental("rN", "N", "Quiet room on 24th", 1700),
      rental("rS", "S", "Studio by the park", 2300, { neighborhoodId: NOE }),
      rental("rB", "B", "Room from someone who blocked you", 1200),
      listing("iDesk", "S", "Walnut mid-century desk", 180, {
        description: "Solid walnut with tapered legs.",
        condition: "used_good",
      }),
      listing("iLamp", "S", "Rattan floor lamp", 60, {
        category: "household",
        description: "Warm boho glow for a reading corner.",
      }),
      listing("iChair", "S", "Office chair", 90, {
        description: "Fits under any desk. Call 415-555-1234 or see scam.example.com",
      }),
      listing("iProtected", "S", "Desk for Muslim women only", 40),
      listing("iBlocked", "B", "Walnut desk from a blocker", 20),
      listing("iMine", "V", "My own walnut desk", 20),
      listing("iSold", "S", "Sold walnut desk", 20, { status: "sold" }),
      listing("iGone", "Deleted", "Walnut desk from a deleted account", 20),
    ],
    events: [
      event("ePublic", "S", "public"),
      event("ePrivate", "S", "private"),
      event("eInvited", "S", "private", { title: "Rooftop dinner", startAt: NOW + 3 * DAY }),
      event("eFriends", "F", "friends", { title: "Trivia night", startAt: NOW + 4 * DAY }),
      event("eBlocker", "B", "public"),
      event("eOver", "S", "public", { startAt: NOW - DAY }),
    ],
    eventResponses: [
      { _id: "er1", eventId: "eInvited", userId: "V", status: "invited", createdAt: NOW },
    ],
    groups: [
      group("gPublic", "Mission Run Club"),
      group("gPrivate", "Valencia Neighbors", { privacy: "private" }),
      group("gHidden", "Secret Supper Club", { privacy: "private", visible: false }),
      group("gMine", "Our House", { privacy: "private", visible: false }),
    ],
    groupMembers: [{ _id: "gm1", groupId: "gMine", userId: "V", role: "member", joinedAt: NOW }],
    saved: [],
    ...over,
  } as Record<string, Row[]>;
}

const V = user("V") as unknown as ToolViewer;
const id = (s: string) => s as never;
const keys = (found: Found[]) => found.map((f) => f.key);
const tool = (name: string) => {
  const t = FIND_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`No tool ${name}`);
  return (tables: Record<string, Row[]>, args: Record<string, unknown> = {}) =>
    t.run(fakeCtx(tables), V, args);
};
const actions = (f: Found): ChatActionCard[] => f.card?.actions ?? [];

/** Nothing Muse reads carries a contact detail, a protected trait or an address. */
function expectClean(value: unknown) {
  const text = JSON.stringify(value);
  expect(hasContact(text)).toBe(false);
  expect(text).not.toContain("Muslim");
  expect(text).not.toContain("123 Valencia");
}

describe("tools", () => {
  test("every tool has a unique name, a description and object arguments", () => {
    expect(FIND_TOOLS.map((t) => t.name)).toEqual([
      "search_rentals",
      "search_marketplace",
      "search_events",
      "search_groups",
      "search_places",
      "get_neighborhood",
      "get_details",
      "get_weekend_route",
    ]);
    for (const t of FIND_TOOLS) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.args.kind).toBe("object");
    }
  });
});

describe("search_rentals", () => {
  test("ranked rentals the viewer can see, each a rental card with its lister", async () => {
    const out = await tool("search_rentals")(world());
    expect(keys(out.found).sort()).toEqual(["listing:rL", "listing:rN", "listing:rS"]);
    for (const f of out.found) {
      expect(f.facts).toMatchObject({ kind: "listing", type: "rental", saved: false });
      expect(f.rental?.id).toBe(f.key.slice("listing:".length));
      expect(f.link?.href).toBe(`/landing/find/listing/${f.rental?.id}`);
      expect(f.card).toBeUndefined();
    }
    // The result Muse reads is the same things, by key.
    expect([...factsIn(out.result).keys()].sort()).toEqual(keys(out.found).sort());
    expectClean(out.result);
  });

  test("maxPrice and neighborhood filter; an unknown neighborhood is an error Muse can read", async () => {
    expect(keys((await findRentals(fakeCtx(world()), V, { maxPrice: 1600 })).found)).toEqual([
      "listing:rL",
    ]);
    expect(
      keys((await findRentals(fakeCtx(world()), V, { neighborhood: "noe-valley" })).found),
    ).toEqual(["listing:rS"]);
    await expect(findRentals(fakeCtx(world()), V, { neighborhood: "narnia" })).rejects.toThrow(
      /no neighborhood "narnia"/,
    );
    await expect(tool("search_rentals")(world(), { maxPrice: -5 })).rejects.toThrow(/maxPrice/);
  });

  test("without a City Profile it says so", async () => {
    const out = await tool("search_rentals")(world({ cityProfileFacts: [] }));
    expect(out.result).toMatchObject({ needsBrief: true });
  });

  test("a saved rental says so", async () => {
    const w = world({
      saved: [{ _id: "s1", userId: "V", kind: "listing", refId: "rL", createdAt: NOW }],
    });
    const { found } = await findRentals(fakeCtx(w), V);
    expect(found.find((f) => f.key === "listing:rL")?.facts).toMatchObject({ saved: true });
  });
});

describe("listerFacts", () => {
  test("a friend of a friend who shares answers: connection and compatibility with reasons", async () => {
    const l = await listerFacts(fakeCtx(world()), V, id("L"));
    expect(l).toMatchObject({ name: "Lname", connection: "friend of a friend", mutualFriends: 1 });
    expect(l?.compatibility).toMatchObject({ score: 100, label: "Great match", dealbreakers: [] });
    expect(l?.compatibility?.shared.length).toBe(3);
  });

  test("compatibility needs both to share, and the lister in the viewer's network", async () => {
    // N shares, but is a stranger: sharing promises answers only to people who match with you.
    const stranger = await listerFacts(fakeCtx(world()), V, id("N"));
    expect(stranger).toMatchObject({ name: "Nname", connection: null, compatibility: null });

    const viewerOff = world();
    viewerOff.roommateLifestyles = viewerOff.roommateLifestyles.map((r) =>
      r.userId === "V" ? { ...r, shared: false } : r,
    );
    expect((await listerFacts(fakeCtx(viewerOff), V, id("L")))?.compatibility).toBeNull();

    const listerOff = world();
    listerOff.roommateLifestyles = listerOff.roommateLifestyles.filter((r) => r.userId !== "L");
    expect((await listerFacts(fakeCtx(listerOff), V, id("L")))?.compatibility).toBeNull();
  });

  test("a vouch from a friend is named; a block, a deleted account and yourself are null", async () => {
    const w = world();
    w.vouches = [
      {
        _id: "vo1",
        voucherId: "F",
        subjectId: "N",
        relationship: "lived_with",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const vouched = await listerFacts(fakeCtx(w), V, id("N"));
    expect(vouched?.connection).toBe("vouched for by Fname");
    expect(vouched?.compatibility?.score).toBe(100);

    expect(await listerFacts(fakeCtx(world()), V, id("B"))).toBeNull();
    expect(await listerFacts(fakeCtx(world()), V, id("Deleted"))).toBeNull();
    expect(await listerFacts(fakeCtx(world()), V, id("V"))).toBeNull();
  });

  test("each rental carries its lister, so Muse can compare them", async () => {
    const { found } = await findRentals(fakeCtx(world()), V);
    const lister = (key: string) => (found.find((f) => f.key === key) as Found).facts.lister;
    expect(lister("listing:rL")).toMatchObject({ compatibility: { score: 100 } });
    expect(lister("listing:rN")).toMatchObject({ compatibility: null });
    expect(lister("listing:rS")).toMatchObject({ connection: null, compatibility: null });
  });
});

describe("search_marketplace", () => {
  test("by name: the named thing first, never a blocked seller's, the viewer's own, sold or gone", async () => {
    const { found } = await findMarketplace(fakeCtx(world()), V, { query: "walnut desk" });
    expect(keys(found)).toEqual(["listing:iDesk", "listing:iProtected", "listing:iChair"]);
    expect(found[0].facts).toMatchObject({
      type: "item",
      price: 180,
      condition: "Used - good",
      matches: ['Names "walnut", "desk"'],
    });
    expect(found[0].card).toMatchObject({
      kind: "item",
      price: 180,
      href: "/marketplace/item/iDesk",
    });
    expect(actions(found[0]).map((a) => a.action)).toEqual([
      { kind: "save_listing", listingId: "iDesk" },
    ]);
    expectClean(found.map((f) => [f.facts, f.card, f.link]));
  });

  test("plurals find the singular", async () => {
    const { found } = await findMarketplace(fakeCtx(world()), V, { query: "floor lamps" });
    expect(keys(found)).toEqual(["listing:iLamp"]);
  });

  test("by vibe: items whose words fit the look, each saying which matched", async () => {
    const { found, vibe } = await findMarketplace(fakeCtx(world()), V, {
      vibe: "boho, rattan",
    });
    expect(vibe).toBe("boho, rattan");
    expect(keys(found)).toEqual(["listing:iLamp"]);
    expect((found[0].facts as { matches: string[] }).matches.join(" ")).toMatch(/rattan/i);
  });

  test("myVibe uses the look remembered for their apartment, and says when there is none", async () => {
    const none = await tool("search_marketplace")(world(), { myVibe: true });
    expect(none.result).toMatchObject({ note: expect.stringContaining("No look is remembered") });

    const w = world({
      unitScenes: [
        {
          _id: "u1",
          ownerId: "V",
          listingId: "rL",
          furnishing: { vibe: "boho rattan" },
          updatedAt: NOW,
        },
      ],
    });
    const r = await findMarketplace(fakeCtx(w), V, { myVibe: true });
    expect(r.noRememberedVibe).toBe(false);
    expect(keys(r.found)).toEqual(["listing:iLamp"]);
  });

  test("maxPrice, neighborhood and category narrow it; a wrong category lists the real ones", async () => {
    expect(
      keys((await findMarketplace(fakeCtx(world()), V, { query: "desk", maxPrice: 100 })).found),
    ).toEqual(["listing:iProtected", "listing:iChair"]);
    expect(
      keys((await findMarketplace(fakeCtx(world()), V, { neighborhood: "noe-valley" })).found),
    ).toEqual([]);
    expect(
      keys((await findMarketplace(fakeCtx(world()), V, { category: "Household" })).found),
    ).toEqual(["listing:iLamp"]);
    await expect(findMarketplace(fakeCtx(world()), V, { category: "spaceships" })).rejects.toThrow(
      /Use one of: furniture, household/,
    );
  });

  test("a point is the approximate area, never the listing's coordinates", async () => {
    const { found } = await findMarketplace(fakeCtx(world()), V, { query: "walnut" });
    const point = found[0].card?.point;
    expect(point).toBeDefined();
    expect(point).not.toEqual({ lat: 37.7612, lng: -122.4193 });
  });
});

describe("search_events", () => {
  test("upcoming Events the viewer can see, soonest first", async () => {
    const found = await findEvents(fakeCtx(world()), V);
    // Public, invited to, and a friend's: not a stranger's private one, a blocker's or one that's over.
    expect(keys(found)).toEqual(["event:ePublic", "event:eInvited", "event:eFriends"]);
    expect(found[0].facts).toMatchObject({
      kind: "event",
      neighborhood: "mission",
      yourResponse: null,
      venue: "Dolores Park",
      going: 10,
    });
    expect(found[0].card).toMatchObject({ kind: "event", href: "/events/ePublic" });
    expect(actions(found[0])[0].action).toEqual({
      kind: "rsvp",
      eventId: "ePublic",
      status: "interested",
    });
  });

  test("a response shows, and takes the RSVP button away", async () => {
    const w = world();
    w.eventResponses.push({
      _id: "er2",
      eventId: "ePublic",
      userId: "V",
      status: "going",
      createdAt: NOW,
    });
    const [e] = await findEvents(fakeCtx(w), V, { query: "run club" });
    expect(e.facts).toMatchObject({ yourResponse: "going", going: 11 });
    expect(actions(e)).toEqual([]);
  });

  test("query, neighborhood and withinDays narrow it", async () => {
    expect(keys(await findEvents(fakeCtx(world()), V, { query: "trivia" }))).toEqual([
      "event:eFriends",
    ]);
    expect(keys(await findEvents(fakeCtx(world()), V, { neighborhood: "noe-valley" }))).toEqual([]);
    expect(keys(await findEvents(fakeCtx(world()), V, { withinDays: 2.5 }))).toEqual([
      "event:ePublic",
    ]);
  });

  test("an Event with only an address shows its area, not the address", async () => {
    const w = world();
    w.events = [event("eHome", "S", "public", { venue: undefined, address: "55 Home St" })];
    const [e] = await findEvents(fakeCtx(w), V);
    expect(JSON.stringify(e)).not.toContain("55 Home St");
    expect(e.card?.point).not.toEqual({ lat: 37.7596, lng: -122.4269 });
  });
});

describe("search_groups", () => {
  test("visible Groups and hidden ones the viewer is in; only a public one can be joined", async () => {
    const found = await findGroups(fakeCtx(world()), V);
    expect(keys(found).sort()).toEqual(["group:gMine", "group:gPrivate", "group:gPublic"]);
    const by = (key: string) => found.find((f) => f.key === key) as Found;
    expect(by("group:gPublic").facts).toMatchObject({ privacy: "public", joined: false });
    expect(actions(by("group:gPublic")).map((a) => a.action)).toEqual([
      { kind: "join_group", groupId: "gPublic" },
    ]);
    expect(actions(by("group:gPrivate"))).toEqual([]);
    expect(by("group:gMine").facts).toMatchObject({ joined: true });
    expect(actions(by("group:gMine"))).toEqual([]);
  });

  test("query matches names, tags and descriptions", async () => {
    expect(keys(await findGroups(fakeCtx(world()), V, { query: "running" }))).toContain(
      "group:gPublic",
    );
    expect(keys(await findGroups(fakeCtx(world()), V, { query: "supper" }))).toEqual([]);
  });
});

describe("search_places", () => {
  test("places the threads name, by neighborhood, type and name", async () => {
    const parks = await findPlaces(fakeCtx(world()), V, { neighborhood: "mission", type: "parks" });
    expect(parks.found.length).toBeGreaterThan(0);
    for (const f of parks.found)
      expect(f.facts).toMatchObject({ kind: "place", type: "park", neighborhood: "mission" });

    const moonrise = await findPlaces(fakeCtx(world()), V, { query: "Moonrise Coffee" });
    // The best match by name comes first.
    expect(keys(moonrise.found)[0]).toBe("place:mission/moonrise-coffee");
    expect(moonrise.found[0].card).toMatchObject({
      kind: "place",
      title: "Moonrise Coffee",
      href: "/landing/find/neighborhoods/mission",
    });
    // The seed's own note is never sent: only what the page shows.
    expect(JSON.stringify(moonrise.found[0])).not.toContain("grilled cheese");
    // Nobody in a visible Group mentions it here.
    expect(moonrise.found[0].facts).toMatchObject({ mentionedIn: 0 });
  });

  test("a thread that names a place backs it, when the viewer can see the thread", async () => {
    const w = world({
      posts: [
        {
          _id: "p1",
          authorId: "S",
          groupId: "gPublic",
          text: "Moonrise Coffee has the best cortado",
          privacy: "public",
          attachments: [],
          media: [],
          commentCount: 0,
          reactionCount: 0,
          createdAt: NOW - DAY,
        },
      ],
      comments: [],
    });
    const { found } = await findPlaces(fakeCtx(w), V, {
      neighborhood: "mission",
      query: "Moonrise",
    });
    expect(found[0].facts).toMatchObject({ mentionedIn: 1 });
    expect(found[0].sources).toEqual([
      { label: "Sname's post in Mission Run Club", href: "/s/posts/p1" },
    ]);
  });

  test("cited stations and campuses are places too", async () => {
    const w = world({
      neighborhoodFacts: [
        {
          _id: "nf1",
          neighborhoodId: MISSION,
          key: "bart:16th",
          kind: "transit_station",
          system: "bart",
          name: "16th St Mission",
          lines: ["Red", "Yellow"],
          point: { lat: 37.765, lng: -122.4197 },
          citations: { first: { kind: "external", externalSourceId: "x1" }, rest: [] },
        },
      ],
    });
    const { found } = await findPlaces(fakeCtx(w), V, { type: "station", query: "16th" });
    const station = found.find((f) => f.key === "place:bart:16th");
    expect(station?.facts).toMatchObject({ type: "transit", at: "Lines: Red, Yellow" });
    expect(station?.sources).toEqual([{ label: "Analysis Neighborhoods · DataSF" }]);
    for (const f of found) expect(f.facts).toMatchObject({ type: "transit" });
    expect((await RECALL_FIND.place(fakeCtx(w), V, "bart:16th"))?.key).toBe("place:bart:16th");
  });

  test("a type nobody has returns the types there are; an unknown neighborhood is an error", async () => {
    const out = await tool("search_places")(world(), { type: "spaceport" });
    expect(out.found).toEqual([]);
    expect((out.result as { types: string[] }).types).toContain("park");
    await expect(tool("search_places")(world(), { neighborhood: "narnia" })).rejects.toThrow(
      /no neighborhood/,
    );
  });
});

describe("get_neighborhood", () => {
  const scored = () =>
    world({
      neighborhoodScores: [
        {
          _id: "ns1",
          neighborhoodId: MISSION,
          kind: "food",
          score: 9,
          raw: 40,
          label: "A food destination",
          breakdown: "22 places locals recommend",
          citations: { first: { kind: "external", externalSourceId: "x1" }, rest: [] },
          computedAt: NOW,
        },
      ],
    });

  test("scores with their sources, and the Groups, Events and places there", async () => {
    const out = await tool("get_neighborhood")(scored(), { slug: "mission" });
    const [hoodFound, ...rest] = out.found;
    expect(hoodFound.key).toBe("neighborhood:mission");
    expect(hoodFound.card).toMatchObject({
      kind: "neighborhood",
      title: "Mission",
      lines: ["Food 9/10 · A food destination"],
      href: "/landing/find/neighborhoods/mission",
    });
    expect(hoodFound.sources).toEqual([{ label: "Analysis Neighborhoods · DataSF" }]);
    expect(hoodFound.facts).toMatchObject({
      slug: "mission",
      counts: { groups: 3, upcomingEvents: 3 },
    });
    expect(keys(rest)).toContain("group:gPublic");
    expect(keys(rest)).toContain("event:ePublic");
    expect(keys(rest).some((k) => k.startsWith("place:mission/"))).toBe(true);
    expect(keys(rest)).not.toContain("group:gHidden");
    expect(keys(rest)).not.toContain("event:eBlocker");
    // Everything it found is in what Muse reads.
    expect([...factsIn(out.result).keys()].sort()).toEqual(keys(out.found).sort());
  });

  test("an unknown slug is an error Muse can read", async () => {
    await expect(tool("get_neighborhood")(world(), { slug: "narnia" })).rejects.toThrow(
      /no neighborhood/,
    );
  });
});

describe("get_details", () => {
  test("a rental: description, details and lister, never the address or contact details", async () => {
    const out = await tool("get_details")(world(), { key: "listing:rL" });
    expect(keys(out.found)).toEqual(["listing:rL"]);
    expect(out.result).toMatchObject({
      key: "listing:rL",
      type: "rental",
      details: { propertyType: "room", furnished: true },
      lister: { name: "Lname", connection: "friend of a friend" },
    });
    expect((out.result as { description: string }).description).toContain("Bright room");
    expect(Array.isArray((out.result as { trust: unknown }).trust)).toBe(true);
    expectClean(out.result);
    expect(out.found[0].rental?.id).toBe("rL");
  });

  test("an item, an Event and a Group", async () => {
    const item = await tool("get_details")(world(), { key: "listing:iChair" });
    expect(item.result).toMatchObject({ type: "item", seller: { name: "Sname" } });
    expectClean(item.result);
    const ev = await tool("get_details")(world(), { key: "event:ePublic" });
    expect(ev.result).toMatchObject({ host: "Sname", interested: 4 });
    const gr = await tool("get_details")(world(), { key: "group:gPublic" });
    expect(gr.result).toMatchObject({ rules: ["Be kind"], tags: ["running"] });
  });

  test("what's hidden or gone, and keys it doesn't read, are errors", async () => {
    for (const key of [
      "listing:rB",
      "listing:iSold",
      "listing:nope",
      "event:ePrivate",
      "group:gHidden",
    ])
      await expect(tool("get_details")(world(), { key })).rejects.toThrow(/gone, or they can't/);
    await expect(tool("get_details")(world(), { key: "place:mission/x" })).rejects.toThrow(
      /listing:, event: or group:/,
    );
  });
});

describe("get_weekend_route", () => {
  test("no route yet: it says so", async () => {
    const out = await tool("get_weekend_route")(world(), { slug: "mission" });
    expect(out.found).toEqual([]);
    expect(out.result).toMatchObject({ route: null });
  });

  test("the stops the viewer can see, with the place or Event each sends them to", async () => {
    const cite = { first: { kind: "event", eventId: "ePublic" }, rest: [] };
    const w = world({
      weekendRoutes: [
        {
          _id: "wr1",
          neighborhoodId: MISSION,
          via: "model",
          generatedAt: NOW - DAY,
          runIds: [],
          postCount: 3,
          stops: [
            {
              name: "Moonrise Coffee",
              placeKey: "mission/moonrise-coffee",
              timeOfDay: "morning",
              kind: "cafe",
              why: "Locals start here. Text 415-555-1234 for a table.",
              citations: cite,
            },
            {
              name: "Event ePublic",
              eventId: "ePublic",
              startAt: NOW + 2 * DAY,
              timeOfDay: "morning",
              kind: "event",
              why: "A run in the park",
              citations: cite,
            },
            {
              name: "A blocker's party",
              timeOfDay: "evening",
              kind: "bar",
              why: "Hidden",
              citations: { first: { kind: "event", eventId: "eBlocker" }, rest: [] },
            },
          ],
        },
      ],
    });
    const out = await tool("get_weekend_route")(w, { slug: "mission" });
    expect(keys(out.found)).toEqual(["place:mission/moonrise-coffee", "event:ePublic"]);
    const stops = (out.result as { route: { stops: { name: string }[] } }).route.stops;
    expect(stops.map((s) => s.name)).toEqual(["Moonrise Coffee", "Event ePublic"]);
    expectClean(out.result);
  });
});

describe("RECALL_FIND", () => {
  test("re-reads a thing by id, in the same shape as the searches", async () => {
    const w = world();
    expect((await RECALL_FIND.listing(fakeCtx(w), V, "rL"))?.rental?.id).toBe("rL");
    expect((await RECALL_FIND.listing(fakeCtx(w), V, "iDesk"))?.card?.kind).toBe("item");
    expect((await RECALL_FIND.event(fakeCtx(w), V, "ePublic"))?.key).toBe("event:ePublic");
    expect((await RECALL_FIND.group(fakeCtx(w), V, "gPublic"))?.key).toBe("group:gPublic");
    expect((await RECALL_FIND.place(fakeCtx(w), V, "mission/moonrise-coffee"))?.key).toBe(
      "place:mission/moonrise-coffee",
    );
    expect((await RECALL_FIND.neighborhood(fakeCtx(w), V, "mission"))?.key).toBe(
      "neighborhood:mission",
    );
  });

  test("the viewer's own listing comes back marked as theirs, with nothing to do to it", async () => {
    const mine = await RECALL_FIND.listing(fakeCtx(world()), V, "iMine");
    expect(mine?.facts).toMatchObject({ yours: true });
    expect(actions(mine as Found)).toEqual([]);
  });

  test("null for what's gone, hidden, over, or not an id at all", async () => {
    const w = world();
    for (const listingId of ["rB", "iBlocked", "iSold", "iGone", "nope", "ePublic"])
      expect(await RECALL_FIND.listing(fakeCtx(w), V, listingId)).toBeNull();
    for (const eventId of ["ePrivate", "eBlocker", "eOver", "nope", "rL"])
      expect(await RECALL_FIND.event(fakeCtx(w), V, eventId)).toBeNull();
    for (const groupId of ["gHidden", "nope"])
      expect(await RECALL_FIND.group(fakeCtx(w), V, groupId)).toBeNull();
    expect(await RECALL_FIND.place(fakeCtx(w), V, "mission/nowhere")).toBeNull();
    expect(await RECALL_FIND.neighborhood(fakeCtx(w), V, "narnia")).toBeNull();
  });

  test("nothing recalled carries protected traits", async () => {
    const f = await RECALL_FIND.listing(fakeCtx(world()), V, "iProtected");
    expect(JSON.stringify(f)).not.toContain("Muslim");
    expect(hasProtected(String((f as Found).facts.title))).toBe(true);
  });
});

describe("a listing hidden from the seller's friends", () => {
  // F is V's friend and listed a lamp with "hide from friends" on.
  const hidden = () => {
    const tables = world();
    tables.listings.push(
      listing("iHidden", "F", "Brass floor lamp", 40, { hideFromFriends: true }),
    );
    return tables;
  };
  test("is never found, read or recalled for that friend", async () => {
    const r = await tool("search_marketplace")(hidden(), { query: "brass floor lamp" });
    expect(r.found.map((f) => f.key)).not.toContain("listing:iHidden");
    expect(JSON.stringify(r.result)).not.toContain("Brass floor lamp");
    await expect(tool("get_details")(hidden(), { key: "listing:iHidden" })).rejects.toThrow();
    expect(await RECALL_FIND.listing(fakeCtx(hidden()), V, "iHidden")).toBeNull();
  });
  test("still shows to someone who isn't their friend", async () => {
    const tables = hidden();
    tables.friendships = [];
    const r = await tool("search_marketplace")(tables, { query: "brass floor lamp" });
    expect(r.found.map((f) => f.key)).toContain("listing:iHidden");
  });
});

describe("said: what other people wrote, as Muse may read it", () => {
  test("street addresses are removed, as San Francisco writes them", () => {
    expect(said("Sunny room at 1234 18th St near Dolores", 200)).toBe(
      "Sunny room at … near Dolores",
    );
    expect(said("Room, 742 24th Ave", 200)).toBe("Room, …");
    expect(said("studio at 123 valencia st", 200)).toBe("studio at …");
  });
  test("cross streets, counts and distances stay", () => {
    for (const text of [
      "Valencia St & 18th St",
      "2 bedrooms on Valencia St",
      "3 blocks from Mission St",
      "1BR · Valencia St",
    ])
      expect(said(text, 200)).toBe(text);
  });
  test("links, email addresses and phone numbers are removed", () => {
    expect(said("Desk, text 415-555-0199 or a@b.co now, see www.example.com", 200)).toBe(
      "Desk, text … or … now, see …",
    );
  });
});

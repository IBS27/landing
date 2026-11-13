import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { QueryCtx } from "../convex/_generated/server";
import { MINE_TOOLS, RECALL_MINE, viewerHouse } from "../convex/homeChatMine";
import { type Facts, type Found, factsIn, type ToolOutput } from "../convex/lib/homeChatThings";
import { journeyWeek } from "../convex/lib/journeys";
import { manualScene } from "../convex/lib/unitScene";
import { fakeCtx, type Row } from "./fakeDb";

/**
 * `get_my_move` (#154): each part of the viewer's own move, and never anyone
 * else's. V is the viewer; A is V's friend, roommate match and crew member; H
 * shares V's house; S is a stranger with a move of their own; B blocked V.
 */

const NOW = Date.parse("2027-02-10T20:00:00Z");
const DAY = 86_400_000;
const MOVE_IN = { month: "2027-02", date: "2027-02-01" };

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => setSystemTime());

let n = 0;
const user = (_id: string, more: Record<string, unknown> = {}): Row => ({
  _id,
  kind: "person",
  name: `${_id} Lastname`,
  firstName: _id,
  username: _id.toLowerCase(),
  avatar: `/seed/${_id}.jpg`,
  verified: false,
  lastActiveAt: 0,
  ...more,
});
const fact = (userId: string, key: string, value: unknown): Row => ({
  _id: `fact${++n}`,
  userId,
  key,
  value,
  source: "stated",
  evidence: { kind: "brief", summary: "You said so in your brief" },
  confidence: 1,
  updatedAt: 1,
});
const plans = (userId: string): Row[] => [
  fact(userId, "moveIn", MOVE_IN),
  fact(userId, "neighborhood", { slug: "mission" }),
  fact(userId, "interest", { id: "climbing" }),
];
const friends = (a: string, b: string): Row[] => [
  { _id: `fr${++n}`, userId: a, friendId: b, createdAt: n },
  { _id: `fr${++n}`, userId: b, friendId: a, createdAt: n },
];
const lifestyle = (userId: string, shared = true): Row => ({
  _id: `rl_${userId}`,
  userId,
  answers: { sleep: "early", quietHours: "10pm" },
  shared,
  sharedAt: shared ? 1 : undefined,
  updatedAt: 1,
});
const listing = (_id: string, sellerId: string, title: string, price: number): Row => ({
  _id,
  sellerId,
  title,
  description: "",
  photos: [`/seed/${_id}.jpg`],
  price,
  category: "furniture",
  status: "active",
  badges: [],
  location: { city: "San Francisco" },
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
});
const cited = { first: { kind: "external", externalSourceId: "x1" }, rest: [] };
const proposal = (_id: string, ownerId: string, payload: object, more: object = {}): Row => ({
  _id,
  ownerId,
  payload,
  rationale: "It's a fair price for this desk.",
  origin: { agent: "muse" },
  status: "pending",
  createdAt: NOW - 1000,
  updatedAt: NOW - 1000,
  ...more,
});
const negotiation = (_id: string, buyerId: string, listingId: string, more: object = {}): Row => ({
  _id,
  buyerId,
  listingId,
  conversationId: "c2",
  maxPrice: 120,
  targetPrice: 100,
  status: "active",
  lastMove: "offer",
  lastOffer: 100,
  handledThrough: 0,
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  ...more,
});
const place = (_id: string, userId: string): Row => ({
  _id,
  userId,
  neighborhoodId: "neighborhoods:mission",
  moveIn: "2027-02-01",
  status: "moving_in",
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
});
const member = (groupId: string, userId: string): Row => ({
  _id: `gm${++n}`,
  groupId,
  userId,
  role: "member",
  joinedAt: n,
});
const houseGroup = (_id: string, name: string): Row => ({
  _id,
  name,
  slug: _id,
  privacy: "private",
  visible: false,
  memberCount: 2,
});

function world(): Record<string, Row[]> {
  const week = journeyWeek(MOVE_IN, NOW);
  if (!week) throw new Error("NOW should fall in V's first 90 days");
  const activity = { events: [], groups: [], friends: [], journeyStops: [] };
  return {
    users: [
      ...["V", "A", "H", "S", "B", "Seller"].map((u) => user(u)),
      user("M", { kind: "page", name: "Swift Movers" }),
    ],
    friendships: friends("V", "A"),
    blocks: [{ _id: "bl1", userId: "B", blockedId: "V", createdAt: 0 }],
    cityProfiles: ["V", "A", "S", "B"].map((u) => ({
      _id: `cp_${u}`,
      userId: u,
      briefCompletedAt: 1,
      updatedAt: 1,
    })),
    cityProfileFacts: [...["V", "A", "S", "B"].flatMap(plans), fact("V", "budget", { max: 2400 })],
    crewOptIns: ["V", "A", "B"].map((u) => ({
      _id: `co_${u}`,
      userId: u,
      matchBy: { month: true, neighborhood: true, employer: false },
      createdAt: 1,
      updatedAt: 1,
    })),
    roommateLifestyles: [lifestyle("V"), lifestyle("A"), lifestyle("S")],
    neighborhoods: [{ _id: "neighborhoods:mission", slug: "mission", name: "Mission" }],
    externalSources: [
      { _id: "x1", url: "https://example.org", title: "SFMTA", publisher: "SFMTA", snippet: "x" },
    ],

    /* The house V shares with H, and S's own. */
    groups: [houseGroup("g1", "Casa Verde"), houseGroup("g2", "Their House")],
    houses: [
      { _id: "h1", groupId: "g1", createdBy: "V", createdAt: 1 },
      { _id: "h2", groupId: "g2", createdBy: "S", createdAt: 1 },
    ],
    groupMembers: [member("g1", "V"), member("g1", "H"), member("g2", "S")],
    houseChores: [
      {
        _id: "ch1",
        houseId: "h1",
        title: "Take the bins out",
        cadence: "weekly",
        assigneeId: "H",
        createdBy: "V",
        createdAt: 1,
      },
      {
        _id: "ch2",
        houseId: "h2",
        title: "S's secret chore",
        cadence: "once",
        createdBy: "S",
        createdAt: 1,
      },
    ],
    houseBills: [
      {
        _id: "b1",
        houseId: "h1",
        title: "Internet",
        amountCents: 6550,
        dueDate: "2027-02-20",
        cadence: "monthly",
        createdBy: "H",
        createdAt: 1,
      },
      {
        _id: "b2",
        houseId: "h2",
        title: "S's bill",
        amountCents: 100,
        cadence: "once",
        createdBy: "S",
        createdAt: 1,
      },
    ],
    groceryItems: [
      { _id: "gr1", houseId: "h1", text: "Oat milk", addedBy: "H", createdAt: 1 },
      { _id: "gr2", houseId: "h2", text: "S's groceries", addedBy: "S", createdAt: 1 },
    ],

    /* Marketplace: V negotiates the desk; S the lamp; B sells the chair. */
    listings: [
      listing("L_desk", "Seller", "Walnut desk", 180),
      listing("L_lamp", "Seller", "Brass lamp", 40),
      listing("L_chair", "B", "Blocked chair", 90),
      listing("L_sale", "V", "Bookshelf", 80),
      { ...listing("L_sub", "V", "Sunny room sublet", 1700), category: "propertyrentals" },
    ],
    conversations: [
      { _id: "c1", kind: "dm", memberIds: ["V", "A"], createdAt: 1, lastMessageAt: 1 },
      {
        _id: "c2",
        kind: "marketplace",
        listingId: "L_desk",
        memberIds: ["V", "Seller"],
        createdAt: 1,
        lastMessageAt: 1,
      },
      { _id: "c3", kind: "dm", memberIds: ["V", "M"], createdAt: 1, lastMessageAt: 1 },
      { _id: "c4", kind: "dm", memberIds: ["S", "A"], createdAt: 1, lastMessageAt: 1 },
    ],
    conversationMembers: [
      { _id: "cm1", conversationId: "c1", userId: "V" },
      { _id: "cm2", conversationId: "c2", userId: "V" },
      { _id: "cm3", conversationId: "c3", userId: "V" },
      { _id: "cm4", conversationId: "c4", userId: "S" },
    ],
    proposals: [
      proposal("p_msg", "V", {
        kind: "message",
        conversationId: "c1",
        text: "Hi A, want to look at places together?",
      }),
      proposal(
        "p_offer",
        "V",
        {
          kind: "offer",
          conversationId: "c2",
          listingId: "L_desk",
          amount: 120,
          text: "Would you take $120?",
        },
        { expiresAt: NOW + DAY },
      ),
      proposal("p_event", "V", {
        kind: "event",
        title: "Crew brunch",
        description: "Brunch for the February crew.",
        startAt: NOW + 3 * DAY,
        inviteIds: ["A"],
      }),
      proposal(
        "p_old",
        "V",
        { kind: "message", conversationId: "c1", text: "Too late" },
        { expiresAt: NOW - 1 },
      ),
      proposal("p_theirs", "S", {
        kind: "message",
        conversationId: "c4",
        text: "S's private draft",
      }),
      proposal(
        "p_mover",
        "V",
        { kind: "message", conversationId: "c3", text: "Could you quote my move?" },
        { status: "approved", decidedAt: NOW - 4000 },
      ),
    ],
    negotiations: [
      negotiation("n1", "V", "L_desk", { pendingProposalId: "p_offer" }),
      negotiation("n2", "S", "L_lamp"),
      negotiation("n3", "V", "L_chair", { updatedAt: NOW - 2 * DAY }),
    ],

    /* V's place found elsewhere, its 3D unit and its sublet; S has a place too. */
    places: [place("pl1", "V"), place("pl2", "S")],
    unitScenes: [
      {
        _id: "u1",
        ownerId: "V",
        scene: manualScene(6, 7, "Unit"),
        placements: [{ id: "a", label: "Blue sofa", kind: "sofa" }],
        furnishing: { vibe: "cozy mid-century", budget: 1500 },
        sources: [],
        description: "",
        revision: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    sublets: [
      {
        _id: "s1",
        listingId: "L_sub",
        ownerId: "V",
        minRent: 1500,
        museReplies: "active",
        placeId: "pl1",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    ownedItems: [
      {
        _id: "o1",
        userId: "V",
        title: "Bookshelf",
        price: 60,
        acquiredAt: 2,
        photos: [],
        source: { kind: "manual" },
        saleListingId: "L_sale",
        saleMinPrice: 40,
        saleMuse: "active",
        createdAt: 2,
      },
      {
        _id: "o2",
        userId: "S",
        title: "S's couch",
        price: 300,
        acquiredAt: 1,
        photos: [],
        source: { kind: "manual" },
        createdAt: 1,
      },
    ],

    /* Movers: Swift's rates are cited; the other's cite nothing, so they aren't shown. */
    moveRequests: [
      {
        _id: "mr1",
        userId: "V",
        size: "1br",
        date: "2027-02-01",
        fromNeighborhood: "Mission",
        toNeighborhood: "Noe Valley",
        stairs: true,
        requestedAt: NOW - 5000,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    moverRates: [
      {
        _id: "r1",
        pageId: "M",
        card: { hourly: 120, crew: 2, minHours: 3, truckFee: 50, discounts: [] },
        citations: cited,
        via: "fallback",
        extractedAt: 1,
      },
      {
        _id: "r2",
        pageId: "Seller",
        card: { hourly: 10, crew: 1, minHours: 1, truckFee: 0, discounts: [] },
        via: "fallback",
        extractedAt: 1,
      },
    ],
    moverOutreach: [
      {
        _id: "mo1",
        userId: "V",
        pageId: "M",
        conversationId: "c3",
        proposalId: "p_mover",
        requestedAt: NOW - 5000,
      },
    ],
    messages: [
      {
        _id: "m1",
        conversationId: "c3",
        senderId: "M",
        status: "sent",
        text: "We can do it for $430",
        createdAt: NOW - 3000,
      },
    ],

    /* This weekend's Journey: one stop V can see, one whose source is gone. */
    journeys: [
      {
        _id: "j1",
        userId: "V",
        weekOf: week.weekOf,
        week: week.week,
        startsAt: week.start,
        endsAt: week.end,
        neighborhoodIds: ["neighborhoods:mission"],
        stops: [
          {
            name: "Dolores Park",
            timeOfDay: "morning",
            kind: "park",
            why: "Locals picnic here",
            citations: cited,
          },
          {
            name: "Gone Cafe",
            timeOfDay: "midday",
            kind: "cafe",
            why: "Hidden",
            citations: { first: { kind: "external", externalSourceId: "nope" }, rest: [] },
          },
        ],
        more: [],
        crewIds: [],
        generatedAt: NOW - DAY,
        checkIn: {
          from: NOW - 7 * DAY,
          to: NOW,
          week: activity,
          total: { ...activity, friends: ["A"] },
          computedAt: NOW - DAY,
        },
      },
    ],

    saved: [
      { _id: "sv1", userId: "V", kind: "listing", refId: "L_desk", createdAt: 2 },
      { _id: "sv2", userId: "V", kind: "post", refId: "post1", createdAt: 1 },
      { _id: "sv3", userId: "S", kind: "listing", refId: "L_lamp", createdAt: 1 },
    ],
  };
}

const tool = MINE_TOOLS[0];
type Section = Record<string, unknown> & { items?: Facts[] };

async function about(section: string, viewerId = "V", tables = world()) {
  const ctx = fakeCtx(tables) as unknown as QueryCtx;
  const viewer = tables.users.find((u) => u._id === viewerId);
  if (!viewer) throw new Error(`No user ${viewerId}`);
  const out: ToolOutput = await tool.run(ctx, viewer as never, { about: section });
  return { result: out.result as Section, found: out.found, text: JSON.stringify(out) };
}

const keys = (found: readonly Found[]) => found.map((f) => f.key);
const recall = (kind: keyof typeof RECALL_MINE, id: string, viewerId = "V", tables = world()) =>
  RECALL_MINE[kind](
    fakeCtx(tables) as unknown as QueryCtx,
    tables.users.find((u) => u._id === viewerId) as never,
    id,
  );

describe("get_my_move", () => {
  test("is one tool whose sections are the `about` values", () => {
    expect(MINE_TOOLS.map((t) => t.name)).toEqual(["get_my_move"]);
  });

  test("every found thing is in what Muse reads, under its own key", async () => {
    for (const section of ["crew", "roommates", "drafts", "negotiations"]) {
      const { result, found } = await about(section);
      const read = factsIn(result as never);
      expect(found.length).toBeGreaterThan(0);
      for (const f of found) expect(read.get(f.key)).toEqual(f.facts);
    }
  });

  test("place: the place, the apartment and its spend, and the sublet", async () => {
    const { result, text } = await about("place");
    expect(result.place).toEqual({
      status: "moving_in",
      neighborhood: "mission",
      moveIn: "2027-02-01",
      moveOut: null,
      listing: null,
    });
    expect(result.apartment).toMatchObject({
      model: "ready",
      look: "cozy mid-century",
      furnitureBudget: 1500,
      spent: 0,
      itemCount: 1,
      items: [{ title: "Blue sofa", price: null, stillListed: true }],
    });
    expect(result.sublet).toEqual({
      title: "Sunny room sublet",
      rent: 1700,
      status: "active",
      renterChats: 0,
    });
    expect(text).not.toContain("pl2");
  });

  test("place: nothing chosen yet points at Find", async () => {
    const { result, found } = await about("place", "A");
    expect(result).toMatchObject({ page: "find" });
    expect(result.nothing).toBeString();
    expect(found).toEqual([]);
  });

  test("house: their own house's lists, by first name, and nobody else's", async () => {
    const { result, found, text } = await about("house");
    expect(result.house).toEqual({ name: "Casa Verde", members: ["V", "H"] });
    expect(result.chores).toEqual([
      { title: "Take the bins out", cadence: "weekly", who: "H", done: false },
    ]);
    expect(result.bills).toEqual([
      {
        title: "Internet",
        amount: 65.5,
        due: "2027-02-20",
        cadence: "monthly",
        overdue: false,
        paid: false,
      },
    ]);
    expect(result.groceries).toEqual([{ text: "Oat milk", checked: false }]);
    expect(found).toEqual([]);
    expect(text).not.toContain("S's");
    expect(text).not.toContain("Lastname");
  });

  test("house: none yet", async () => {
    expect((await about("house", "A")).result).toMatchObject({ page: "house" });
  });

  test("crew: the people matched with them, never someone who blocked them", async () => {
    const { result, found } = await about("crew");
    expect(keys(found)).toEqual(["person:A"]);
    expect(result.optedIn).toBe(true);
    expect(found[0].facts).toMatchObject({
      kind: "person",
      id: "A",
      name: "A",
      // A is also one of V's roommate matches.
      roommateMatch: true,
      inYourCrew: true,
    });
    expect((found[0].facts as { inCommon: string[] }).inCommon).toEqual([
      "Also moving in February 2027",
      "Also looking in Mission",
      "Shared interests: Climbing",
    ]);
    expect(found[0].card).toMatchObject({ kind: "person", href: "/a", photo: "/seed/A.jpg" });
  });

  test("crew: not opted in", async () => {
    const { result, found } = await about("crew", "S");
    expect(result).toMatchObject({ page: "crew" });
    expect(found).toEqual([]);
  });

  test("roommates: matches from their network with the page's compatibility", async () => {
    const { result, found, text } = await about("roommates");
    expect(keys(found)).toEqual(["person:A"]);
    expect(result).toMatchObject({ sharing: true, total: 1, page: "roommates" });
    const facts = found[0].facts as Facts & {
      compatibility: { score: number | null; label: string; shared: string[] };
    };
    expect(facts).toMatchObject({
      roommateMatch: true,
      connection: "friend",
      plansInCommon: ["Same move-in month, February 2027", "Both looking in Mission"],
    });
    // Two answers in common is too few for a score; the page says so too.
    expect(facts.compatibility.score).toBeNull();
    expect(facts.compatibility.label).toBe("Not enough answers");
    expect(facts.compatibility.shared).toHaveLength(2);
    // S shares answers too, but isn't in V's network.
    expect(text).not.toContain("person:S");
  });

  test("roommates: answers that aren't shared show no one", async () => {
    const tables = world();
    tables.roommateLifestyles[0] = lifestyle("V", false);
    const { result, found } = await about("roommates", "V", tables);
    expect(result).toMatchObject({ page: "roommates" });
    expect(String(result.nothing)).toContain("aren't shared");
    expect(found).toEqual([]);
    expect((await about("roommates", "H")).result).toMatchObject({ page: "roommates" });
  });

  test("journey: this weekend's stops they can still see, and the check-in", async () => {
    const { result } = await about("journey");
    expect(result.phase).toBe("during");
    expect(result.week).toMatchObject({ number: 2 });
    expect(result.stops).toEqual([
      {
        name: "Dolores Park",
        when: "morning",
        type: "park",
        why: "Locals picnic here",
        over: false,
      },
    ]);
    expect(result.checkIn).toMatchObject({
      daysSinceMoveIn: 9,
      friendsMade: 1,
      eventsGoneTo: 0,
      level: "Explore",
    });
  });

  test("journey: no City Profile, or no move-in date", async () => {
    expect((await about("journey", "H")).result).toMatchObject({ page: "welcome" });
    const tables = world();
    tables.cityProfileFacts = tables.cityProfileFacts.filter(
      (f) => !(f.userId === "V" && f.key === "moveIn"),
    );
    expect((await about("journey", "V", tables)).result).toMatchObject({ page: "profile" });
  });

  test("drafts: only theirs that still wait, each with approve and discard", async () => {
    const { result, found, text } = await about("drafts");
    // The offer expires soonest, so it comes first, as in the Inbox.
    expect(keys(found)).toEqual(["draft:p_offer", "draft:p_msg", "draft:p_event"]);
    expect(result).toMatchObject({ waiting: 3, page: "inbox" });
    const [offer, message, event] = found;
    expect(offer.facts).toMatchObject({
      type: "offer",
      summary: "Offer of $120 on Walnut desk",
      text: "Would you take $120?",
      to: "Seller",
      amount: 120,
      listingKey: "listing:L_desk",
      listedPrice: 180,
    });
    expect(message.facts).toMatchObject({ type: "message", summary: "Message to A" });
    expect(event.facts).toMatchObject({ type: "event", summary: "Event: Crew brunch", to: "A" });
    for (const f of found) {
      expect(f.card?.kind).toBe("draft");
      expect(f.card?.href).toBe("/landing/inbox");
      const id = f.key.slice("draft:".length);
      // A plain message or an offer the chat shows whole can be approved here. An Event has
      // more to it than its text (time, place, invites): that one is approved in the Inbox.
      const here = f !== event;
      expect(f.facts).toMatchObject({ approvable: here });
      expect(f.card?.actions?.map((a) => a.action)).toEqual([
        ...(here ? [{ kind: "approve_draft", proposalId: id }] : []),
        { kind: "discard_draft", proposalId: id },
      ]);
    }
    expect(event.card?.lines).toContain("Read and approve it in your Inbox");
    // The approve button shows exactly what would be sent.
    expect(offer.card?.actions?.[0].detail).toBe("Would you take $120?");
    expect(text).not.toContain("S's private draft");
    expect(text).not.toContain("Too late");
    expect(text).not.toContain("Could you quote my move?");
  });

  test("drafts: contact details and protected traits never reach Muse", async () => {
    const tables = world();
    tables.proposals[0] = proposal("p_msg", "V", {
      kind: "message",
      conversationId: "c1",
      text: "Call me on 415-555-0199 about the room",
    });
    const { found } = await about("drafts", "V", tables);
    const draft = found.find((f) => f.key === "draft:p_msg");
    expect(JSON.stringify(draft)).not.toContain("415-555-0199");
    expect(draft?.facts).toMatchObject({ text: "Call me on … about the room" });
    expect(draft?.facts).toMatchObject({ approvable: false });
    // The chat doesn't show all of it, so it can't approve it: that's for the Inbox.
    expect(draft?.card?.actions?.map((a) => a.action.kind)).toEqual(["discard_draft"]);
    expect(draft?.card?.lines).toContain("Read and approve it in your Inbox");
  });

  test("drafts: a poll is approved in the Inbox, where its question and options show", async () => {
    const tables = world();
    tables.proposals[0] = proposal("p_msg", "V", {
      kind: "message",
      conversationId: "c1",
      text: "Which night works?",
      poll: { question: "Dinner on", options: ["Friday", "Saturday"] },
    });
    const { found } = await about("drafts", "V", tables);
    const draft = found.find((f) => f.key === "draft:p_msg");
    expect(draft?.facts).toMatchObject({ approvable: false });
    expect(draft?.card?.actions?.map((a) => a.action.kind)).toEqual(["discard_draft"]);
  });

  test("negotiations: theirs, with the limits and what they can do next", async () => {
    const { result, found, text } = await about("negotiations");
    // n3's seller blocked V; n2 is S's.
    expect(keys(found)).toEqual(["negotiation:n1"]);
    expect(result).toMatchObject({ count: 1, page: "place" });
    expect(found[0].facts).toMatchObject({
      title: "Walnut desk",
      status: "active",
      maxPrice: 120,
      targetPrice: 100,
      lastOffer: 100,
      lastMove: "offer",
      listedPrice: 180,
      listingKey: "listing:L_desk",
      draftWaiting: true,
      draftKey: "draft:p_offer",
      seller: "Seller",
    });
    expect(found[0].card?.actions?.map((a) => a.action)).toEqual([
      { kind: "set_negotiation", negotiationId: "n1", status: "paused" },
      { kind: "set_negotiation", negotiationId: "n1", status: "stopped" },
    ]);
    expect(text).not.toContain("Brass lamp");
    expect(text).not.toContain("Blocked chair");
  });

  test("negotiations: a paused one can resume or stop; a stopped one can resume", async () => {
    const tables = world();
    tables.negotiations[0].status = "paused";
    const paused = await about("negotiations", "V", tables);
    expect(paused.found[0].card?.actions?.map((a) => a.confirm)).toEqual(["Resume", "Stop"]);
    tables.negotiations[0].status = "stopped";
    const stopped = await about("negotiations", "V", tables);
    expect(stopped.found[0].card?.actions?.map((a) => a.confirm)).toEqual(["Resume"]);
  });

  test("movers: the request and each cited mover's estimate, quote and status", async () => {
    const { result } = await about("movers");
    expect(result.move).toEqual({
      size: "1br",
      date: "2027-02-01",
      from: "Mission",
      to: "Noe Valley",
      stairs: true,
      quotesRequested: true,
    });
    // The mover whose rates cite nothing isn't shown, as on the page.
    expect(result.movers).toHaveLength(1);
    expect((result.movers as Section[])[0]).toMatchObject({
      mover: "Swift Movers",
      status: "replied",
      quoted: 430,
      counterWaiting: false,
    });
    expect((await about("movers", "S")).result).toMatchObject({ page: "place" });
  });

  test("moveout: their sublet and what they own or sell", async () => {
    const { result, text } = await about("moveout");
    expect(result.sublets).toEqual([
      {
        title: "Sunny room sublet",
        rent: 1700,
        lowestRent: 1500,
        status: "active",
        museReplies: "active",
        renterChats: 0,
      },
    ]);
    expect(result.items).toEqual([
      {
        title: "Bookshelf",
        paid: 60,
        forSale: { asking: 80, status: "active" },
        lowestPrice: 40,
        museReplies: "active",
      },
    ]);
    expect(text).not.toContain("S's couch");
    expect((await about("moveout", "A")).result).toMatchObject({ page: "moveout" });
  });

  test("profile: what Landing knows, each fact with where it came from", async () => {
    const { result, text } = await about("profile");
    expect(result.setUp).toBe(true);
    expect(result.facts).toContainEqual({
      about: "Budget",
      value: "Up to $2,400/mo",
      source: "stated",
      from: "You said so in your brief",
    });
    expect((result.facts as unknown[]).length).toBe(4);
    expect(text).not.toContain("Lastname");
    expect((await about("profile", "H")).result).toMatchObject({ page: "welcome" });
  });

  test("saved: only their own saves", async () => {
    const { result, found, text } = await about("saved");
    expect(result.saves).toBe(2);
    for (const k of keys(found)) expect(k).toBe("listing:L_desk");
    expect(text).not.toContain("L_lamp");
  });
});

describe("RECALL_MINE", () => {
  test("a person only if they're a roommate match or in the crew", async () => {
    expect((await recall("person", "A"))?.facts).toMatchObject({ id: "A", roommateMatch: true });
    // A stranger, a housemate and someone who blocked them aren't recalled.
    for (const id of ["S", "H", "B", "Seller", "nobody"])
      expect(await recall("person", id)).toBeNull();
    // A crew member who isn't a roommate match: V stopped sharing answers.
    const tables = world();
    tables.roommateLifestyles[0] = lifestyle("V", false);
    expect((await recall("person", "A", "V", tables))?.facts).toMatchObject({
      roommateMatch: false,
      inYourCrew: true,
    });
  });

  test("a draft only if it's theirs and still waiting", async () => {
    expect((await recall("draft", "p_offer"))?.key).toBe("draft:p_offer");
    expect(await recall("draft", "p_theirs")).toBeNull(); // someone else's
    expect(await recall("draft", "p_old")).toBeNull(); // expired
    expect(await recall("draft", "p_mover")).toBeNull(); // already approved
    expect(await recall("draft", "n1")).toBeNull(); // not a proposal id
    expect((await recall("draft", "p_theirs", "S"))?.key).toBe("draft:p_theirs");
  });

  test("a negotiation only if they're the buyer", async () => {
    expect((await recall("negotiation", "n1"))?.key).toBe("negotiation:n1");
    expect(await recall("negotiation", "n2")).toBeNull();
    expect(await recall("negotiation", "n3")).toBeNull(); // the seller blocked them
    expect(await recall("negotiation", "p_offer")).toBeNull();
    expect((await recall("negotiation", "n2", "S"))?.facts).toMatchObject({ title: "Brass lamp" });
  });
});

describe("viewerHouse", () => {
  const house = (viewerId: string) =>
    viewerHouse(fakeCtx(world()) as unknown as QueryCtx, viewerId as never);
  test("the house they live in, or null", async () => {
    expect(await house("V")).toEqual({ id: "h1", name: "Casa Verde" });
    expect(await house("S")).toEqual({ id: "h2", name: "Their House" });
    expect(await house("A")).toBeNull();
  });
});

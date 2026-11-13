import { describe, expect, test } from "bun:test";
import { furnishAsk, numbersIn, spendIn, vibeProblem } from "../convex/lib/chatText";
import { SF_NEIGHBORHOODS } from "../convex/lib/cityProfileFacts";
import {
  CHAT_HELP,
  CHAT_PAGES,
  type ChatContext,
  type ChatNeighborhood,
  type ChatRental,
  type ChatRentalCard,
  cleanVibe,
  commandSources,
  findNeighborhoods,
  pageHref,
  priceIn,
  replyCards,
  ruleReply,
  validCommand,
} from "../convex/lib/homeChatRules";

const neighborhoods: ChatNeighborhood[] = SF_NEIGHBORHOODS.map((n) => ({
  slug: n.slug,
  name: n.name,
  ...("short" in n ? { aliases: [n.short] } : {}),
}));
const city: ChatContext = { stage: "city" };
const apartmentTab: ChatContext = { stage: "city", view: "apartment" };
const data = { neighborhoods, today: "2026-11-13" };
const built = { ...data, apartment: { hasModel: true } };
const rentals: ChatRental[] = [
  { id: "l1", title: "Sunny room near Dolores", price: 1850, slug: "mission" },
  { id: "l2", title: "Studio by the N Judah", price: 2300, slug: "inner-sunset" },
  { id: "l3", title: "Room in a Victorian", price: 1500, slug: "western-addition" },
];

const cmd = (message: string, ctx: ChatContext = city, d: Parameters<typeof ruleReply>[2] = data) =>
  ruleReply(message, ctx, d).command;

describe("findNeighborhoods", () => {
  test("longer names win and order follows the message", () => {
    expect(findNeighborhoods("Mission Bay or the Mission?", neighborhoods)).toEqual([
      "mission-bay",
      "mission",
    ]);
    expect(findNeighborhoods("noe valley vs soma", neighborhoods)).toEqual([
      "noe-valley",
      "south-of-market",
    ]);
  });
  test("aliases and slash names", () => {
    expect(findNeighborhoods("the Castro", neighborhoods)).toEqual(["castro-upper-market"]);
    expect(findNeighborhoods("near USF", neighborhoods)).toEqual(["lone-mountain-usf"]);
    expect(findNeighborhoods("Dogpatch", neighborhoods)).toEqual(["potrero-hill"]);
  });
  test("whole words only", () => {
    expect(findNeighborhoods("do I need permission", neighborhoods)).toEqual([]);
  });
});

describe("priceIn", () => {
  test("reads dollars, commas and k", () => {
    expect(priceIn("rooms under $2,400")).toBe(2400);
    expect(priceIn("below 2.5k")).toBe(2500);
    expect(priceIn("max $1800 please")).toBe(1800);
    expect(priceIn("under 2")).toBe(2000);
    expect(priceIn("rooms near the park")).toBeUndefined();
  });
});

describe("ruleReply", () => {
  test("in my budget uses the City Profile budget; a stated price wins", () => {
    expect(cmd("rooms in my budget", city, { ...data, budgetMax: 2400 })).toEqual({
      kind: "show_rentals",
      maxPrice: 2400,
    });
    expect(cmd("rooms under $1,600 in my budget", city, { ...data, budgetMax: 2400 })).toEqual({
      kind: "show_rentals",
      maxPrice: 1600,
    });
  });
  test("show me the move", () => {
    expect(cmd("Show me the move")).toEqual({ kind: "show_move" });
  });
  test("a neighborhood name flies there", () => {
    expect(cmd("Hayes Valley")).toEqual({ kind: "fly_neighborhood", slug: "hayes-valley" });
    expect(cmd("take me to SoMa")).toEqual({ kind: "fly_neighborhood", slug: "south-of-market" });
  });
  test("tell me about flies the map; asking for the page opens it", () => {
    expect(cmd("tell me about North Beach")).toEqual({
      kind: "fly_neighborhood",
      slug: "north-beach",
    });
    expect(cmd("open the North Beach page")).toEqual({
      kind: "open_neighborhood_page",
      slug: "north-beach",
    });
  });
  test("compare and vs", () => {
    expect(cmd("compare Mission and Inner Sunset")).toEqual({
      kind: "compare",
      a: "mission",
      b: "inner-sunset",
    });
    expect(cmd("Noe Valley vs. Bernal Heights")).toEqual({
      kind: "compare",
      a: "noe-valley",
      b: "bernal-heights",
    });
    expect(cmd("compare with Marina", { stage: "hood", neighborhood: "mission" })).toEqual({
      kind: "compare",
      a: "mission",
      b: "marina",
    });
  });
  test("weekend route uses the named, current or home neighborhood", () => {
    expect(cmd("weekend route in the Mission")).toEqual({ kind: "weekend_route", slug: "mission" });
    expect(cmd("plan my weekend", { stage: "hood", neighborhood: "marina" })).toEqual({
      kind: "weekend_route",
      slug: "marina",
    });
    expect(cmd("a weekend route", city, { neighborhoods, homeSlugs: ["glen-park"] })).toEqual({
      kind: "weekend_route",
      slug: "glen-park",
    });
    expect(cmd("weekend route")).toEqual({ kind: "none" });
  });
  test("rentals under a price", () => {
    expect(cmd("rooms under $2k")).toEqual({ kind: "show_rentals", maxPrice: 2000 });
    expect(cmd("show me apartments")).toEqual({ kind: "show_rentals" });
    expect(cmd("rentals in Noe Valley")).toEqual({
      kind: "show_pins",
      layer: "homes",
      slug: "noe-valley",
    });
  });
  test("rentals data: counts, names and cites the cheapest", () => {
    const r = ruleReply("rooms under $2,000", city, { neighborhoods, rentals });
    expect(r.command).toEqual({ kind: "show_rentals", maxPrice: 2000 });
    expect(r.text).toContain("2 rentals under $2,000");
    expect(r.text).toContain("Room in a Victorian at $1,500");
    expect(r.sources.some((s) => s.href === "/landing/find/listing/l3")).toBe(true);
    expect(cmd("open the cheapest room", city, { neighborhoods, rentals })).toEqual({
      kind: "open_listing",
      listingId: "l3",
    });
  });
  test("events and groups, with an optional neighborhood", () => {
    expect(cmd("events in the Mission")).toEqual({
      kind: "show_pins",
      layer: "events",
      slug: "mission",
    });
    expect(cmd("what's happening", { stage: "hood", neighborhood: "marina" })).toEqual({
      kind: "show_pins",
      layer: "events",
      slug: "marina",
    });
    expect(cmd("climbing groups")).toEqual({ kind: "show_pins", layer: "groups" });
  });
  test("crew and pages", () => {
    expect(cmd("show my crew")).toEqual({ kind: "show_crew" });
    expect(cmd("anything to approve?")).toEqual({ kind: "open_page", page: "inbox" });
    expect(cmd("open my drafts")).toEqual({ kind: "open_page", page: "inbox" });
    expect(cmd("what do you know about me")).toEqual({ kind: "open_page", page: "profile" });
    expect(cmd("my profile")).toEqual({ kind: "open_page", page: "profile" });
    expect(cmd("sell my stuff")).toEqual({ kind: "open_page", page: "moveout" });
    expect(cmd("I want to sublet my room")).toEqual({ kind: "open_page", page: "moveout" });
    expect(cmd("will my furniture fit")).toEqual({ kind: "open_page", page: "place" });
    expect(cmd("my check-ins")).toEqual({ kind: "open_page", page: "journeys" });
  });
  test("the pages inside My Place, Find and the brief (#150)", () => {
    const page = (m: string) => {
      const c = cmd(m);
      return c.kind === "open_page" ? c.page : c.kind;
    };
    expect(page("find a roommate")).toBe("roommates");
    expect(page("who are my housemates")).toBe("roommates");
    expect(page("whose turn for chores")).toBe("house");
    expect(page("split the bills")).toBe("house");
    expect(page("groceries")).toBe("house");
    expect(page("scan my room")).toBe("room");
    expect(page("add room photos")).toBe("room");
    expect(page("edit layout")).toBe("unit");
    expect(page("open the floor plan")).toBe("unit");
    expect(page("unit editor")).toBe("unit");
    expect(page("all neighborhoods")).toBe("neighborhoods");
    expect(page("show the neighborhoods list")).toBe("neighborhoods");
    expect(page("set up my profile")).toBe("welcome");
    expect(page("redo my brief")).toBe("welcome");
    expect(page("onboarding")).toBe("welcome");
    for (const p of CHAT_PAGES) {
      expect(pageHref(p)).toMatch(/^\/landing(\/|$)/);
      expect(validCommand({ kind: "open_page", page: p }, data)).toBe(true);
      expect(commandSources({ kind: "open_page", page: p }, data)[0]?.href).toBe(pageHref(p));
    }
  });
  test("a stated move plan is answered with rentals in the budget (#150)", () => {
    expect(cmd("I'm moving to SF in January with a $2,400 budget")).toEqual({
      kind: "show_rentals",
      maxPrice: 2400,
    });
    expect(cmd("my budget is 2400 for an apartment", city, { ...data, budgetMax: 2000 })).toEqual({
      kind: "show_rentals",
      maxPrice: 2400,
    });
    expect(cmd("looking in Noe Valley or Bernal")).toEqual({ kind: "show_rentals" });
    expect(cmd("I want to live in the Mission")).toEqual({ kind: "show_rentals" });
    const r = ruleReply("my budget is $1,900", city, { ...data, rentals });
    expect(r.command).toEqual({ kind: "show_rentals", maxPrice: 1900 });
    expect(r.text).toContain("2 rentals under $1,900");
    // Something else asked for wins; the plan is still the server's to save.
    expect(cmd("I want to live in the Mission, what events are on?")).toEqual({
      kind: "show_pins",
      layer: "events",
      slug: "mission",
    });
    // Without a plan, "moving to SF" still shows the move.
    expect(cmd("I'm moving to SF")).toEqual({ kind: "show_move" });
  });
  test("furnishing needs the apartment's 3D model (#150)", () => {
    expect(cmd("make it cozy and warm, under $800", apartmentTab, built)).toEqual({
      kind: "furnish",
      vibe: "make it cozy and warm, under $800",
      budget: 800,
    });
    expect(cmd("furnish my place, mid-century with plants", city, built)).toEqual({
      kind: "furnish",
      vibe: "furnish my place, mid-century with plants",
    });
    expect(cmd("a couch and a rug for my living room", city, built).kind).toBe("furnish");
    // On the Apartment tab a piece of furniture is enough; on the map it isn't.
    expect(cmd("a lamp and a rug", apartmentTab, built).kind).toBe("furnish");
    expect(cmd("a lamp and a rug", city, built).kind).toBe("none");
    // No place yet: rentals to choose from. A place without a model: wait for it.
    const none = ruleReply("decorate it boho", city, { ...data, apartment: null });
    expect(none.command).toEqual({ kind: "show_rentals" });
    expect(none.text).toContain("Choose a place first");
    const building = ruleReply("decorate it boho", city, {
      ...data,
      apartment: { hasModel: false },
    });
    expect(building.command).toEqual({ kind: "show_apartment" });
    expect(building.text).toContain("still being built");
    // Not known (the browser, offline): never furnish blind.
    expect(cmd("decorate it boho").kind).toBe("show_rentals");
    // The reply says the picks are for review, never that anything was bought or placed.
    const r = ruleReply("make it cozy for $800", apartmentTab, built);
    expect(r.text).toContain("for you to review");
    expect(r.text).not.toMatch(/bought|ordered|placed/i);
    expect(r.sources).toEqual([]);
  });
  test("a furnish vibe never carries protected traits or links (#150)", () => {
    const c = cmd("cozy decor for a Muslim woman, under $500", apartmentTab, built);
    expect(c.kind).toBe("furnish");
    if (c.kind !== "furnish") return;
    expect(c.vibe).not.toMatch(/muslim|woman|removed/i);
    expect(c.vibe).toContain("cozy decor");
    expect(c.budget).toBe(500);
    expect(validCommand(c, data)).toBe(true);
    const link = ruleReply("decorate like www.scam-decor.com", apartmentTab, built);
    expect(link.command).toEqual({ kind: "none" });
    expect(link.text).toContain("Describe the vibe");
  });
  test("searches and neighborhood questions are not furnish requests (#150)", () => {
    expect(cmd("what's the vibe in the Mission", city, built)).toEqual({
      kind: "fly_neighborhood",
      slug: "mission",
    });
    expect(cmd("cozy studios under $2,000", city, built)).toEqual({
      kind: "show_rentals",
      maxPrice: 2000,
    });
    expect(cmd("furnished apartments", city, built)).toEqual({ kind: "show_rentals" });
    expect(cmd("will my furniture fit", apartmentTab, built)).toEqual({
      kind: "open_page",
      page: "place",
    });
  });
  test("show my apartment switches to the Apartment tab (#150)", () => {
    for (const m of ["show my apartment", "my place in 3D", "show me the model", "show my place"])
      expect(cmd(m, city, built)).toEqual({ kind: "show_apartment" });
    expect(ruleReply("show my apartment", city, built).sources).toEqual([
      { label: "Your place", href: "/landing/place" },
    ]);
    const none = ruleReply("show my apartment", city, { ...data, apartment: null });
    expect(none.command).toEqual({ kind: "show_rentals" });
    expect(none.text).toContain("haven't chosen a place");
    // "My place" alone still opens the page.
    expect(cmd("my place", city, built)).toEqual({ kind: "open_page", page: "place" });
  });
  test("the help line mentions furnishing", () => {
    expect(CHAT_HELP).toMatch(/furnish/);
  });
  test("unknown asks get the help line", () => {
    const r = ruleReply("hello there", city, data);
    expect(r.command).toEqual({ kind: "none" });
    expect(r.text).toContain("Try");
    expect(r.via).toBe("rules");
  });
  test("protected traits never steer and get a plain answer", () => {
    const r = ruleReply("where do people of my religion live", city, data);
    expect(r.command).toEqual({ kind: "none" });
    expect(r.text).toContain("never picks places by who lives there");
  });
  test("sources link the page or neighborhood", () => {
    expect(ruleReply("Mission vs Marina", city, data).sources[0]?.href).toBe(
      "/landing/find/neighborhoods/compare?a=mission&b=marina",
    );
    expect(ruleReply("Glen Park", city, data).sources[0]?.href).toBe(
      "/landing/find/neighborhoods/glen-park",
    );
    expect(ruleReply("inbox", city, data).sources[0]?.href).toBe("/landing/inbox");
  });
  test("every rule command passes validCommand", () => {
    for (const m of [
      "show me the move",
      "Hayes Valley",
      "Mission vs Marina",
      "weekend in Noe Valley",
      "rooms under $1,900",
      "events in SoMa",
      "my crew",
      "inbox",
      "hello",
      "find a roommate",
      "show my apartment",
      "my budget is $2,400",
    ])
      expect(validCommand(cmd(m), { neighborhoods })).toBe(true);
    expect(validCommand(cmd("make it cozy for $800", apartmentTab, built), data)).toBe(true);
  });
  test("the browser's reply carries no saved facts, and cards only when given the ranked ones", () => {
    const r = ruleReply("rooms under $2,000", city, { neighborhoods, rentals });
    expect(r.saved).toEqual([]);
    expect(r.rentals).toEqual([]);
    const cards = rentals.map((x) => card(x.id, x.price));
    const withCards = ruleReply("rooms under $2,000", city, { neighborhoods, rentals, cards });
    // The cheapest (cited) first, then ranked order within the price.
    expect(withCards.rentals.map((c) => c.id)).toEqual(["l3", "l1"]);
  });
});

const card = (id: string, price: number): ChatRentalCard => ({
  id,
  title: `Rental ${id}`,
  price,
  photo: null,
  neighborhood: null,
  reasons: [],
});

describe("replyCards", () => {
  const cards = [1800, 2600, 1500, 1900, 2000, 1700].map((p, i) => card(`c${i}`, p));
  test("cited rentals first, then the top ranked within the price, at most four", () => {
    expect(
      replyCards({ kind: "show_rentals", maxPrice: 2000 }, ["c4"], cards).map((c) => c.id),
    ).toEqual(["c4", "c0", "c2", "c3"]);
    expect(replyCards({ kind: "show_rentals" }, [], cards).map((c) => c.id)).toEqual([
      "c0",
      "c1",
      "c2",
      "c3",
    ]);
  });
  test("other commands show only what the reply cites, and only cards it was given", () => {
    expect(replyCards({ kind: "open_listing", listingId: "c1" }, ["c1", "c1"], cards)).toEqual([
      cards[1],
    ]);
    expect(replyCards({ kind: "show_move" }, [], cards)).toEqual([]);
    expect(replyCards({ kind: "show_rentals" }, ["made-up"], [])).toEqual([]);
    expect(replyCards({ kind: "none" }, ["made-up", "c9"], cards)).toEqual([]);
  });
});

describe("furnish text helpers", () => {
  test("cleanVibe and vibeProblem", () => {
    expect(cleanVibe("  warm   and\ncozy  ")).toBe("warm and cozy");
    expect(cleanVibe("x".repeat(400))).toHaveLength(200);
    expect(cleanVibe("")).toBeNull();
    expect(cleanVibe("email me at a@b.co")).toBeNull();
    expect(cleanVibe("call 415-555-1212")).toBeNull();
    expect(vibeProblem("warm and cozy")).toBeNull();
    expect(vibeProblem("  ")).not.toBeNull();
    expect(vibeProblem("x".repeat(201))).not.toBeNull();
    expect(vibeProblem("see www.example.com")).not.toBeNull();
    expect(vibeProblem("a room for a Christian family")).not.toBeNull();
  });
  test("spendIn reads a furniture budget as written", () => {
    expect(spendIn("cozy, under $800")).toBe(800);
    expect(spendIn("a $50 lamp")).toBe(50);
    expect(spendIn("budget of 1.5k")).toBe(1500);
    expect(spendIn("around 600 dollars")).toBe(600);
    expect(spendIn("two chairs")).toBeUndefined();
    expect(spendIn("under $250,000")).toBeUndefined();
  });
  test("numbersIn normalises how an amount is written", () => {
    expect(numbersIn("2.5k")).toContain(2500);
    expect(numbersIn("$2,500")).toContain(2500);
    expect(numbersIn("2500 dollars")).toContain(2500);
    expect(numbersIn("about 2.5")).toContain(2500);
    expect(numbersIn("no amount")).toEqual([]);
  });
  test("furnishAsk", () => {
    expect(furnishAsk("furnish it")).toBe(true);
    expect(furnishAsk("make it cozy")).toBe(true);
    expect(furnishAsk("a desk", { view: "apartment" })).toBe(true);
    expect(furnishAsk("a desk")).toBe(false);
    expect(furnishAsk("furnished rooms")).toBe(false);
  });
});

describe("validCommand", () => {
  const d = { neighborhoods, listingIds: ["l1"] };
  test("rejects unknown slugs and listing ids", () => {
    expect(validCommand({ kind: "fly_neighborhood", slug: "atlantis" }, d)).toBe(false);
    expect(validCommand({ kind: "fly_neighborhood", slug: "mission" }, d)).toBe(true);
    expect(validCommand({ kind: "open_listing", listingId: "l1" }, d)).toBe(true);
    expect(validCommand({ kind: "open_listing", listingId: "l9" }, d)).toBe(false);
    expect(validCommand({ kind: "open_listing", listingId: "l1" }, { neighborhoods })).toBe(false);
    expect(validCommand({ kind: "show_pins", layer: "events", slug: "nowhere" }, d)).toBe(false);
  });
  test("compare needs two different known slugs", () => {
    expect(validCommand({ kind: "compare", a: "mission", b: "mission" }, d)).toBe(false);
    expect(validCommand({ kind: "compare", a: "mission", b: "marina" }, d)).toBe(true);
  });
  test("prices must be sane", () => {
    expect(validCommand({ kind: "show_rentals", maxPrice: -5 }, d)).toBe(false);
    expect(validCommand({ kind: "show_rentals", maxPrice: 2400 }, d)).toBe(true);
  });
  test("furnish needs a clean vibe and a whole-dollar budget (#150)", () => {
    const furnish = (vibe: string, budget?: number) =>
      validCommand({ kind: "furnish", vibe, ...(budget === undefined ? {} : { budget }) }, d);
    expect(furnish("warm and cozy")).toBe(true);
    expect(furnish("warm and cozy", 800)).toBe(true);
    expect(furnish("warm and cozy", 100_000)).toBe(true);
    expect(furnish("")).toBe(false);
    expect(furnish("x".repeat(201))).toBe(false);
    expect(furnish("decor for Muslim women")).toBe(false);
    expect(furnish("see scam.example.com")).toBe(false);
    expect(furnish("warm", 0)).toBe(false);
    expect(furnish("warm", 100_001)).toBe(false);
    expect(furnish("warm", 99.5)).toBe(false);
    expect(validCommand({ kind: "show_apartment" }, d)).toBe(true);
  });
});

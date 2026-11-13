import { describe, expect, test } from "bun:test";
import { SF_NEIGHBORHOODS } from "../convex/lib/cityProfileFacts";
import {
  type ChatContext,
  type ChatNeighborhood,
  type ChatRental,
  findNeighborhoods,
  priceIn,
  ruleReply,
  validCommand,
} from "../src/landing/home/chatRules";

const neighborhoods: ChatNeighborhood[] = SF_NEIGHBORHOODS.map((n) => ({
  slug: n.slug,
  name: n.name,
  ...("short" in n ? { aliases: [n.short] } : {}),
}));
const city: ChatContext = { stage: "city" };
const data = { neighborhoods };
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
    expect(cmd("find a roommate")).toEqual({ kind: "open_page", page: "place" });
    expect(cmd("will my furniture fit")).toEqual({ kind: "open_page", page: "place" });
    expect(cmd("my check-ins")).toEqual({ kind: "open_page", page: "journeys" });
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
    ])
      expect(validCommand(cmd(m), { neighborhoods })).toBe(true);
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
});

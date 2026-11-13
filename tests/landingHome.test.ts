import { describe, expect, test } from "bun:test";
import { type ChatRentalCard, ruleReply } from "../convex/lib/homeChatRules";
import { suggestions } from "../src/landing/home/suggestions";
import {
  CHAT_ITEMS_MAX,
  type ChatMessage,
  readSessions,
  storedMessage,
} from "../src/landing/home/useChatLog";
import { defaultMoveIn } from "../src/landing/place/placeParts";

/* Landing Home (#150): the chat log kept in the browser, the move-in date a
   rental card starts on, and the suggestion chips. */

describe("defaultMoveIn", () => {
  const today = "2026-11-13";
  test("the later of the day it's available and today", () => {
    expect(defaultMoveIn({ today })).toBe(today);
    expect(defaultMoveIn({ today, available: "2026-12-02" })).toBe("2026-12-02");
    expect(defaultMoveIn({ today, available: "2026-10-01" })).toBe(today);
    expect(defaultMoveIn({ today, available: null })).toBe(today);
  });
  test("the City Profile's date wins when the rental is available by then", () => {
    const stated = { month: "2027-01", date: "2027-01-15" };
    expect(defaultMoveIn({ today, available: "2026-12-02", stated })).toBe("2027-01-15");
    // Only a month: its first day.
    expect(defaultMoveIn({ today, stated: { month: "2027-01" } })).toBe("2027-01-01");
  });
  test("a stated date that's past, too early or too far off is not used", () => {
    expect(defaultMoveIn({ today, stated: { month: "2026-10", date: "2026-10-28" } })).toBe(today);
    expect(defaultMoveIn({ today, available: "2027-02-01", stated: { month: "2027-01" } })).toBe(
      "2027-02-01",
    );
    expect(defaultMoveIn({ today, stated: { month: "2031-01" } })).toBe(today);
    expect(defaultMoveIn({ today, stated: { month: "soon" } })).toBe(today);
  });
});

const rental = (id: string, reasons = 3): ChatRentalCard => ({
  id,
  title: `Room ${id}`,
  price: 1500,
  photo: null,
  neighborhood: "Mission",
  reasons: Array.from({ length: reasons }, (_, i) => ({
    text: `Reason ${i}`,
    sources: Array.from({ length: 5 }, (_, j) => ({ label: `Source ${j}`, href: `/s/${j}` })),
  })),
});

describe("the stored chat log", () => {
  test("cards are capped before they're kept", () => {
    const m: ChatMessage = {
      id: "m1",
      who: "muse",
      text: "x".repeat(5000),
      via: "rules",
      command: { kind: "show_rentals", maxPrice: 2400 },
      saved: Array.from({ length: 20 }, (_, i) => `Fact ${i}`),
      rentals: Array.from({ length: 9 }, (_, i) => rental(`l${i}`)),
      items: Array.from({ length: 30 }, (_, i) => ({
        itemId: `i${i}`,
        listingId: `l${i}` as never,
        title: "Lamp",
        price: 15,
        photo: null,
        kind: "lamp" as const,
        reason: "Cozy",
      })),
      tally: { total: 450, spent: 980, budget: 1500 },
    };
    const kept = storedMessage(m);
    expect(kept.text).toHaveLength(2000);
    expect(kept.rentals).toHaveLength(4);
    expect(kept.rentals?.[0].reasons).toHaveLength(2);
    expect(kept.rentals?.[0].reasons[0].sources).toHaveLength(3);
    expect(kept.items).toHaveLength(CHAT_ITEMS_MAX);
    expect(kept.saved).toHaveLength(6);
    expect(kept.tally).toEqual({ total: 450, spent: 980, budget: 1500 });
    expect(kept.command).toEqual({ kind: "show_rentals", maxPrice: 2400 });
    // A plain message stays plain.
    expect(storedMessage({ id: "m2", who: "me", text: "hi" })).toEqual({
      id: "m2",
      who: "me",
      text: "hi",
    });
  });

  test("a chat from before cards existed loads as it was", () => {
    const old = [
      {
        id: "s1",
        title: "Rooms in my budget",
        updatedAt: 5,
        messages: [
          { id: "a", who: "muse", text: "Ask me anything." },
          { id: "b", who: "me", text: "Rooms in my budget" },
          {
            id: "c",
            who: "muse",
            text: "Showing rentals.",
            via: "rules",
            sources: [{ label: "Find a place", href: "/landing/find" }],
            command: { kind: "show_rentals", maxPrice: 2000 },
          },
        ],
      },
    ];
    expect(readSessions(JSON.stringify(old))).toEqual(old as never);
  });

  test("what isn't a chat, a message or a card is dropped, never thrown on", () => {
    expect(readSessions(null)).toEqual([]);
    expect(readSessions("{not json")).toEqual([]);
    expect(readSessions('{"id":"s"}')).toEqual([]);
    const raw = JSON.stringify([
      null,
      { id: "empty", messages: [] },
      {
        id: "s1",
        messages: [
          "nope",
          { id: "a", who: "them", text: "?" },
          {
            id: "b",
            who: "muse",
            text: "Here.",
            via: "someone",
            command: "show_move",
            rentals: [{ id: "l1" }, rental("l2", 1)],
            items: "lamp",
            saved: [1, "Budget up to $2,400/mo"],
            tally: { total: "a lot" },
          },
        ],
      },
    ]);
    expect(readSessions(raw)).toEqual([
      {
        id: "s1",
        title: "Chat",
        updatedAt: 0,
        messages: [
          {
            id: "b",
            who: "muse",
            text: "Here.",
            rentals: [rental("l2", 1)],
            saved: ["Budget up to $2,400/mo"],
          },
        ],
      },
    ]);
  });
});

describe("suggestions", () => {
  const go = {
    apartment: () => undefined,
    nearPlace: () => undefined,
    neighborhood: () => undefined,
    compare: () => undefined,
    find: () => undefined,
    brief: () => undefined,
  };
  const base = { last: undefined, needsBrief: false, name: (s: string) => s, go };
  const labels = (s: Parameters<typeof suggestions>[0]) => suggestions(s).map((c) => c.label);

  test("the Apartment tab follows the person's place, its model and what's in it", () => {
    const at = (apartment: { place: boolean; model: boolean; items: number } | undefined) =>
      labels({ ...base, view: "apartment", apartment });
    expect(at(undefined)).toEqual([]);
    expect(at({ place: false, model: false, items: 0 })).toContain("Rooms in my budget");
    expect(at({ place: true, model: false, items: 0 })).toContain("Show me events near my place");
    expect(at({ place: true, model: true, items: 0 })[0]).toBe(
      "Make it cozy and warm under $1,500",
    );
    expect(at({ place: true, model: true, items: 3 })).toEqual([
      "Add a reading lamp",
      "Add a rug under $200",
      "Show me events near my place",
    ]);
  });

  test("with AI off, Landing's rules furnish from every furnishing chip", () => {
    const chips = [
      ...suggestions({
        ...base,
        view: "apartment",
        apartment: { place: true, model: true, items: 0 },
      }),
      ...suggestions({
        ...base,
        view: "apartment",
        apartment: { place: true, model: true, items: 2 },
      }).filter((c) => !c.run),
    ];
    expect(chips.length).toBe(5);
    for (const c of chips) {
      const reply = ruleReply(
        c.label,
        { stage: "city", view: "apartment" },
        { neighborhoods: [], apartment: { hasModel: true }, today: "2026-11-13" },
      );
      expect([c.label, reply.command.kind]).toEqual([c.label, "furnish"]);
    }
  });

  test("the map offers the apartment once there is a place", () => {
    const withPlace = { place: true, model: true, items: 0 };
    expect(labels({ ...base, view: "map", apartment: withPlace })).toContain("Open my apartment");
    expect(labels({ ...base, view: "map", apartment: undefined })).not.toContain(
      "Open my apartment",
    );
    expect(
      labels({
        ...base,
        view: "map",
        apartment: withPlace,
        last: { kind: "weekend_route", slug: "mission" },
        name: () => "Mission",
      }),
    ).toEqual(["Events in Mission", "Groups in Mission", "Open Mission"]);
    expect(labels({ ...base, view: "map", apartment: undefined, needsBrief: true })[0]).toBe(
      "Set up my City Profile",
    );
  });
});

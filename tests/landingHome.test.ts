import { describe, expect, test } from "bun:test";
import { approveDraftAction, joinGroupAction, rsvpAction } from "../convex/lib/homeChatActions";
import {
  CHAT_ACTION_KINDS,
  CHAT_ACTIONS_MAX,
  CHAT_INFO_CARDS_MAX,
  CHAT_SHOWN_MAX,
  type ChatAction,
  type ChatActionCard,
  type ChatCard,
  type ChatRentalCard,
  ruleReply,
} from "../convex/lib/homeChatRules";
import { suggestions } from "../src/landing/home/suggestions";
import {
  actionKey,
  CHAT_ITEMS_MAX,
  type ChatMessage,
  readAction,
  readSessions,
  shownKeys,
  storedMessage,
  viaLabel,
} from "../src/landing/home/useChatLog";
import { defaultMoveIn } from "../src/landing/place/placeParts";

/* Landing Home (#150, #154): the chat log kept in the browser (cards, the
   actions Muse suggests and what became of them), the move-in date a rental
   card starts on, and the suggestion chips. */

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

  test("a reply keeps why the rules answered and the things it added; older chats have neither (#153)", () => {
    const m: ChatMessage = {
      id: "m1",
      who: "muse",
      text: "Looking on Marketplace for a lamp.",
      via: "rules",
      why: "busy",
      command: { kind: "add_items", items: ["lamp"], want: "reading", budget: 120 },
    };
    expect(storedMessage(m)).toEqual(m);
    const raw = JSON.stringify([
      {
        id: "s1",
        title: "Lamp",
        updatedAt: 5,
        messages: [
          m,
          { id: "m2", who: "muse", text: "Offline.", via: "rules", why: "offline" },
          // From before #153: no reason, and a reason this build doesn't know is dropped.
          { id: "m3", who: "muse", text: "Old.", via: "rules" },
          { id: "m4", who: "muse", text: "Odd.", via: "rules", why: "asleep" },
        ],
      },
    ]);
    const [session] = readSessions(raw);
    expect(session.messages.map((x) => x.why)).toEqual(["busy", "offline", undefined, undefined]);
    expect(session.messages[0].command).toEqual(m.command);
  });

  test("the label under a reply says why the rules answered only when it knows (#153)", () => {
    expect(viaLabel({ via: "muse" })).toBe("Answered by Muse");
    expect(viaLabel({ via: "landing" })).toBe("From Landing");
    expect(viaLabel({ via: "rules", why: "off" })).toBe("Answered by Landing's rules (AI off)");
    expect(viaLabel({ via: "rules", why: "busy" })).toBe(
      "Answered by Landing's rules (Muse is busy)",
    );
    expect(viaLabel({ via: "rules", why: "offline" })).toBe(
      "Answered by Landing's rules (offline)",
    );
    // Muse's answer was set aside, or a chat stored before the reason was: no parenthesis.
    expect(viaLabel({ via: "rules", why: "unsure" })).toBe("Answered by Landing's rules");
    expect(viaLabel({ via: "rules" })).toBe("Answered by Landing's rules");
    // A reason never changes Muse's own label.
    expect(viaLabel({ via: "muse", why: "off" })).toBe("Answered by Muse");
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

/* ---------- What Muse found and suggests (#154) ---------- */

const eventCard = (id: string, more: Partial<ChatCard> = {}): ChatCard => ({
  key: `event:${id}`,
  kind: "event",
  title: `Event ${id}`,
  lines: ["Sat, Nov 16 · 8 AM", "Dolores Park", "12 going"],
  photo: "/seed/e.jpg",
  href: `/events/${id}`,
  point: { lat: 37.76, lng: -122.43 },
  actions: [rsvpAction({ id, title: `Event ${id}`, startsAt: "2026-11-16T16:00:00Z" }, "going")],
  ...more,
});

/** One valid action of every kind the page can run. */
const ACTIONS: ChatAction[] = [
  { kind: "rsvp", eventId: "e1", status: "interested" },
  { kind: "join_group", groupId: "g1" },
  { kind: "save_listing", listingId: "l1" },
  { kind: "choose_place", listingId: "l1", moveIn: "2026-12-01" },
  { kind: "negotiate", listingId: "l2", maxPrice: 120, targetPrice: 90, notes: "Pickup only" },
  { kind: "set_negotiation", negotiationId: "n1", status: "paused" },
  { kind: "approve_draft", proposalId: "p1" },
  { kind: "discard_draft", proposalId: "p1" },
  { kind: "add_grocery", houseId: "h1", text: "Oat milk" },
  { kind: "add_chore", houseId: "h1", title: "Take out the bins", cadence: "weekly" },
  { kind: "add_bill", houseId: "h1", title: "Internet", amount: 59.99, cadence: "monthly" },
  { kind: "ask_roommate", userId: "u1", text: "Hi! Want to compare notes on the Mission?" },
];

describe("the stored chat log: cards and actions", () => {
  const action = (a: ChatAction): ChatActionCard => ({ action: a, label: "Do it", confirm: "OK" });
  const stored = (messages: unknown[]) =>
    readSessions(JSON.stringify([{ id: "s1", title: "Chat", updatedAt: 1, messages }]))[0]
      ?.messages;

  test("cards and actions round-trip, with what became of each action", () => {
    const approve = approveDraftAction({
      id: "p1",
      summary: "Offer of $120",
      text: "Would $120 work?",
    });
    const m: ChatMessage = {
      id: "m1",
      who: "muse",
      text: "Here's what's on, and a draft that's waiting.",
      via: "muse",
      cards: [
        eventCard("e1"),
        { key: "place:dolores", kind: "place", title: "Dolores Park", lines: [] },
      ],
      actions: [approve, joinGroupAction({ id: "g1", name: "Mission Runners" })],
      outcomes: {
        [actionKey(approve.action)]: "done",
        "join_group:g1": "dismissed",
        [actionKey(eventCard("e1").actions?.[0].action as ChatAction)]: "done",
      },
    };
    const kept = storedMessage(m);
    expect(kept).toEqual(m);
    expect(stored([JSON.parse(JSON.stringify(kept))])).toEqual([m]);
  });

  test("they are capped before they're kept", () => {
    const kept = storedMessage({
      id: "m1",
      who: "muse",
      text: "Lots.",
      cards: Array.from({ length: 20 }, (_, i) =>
        eventCard(`e${i}`, {
          title: "t".repeat(500),
          lines: Array.from({ length: 9 }, (_, j) => `${j}`.repeat(400)),
          actions: ACTIONS.slice(0, 5).map(action),
        }),
      ),
      actions: ACTIONS.map((a) => ({
        action: a,
        label: "l".repeat(900),
        detail: "d".repeat(5000),
        confirm: "OK",
      })),
    });
    expect(kept.cards).toHaveLength(CHAT_INFO_CARDS_MAX);
    expect(kept.cards?.[0].title).toHaveLength(160);
    expect(kept.cards?.[0].lines).toHaveLength(3);
    expect(kept.cards?.[0].lines[0]).toHaveLength(160);
    expect(kept.cards?.[0].actions).toHaveLength(2);
    expect(kept.actions).toHaveLength(CHAT_ACTIONS_MAX);
    expect(kept.actions?.[0].label).toHaveLength(200);
    expect(kept.actions?.[0].detail).toHaveLength(1000);
  });

  test("every kind of action reads back exactly, without extra fields", () => {
    expect(ACTIONS.map((a) => a.kind).sort()).toEqual([...CHAT_ACTION_KINDS].sort());
    for (const a of ACTIONS) {
      expect(readAction(JSON.parse(JSON.stringify(a)))).toEqual(a);
      expect(readAction({ ...a, viewerId: "someone-else", extra: { nested: true } })).toEqual(a);
    }
    // Two actions on the same thing are told apart; the same action is the same key.
    expect(new Set(ACTIONS.map(actionKey)).size).toBe(ACTIONS.length);
    expect(actionKey({ kind: "rsvp", eventId: "e1", status: "going" })).not.toBe(
      actionKey({ kind: "rsvp", eventId: "e1", status: "interested" }),
    );
  });

  test("a malformed or unknown action is dropped: a stored action runs on a click", () => {
    const bad: unknown[] = [
      null,
      "rsvp",
      { kind: "delete_everything", id: "x" },
      { kind: "rsvp", eventId: "e1", status: "none" },
      { kind: "rsvp", eventId: 7, status: "going" },
      { kind: "join_group" },
      { kind: "join_group", groupId: "" },
      { kind: "choose_place", listingId: "l1", moveIn: "next month" },
      { kind: "negotiate", listingId: "l1", maxPrice: "120" },
      { kind: "negotiate", listingId: "l1", maxPrice: Number.NaN },
      { kind: "negotiate", listingId: "l1", maxPrice: 120, targetPrice: "90" },
      { kind: "set_negotiation", negotiationId: "n1", status: "deleted" },
      { kind: "approve_draft", proposalId: ["p1"] },
      { kind: "add_chore", houseId: "h1", title: "Bins", cadence: "daily" },
      { kind: "add_bill", houseId: "h1", title: "Internet", amount: 60, cadence: "weekly" },
      {
        kind: "add_bill",
        houseId: "h1",
        title: "Internet",
        amount: 60,
        cadence: "once",
        dueDate: 5,
      },
      { kind: "ask_roommate", userId: "u1" },
    ];
    for (const b of bad) expect([b, readAction(b)]).toEqual([b, null]);

    const read = stored([
      {
        id: "m1",
        who: "muse",
        text: "Here.",
        actions: [
          action({ kind: "join_group", groupId: "g1" }),
          { action: { kind: "join_group", groupId: "g2" }, label: "No button" },
          { action: { kind: "wire_money", to: "x" }, label: "Send", confirm: "Send" },
          "join",
        ],
        cards: [
          eventCard("e1", {
            actions: [
              action({ kind: "rsvp", eventId: "e1", status: "going" }),
              { action: null } as never,
            ],
          }),
          { key: "thing:1", kind: "thing", title: "Unknown kind", lines: [] },
          { key: "event:e2", kind: "event", lines: [] },
          {
            key: "event:e3",
            kind: "event",
            title: "Bad point",
            lines: [],
            point: { lat: "x", lng: 1 },
          },
          { key: "event:e4", kind: "event", title: "Bad lines", lines: "soon" },
          { key: "place:p1", kind: "place", title: "Twin Peaks", lines: [1, "Viewpoint", null] },
        ],
        outcomes: { "join_group:g1": "done", "join_group:g2": "done", "rsvp:e1:going": "maybe" },
      },
    ]);
    expect(read).toEqual([
      {
        id: "m1",
        who: "muse",
        text: "Here.",
        cards: [
          eventCard("e1", { actions: [action({ kind: "rsvp", eventId: "e1", status: "going" })] }),
          { key: "place:p1", kind: "place", title: "Twin Peaks", lines: ["Viewpoint"] },
        ],
        actions: [action({ kind: "join_group", groupId: "g1" })],
        // Only an outcome of an action the turn still carries is kept.
        outcomes: { "join_group:g1": "done" },
      },
    ]);
  });

  test("a turn goes back to Muse with the keys of what it showed", () => {
    expect(shownKeys({})).toEqual([]);
    expect(
      shownKeys({
        rentals: [rental("l1"), rental("l2")],
        cards: [
          eventCard("e1"),
          eventCard("e1"),
          { key: "listing:l1", kind: "item", title: "Desk", lines: [] },
        ],
      }),
    ).toEqual(["listing:l1", "listing:l2", "event:e1"]);
    expect(
      shownKeys({ cards: Array.from({ length: 30 }, (_, i) => eventCard(`e${i}`)) }),
    ).toHaveLength(CHAT_SHOWN_MAX);
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

  test("with AI off, Landing's rules furnish or add from every furnishing chip (#153)", () => {
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
    const commands = chips.map((c) => [
      c.label,
      ruleReply(
        c.label,
        { stage: "city", view: "apartment" },
        { neighborhoods: [], apartment: { hasModel: true }, today: "2026-11-13" },
      ).command,
    ]);
    // A look furnishes the whole apartment; a chip that names things adds only those.
    expect(commands).toEqual([
      [
        "Make it cozy and warm under $1,500",
        { kind: "furnish", vibe: "cozy and warm", budget: 1500 },
      ],
      [
        "A minimal, bright style under $1,000",
        { kind: "furnish", vibe: "A minimal, bright style", budget: 1000 },
      ],
      ["Add a desk and a lamp", { kind: "add_items", items: ["desk", "lamp"] }],
      ["Add a reading lamp", { kind: "add_items", items: ["lamp"], want: "reading" }],
      ["Add a rug under $200", { kind: "add_items", items: ["rug"], budget: 200 }],
    ]);
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

  test("the map shows what Muse can reach: drafts waiting, what's on, things for their place", () => {
    const withPlace = { place: true, model: true, items: 0 };
    expect(labels({ ...base, view: "map", apartment: undefined })).toEqual([
      "Show me the move",
      "Rooms in my budget",
      "What's happening this week?",
    ]);
    expect(labels({ ...base, view: "map", apartment: undefined, waiting: 2 })[2]).toBe(
      "What's waiting for my approval?",
    );
    expect(labels({ ...base, view: "map", apartment: withPlace })).toEqual([
      "What's happening this week?",
      "Marketplace finds for my place",
      "Open my apartment",
    ]);
    expect(labels({ ...base, view: "map", apartment: withPlace, waiting: 1 })[0]).toBe(
      "What's waiting for my approval?",
    );
    // Never more than three chips, whatever the state.
    for (const waiting of [0, 3])
      for (const apartment of [undefined, withPlace])
        for (const view of ["map", "apartment"] as const)
          expect(labels({ ...base, view, apartment, waiting }).length).toBeLessThanOrEqual(3);
  });

  test("with AI off, Landing's rules still answer the new chips", () => {
    const rules = (text: string) =>
      ruleReply(
        text,
        { stage: "city", view: "map" },
        { neighborhoods: [], apartment: { hasModel: true }, today: "2026-11-13" },
      ).command;
    expect(rules("What's waiting for my approval?")).toEqual({ kind: "open_page", page: "inbox" });
    expect(rules("What's happening this week?")).toEqual({ kind: "show_pins", layer: "events" });
    expect(rules("Marketplace finds for my place").kind).not.toBe("none");
  });
});

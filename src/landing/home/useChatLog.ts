import { useCallback, useEffect, useRef, useState } from "react";
import type { FurnishReply } from "../../../convex/apartment";
import type { RulesWhy } from "../../../convex/lib/chatText";
import {
  CHAT_ACTIONS_MAX,
  CHAT_CARD_KINDS,
  CHAT_CARDS_MAX,
  CHAT_INFO_CARDS_MAX,
  CHAT_SHOWN_MAX,
  type ChatAction,
  type ChatActionCard,
  type ChatCard,
  type ChatCommand,
  type ChatRentalCard,
  type ChatSource,
} from "../../../convex/lib/homeChatRules";

/** A Marketplace item Muse placed in the apartment, as a card under the reply. */
export type ChatItemCard = FurnishReply["items"][number];
/**
 * What a furnish reply's items cost, what is placed in all, and the
 * apartment's furniture budget: always the overall one (#153), null with none.
 */
export type ChatTally = { total: number; spent: number; budget: number | null };
/**
 * Why Landing's rules answered (#153), as the server said, or `offline`: the
 * browser's own rules answered because the server couldn't be reached.
 */
export type ChatWhy = RulesWhy | "offline";
const WHYS: readonly string[] = ["off", "busy", "unsure", "offline"] satisfies ChatWhy[];
/** What became of an action the chat offered: the person ran it, or said "Not now". */
export type ActionOutcome = "done" | "dismissed";

export type ChatMessage = {
  id: string;
  who: "me" | "muse";
  text: string;
  sources?: ChatSource[];
  /**
   * How a reply was made: the model, Landing's rules (AI off, or the model's
   * answer rejected), or `landing`: a line the page wrote itself after
   * something the person did (they chose a place).
   */
  via?: "muse" | "rules" | "landing";
  /** Why the rules answered. Chats stored before #153 have none. */
  why?: ChatWhy;
  command?: ChatCommand;
  /** What the message added to the City Profile. */
  saved?: string[];
  /** Rentals to choose from. */
  rentals?: ChatRentalCard[];
  /** Items placed in the apartment, with their running total. */
  items?: ChatItemCard[];
  tally?: ChatTally;
  /** What else Muse found: items, Events, Groups, places, neighborhoods, drafts. */
  cards?: ChatCard[];
  /** What Muse suggests doing. Each runs only on the person's click. */
  actions?: ChatActionCard[];
  /**
   * What became of this turn's actions (suggested, or on a card), by
   * `actionKey`: a reload doesn't offer again what was done or dismissed.
   */
  outcomes?: Record<string, ActionOutcome>;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

/** What one browser keeps: this many chats, messages per chat and cards per message. */
const MAX_SESSIONS = 30;
const MAX_MESSAGES = 80;
export const CHAT_ITEMS_MAX = 12;
const SAVED_MAX = 6;
const SOURCES_MAX = 8;
/** Lines on a card, and actions it carries. */
const CARD_LINES_MAX = 3;
const CARD_ACTIONS_MAX = 2;
/** A chat this recent is still open after a reload; an older one waits under "Chats". */
const RESUME_MS = 12 * 60 * 60 * 1000;

/**
 * The line under a reply saying who answered. The rules' reason shows only
 * when it is one the person can act on or wait out: AI is off, Muse is busy,
 * or the browser is offline. A rejected answer, and a chat stored before
 * replies carried a reason, get no parenthesis.
 */
export function viaLabel(m: Pick<ChatMessage, "via" | "why">): string | null {
  if (m.via === "muse") return "Answered by Muse";
  if (m.via === "landing") return "From Landing";
  if (m.via !== "rules") return null;
  const why = { off: "AI off", busy: "Muse is busy", offline: "offline", unsure: null }[
    m.why ?? "unsure"
  ];
  return `Answered by Landing's rules${why ? ` (${why})` : ""}`;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/* ── What is stored ── */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isSource = (v: unknown): v is ChatSource =>
  isObject(v) &&
  typeof v.label === "string" &&
  (v.href === undefined || typeof v.href === "string");
const isRental = (v: unknown): v is ChatRentalCard =>
  isObject(v) &&
  typeof v.id === "string" &&
  typeof v.title === "string" &&
  typeof v.price === "number" &&
  Array.isArray(v.reasons) &&
  v.reasons.every(
    (r) =>
      isObject(r) &&
      typeof r.text === "string" &&
      Array.isArray(r.sources) &&
      r.sources.every(isSource),
  );
const isItem = (v: unknown): v is ChatItemCard =>
  isObject(v) &&
  typeof v.itemId === "string" &&
  typeof v.listingId === "string" &&
  typeof v.title === "string" &&
  typeof v.price === "number" &&
  typeof v.kind === "string" &&
  typeof v.reason === "string";
const isTally = (v: unknown): v is ChatTally =>
  isObject(v) &&
  typeof v.total === "number" &&
  typeof v.spent === "number" &&
  (v.budget === null || typeof v.budget === "number");

const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const optional = <T>(v: unknown, ok: (x: unknown) => x is T): v is T | undefined =>
  v === undefined || ok(v);
const oneOf =
  <T extends string>(...values: T[]) =>
  (v: unknown): v is T =>
    (values as readonly unknown[]).includes(v);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * An action exactly as the page can run it. A stored action runs a mutation
 * when clicked, so every field of every kind is checked, and extra fields go.
 */
export function readAction(v: unknown): ChatAction | null {
  if (!isObject(v)) return null;
  switch (v.kind) {
    case "rsvp":
      return str(v.eventId) && oneOf("going", "interested")(v.status)
        ? { kind: "rsvp", eventId: v.eventId, status: v.status }
        : null;
    case "join_group":
      return str(v.groupId) ? { kind: "join_group", groupId: v.groupId } : null;
    case "save_listing":
      return str(v.listingId) ? { kind: "save_listing", listingId: v.listingId } : null;
    case "choose_place":
      return str(v.listingId) && isDay(v.moveIn)
        ? { kind: "choose_place", listingId: v.listingId, moveIn: v.moveIn }
        : null;
    case "negotiate":
      return str(v.listingId) &&
        num(v.maxPrice) &&
        optional(v.targetPrice, num) &&
        optional(v.notes, str)
        ? {
            kind: "negotiate",
            listingId: v.listingId,
            maxPrice: v.maxPrice,
            ...(v.targetPrice !== undefined && { targetPrice: v.targetPrice }),
            ...(v.notes !== undefined && { notes: cut(v.notes, 500) }),
          }
        : null;
    case "set_negotiation":
      return str(v.negotiationId) && oneOf("active", "paused", "stopped")(v.status)
        ? { kind: "set_negotiation", negotiationId: v.negotiationId, status: v.status }
        : null;
    case "approve_draft":
    case "discard_draft":
      return str(v.proposalId) ? { kind: v.kind, proposalId: v.proposalId } : null;
    case "add_grocery":
      return str(v.houseId) && str(v.text)
        ? { kind: "add_grocery", houseId: v.houseId, text: cut(v.text, 200) }
        : null;
    case "add_chore":
      return str(v.houseId) && str(v.title) && oneOf("once", "weekly", "monthly")(v.cadence)
        ? { kind: "add_chore", houseId: v.houseId, title: cut(v.title, 200), cadence: v.cadence }
        : null;
    case "add_bill":
      return str(v.houseId) &&
        str(v.title) &&
        num(v.amount) &&
        oneOf("once", "monthly")(v.cadence) &&
        optional(v.dueDate, isDay)
        ? {
            kind: "add_bill",
            houseId: v.houseId,
            title: cut(v.title, 200),
            amount: v.amount,
            cadence: v.cadence,
            ...(v.dueDate !== undefined && { dueDate: v.dueDate }),
          }
        : null;
    case "ask_roommate":
      return str(v.userId) && str(v.text)
        ? { kind: "ask_roommate", userId: v.userId, text: cut(v.text, 1000) }
        : null;
    default:
      return null;
  }
}

/** One action, the same for the same action: where its outcome is kept. */
export function actionKey(a: ChatAction): string {
  switch (a.kind) {
    case "rsvp":
      return `rsvp:${a.eventId}:${a.status}`;
    case "join_group":
      return `join_group:${a.groupId}`;
    case "save_listing":
    case "choose_place":
    case "negotiate":
      return `${a.kind}:${a.listingId}`;
    case "set_negotiation":
      return `set_negotiation:${a.negotiationId}:${a.status}`;
    case "approve_draft":
    case "discard_draft":
      return `${a.kind}:${a.proposalId}`;
    case "add_grocery":
      return `add_grocery:${a.houseId}:${a.text}`;
    case "add_chore":
      return `add_chore:${a.houseId}:${a.cadence}:${a.title}`;
    case "add_bill":
      return `add_bill:${a.houseId}:${a.cadence}:${a.amount}:${a.title}`;
    case "ask_roommate":
      return `ask_roommate:${a.userId}`;
  }
}

function readActionCard(v: unknown): ChatActionCard | null {
  if (!isObject(v) || !str(v.label) || !str(v.confirm) || !optional(v.detail, str)) return null;
  const action = readAction(v.action);
  return (
    action && {
      action,
      label: cut(v.label, 200),
      ...(v.detail !== undefined && { detail: cut(v.detail, 1000) }),
      confirm: cut(v.confirm, 40),
    }
  );
}

const isPoint = (v: unknown): v is { lat: number; lng: number } =>
  isObject(v) && num(v.lat) && num(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;

function readCard(v: unknown): ChatCard | null {
  if (
    !isObject(v) ||
    !str(v.key) ||
    !oneOf(...CHAT_CARD_KINDS)(v.kind) ||
    !str(v.title) ||
    !Array.isArray(v.lines) ||
    !(v.photo === undefined || v.photo === null || typeof v.photo === "string") ||
    !optional(v.price, num) ||
    !optional(v.href, str) ||
    !optional(v.point, isPoint)
  )
    return null;
  const actions = (Array.isArray(v.actions) ? v.actions : [])
    .flatMap((a) => readActionCard(a) ?? [])
    .slice(0, CARD_ACTIONS_MAX);
  return {
    key: cut(v.key, 200),
    kind: v.kind,
    title: cut(v.title, 160),
    lines: v.lines
      .filter((l): l is string => typeof l === "string")
      .slice(0, CARD_LINES_MAX)
      .map((l) => cut(l, 160)),
    ...(v.photo !== undefined && { photo: v.photo }),
    ...(v.price !== undefined && { price: v.price }),
    ...(v.href !== undefined && { href: v.href }),
    ...(v.point && { point: { lat: v.point.lat, lng: v.point.lng } }),
    ...(actions.length && { actions }),
  };
}

/** The outcomes kept for a turn: only for actions it still carries. */
function readOutcomes(
  v: unknown,
  cards: readonly ChatCard[] | undefined,
  actions: readonly ChatActionCard[] | undefined,
): Record<string, ActionOutcome> | undefined {
  if (!isObject(v)) return undefined;
  const keys = [...(actions ?? []), ...(cards ?? []).flatMap((c) => c.actions ?? [])].map((a) =>
    actionKey(a.action),
  );
  const kept = keys.flatMap((k): [string, ActionOutcome][] => {
    const o = Object.hasOwn(v, k) ? v[k] : undefined;
    return o === "done" || o === "dismissed" ? [[k, o]] : [];
  });
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/**
 * The keys of what a turn showed (cards, and `listing:<id>` for each rental):
 * they go back with the next message, so Muse knows what "the second one" is.
 */
export function shownKeys(m: Pick<ChatMessage, "cards" | "rentals">): string[] {
  return [
    ...new Set([
      ...(m.rentals ?? []).map((r) => `listing:${r.id}`),
      ...(m.cards ?? []).map((c) => c.key),
    ]),
  ].slice(0, CHAT_SHOWN_MAX);
}

/**
 * A message as it's kept: cards and sources capped, long text cut, so a chat
 * full of cards stays small in localStorage.
 */
export function storedMessage(m: ChatMessage): ChatMessage {
  return {
    id: m.id,
    who: m.who,
    text: cut(m.text, 2000),
    ...(m.sources?.length && {
      sources: m.sources.slice(0, SOURCES_MAX).map((s) => ({ ...s, label: cut(s.label, 200) })),
    }),
    ...(m.via && { via: m.via }),
    ...(m.why && { why: m.why }),
    ...(m.command && { command: m.command }),
    ...(m.saved?.length && { saved: m.saved.slice(0, SAVED_MAX).map((s) => cut(s, 120)) }),
    ...(m.rentals?.length && {
      rentals: m.rentals.slice(0, CHAT_CARDS_MAX).map((r) => ({
        ...r,
        title: cut(r.title, 160),
        reasons: r.reasons.slice(0, 2).map((x) => ({
          text: cut(x.text, 200),
          sources: x.sources.slice(0, 3).map((s) => ({ ...s, label: cut(s.label, 200) })),
        })),
      })),
    }),
    ...(m.items?.length && {
      items: m.items
        .slice(0, CHAT_ITEMS_MAX)
        .map((i) => ({ ...i, title: cut(i.title, 160), reason: cut(i.reason, 200) })),
    }),
    ...(m.tally && { tally: m.tally }),
    // Cards, actions and their outcomes go through the same checks as a read: what is kept can be run.
    ...cardsAndActions(m),
  };
}

/** A message's cards, actions and outcomes, each checked and capped. */
function cardsAndActions(v: {
  cards?: unknown;
  actions?: unknown;
  outcomes?: unknown;
}): Pick<ChatMessage, "cards" | "actions" | "outcomes"> {
  const list = <T>(x: unknown, read: (i: unknown) => T | null, max: number): T[] | undefined => {
    const items = (Array.isArray(x) ? x : []).flatMap((i) => read(i) ?? []).slice(0, max);
    return items.length ? items : undefined;
  };
  const cards = list(v.cards, readCard, CHAT_INFO_CARDS_MAX);
  const actions = list(v.actions, readActionCard, CHAT_ACTIONS_MAX);
  const outcomes = readOutcomes(v.outcomes, cards, actions);
  return { ...(cards && { cards }), ...(actions && { actions }), ...(outcomes && { outcomes }) };
}

/** A stored message read back: anything that isn't the expected shape is dropped, not trusted. */
function readMessage(v: unknown): ChatMessage | null {
  if (!isObject(v) || typeof v.id !== "string" || typeof v.text !== "string") return null;
  if (v.who !== "me" && v.who !== "muse") return null;
  const list = <T>(x: unknown, ok: (i: unknown) => i is T): T[] | undefined => {
    const items = Array.isArray(x) ? x.filter(ok) : [];
    return items.length ? items : undefined;
  };
  const sources = list(v.sources, isSource);
  const saved = list(v.saved, (s): s is string => typeof s === "string");
  const rentals = list(v.rentals, isRental);
  const items = list(v.items, isItem);
  return {
    id: v.id,
    who: v.who,
    text: v.text,
    ...(sources && { sources }),
    ...((v.via === "muse" || v.via === "rules" || v.via === "landing") && { via: v.via }),
    ...(typeof v.why === "string" && WHYS.includes(v.why) && { why: v.why as ChatWhy }),
    // The page ignores a command kind it doesn't know.
    ...(isObject(v.command) &&
      typeof v.command.kind === "string" && { command: v.command as ChatCommand }),
    ...(saved && { saved }),
    ...(rentals && { rentals }),
    ...(items && { items }),
    ...(isTally(v.tally) && { tally: v.tally }),
    ...cardsAndActions(v),
  };
}

/**
 * The chats in a stored value, newest first. Chats from before cards existed
 * load as they are; a value that isn't a list of chats loads as none.
 */
export function readSessions(raw: string | null): ChatSession[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((s): ChatSession[] => {
    if (!isObject(s) || typeof s.id !== "string" || !Array.isArray(s.messages)) return [];
    const messages = s.messages.flatMap((m) => readMessage(m) ?? []);
    if (!messages.length) return [];
    return [
      {
        id: s.id,
        title: typeof s.title === "string" ? s.title : "Chat",
        updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : 0,
        messages,
      },
    ];
  });
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, sessions: ChatSession[], openId: string | null) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        sessions
          .slice(0, MAX_SESSIONS)
          .map((s) => ({ ...s, messages: s.messages.slice(-MAX_MESSAGES).map(storedMessage) })),
      ),
    );
    if (openId) localStorage.setItem(`${key}:open`, openId);
    else localStorage.removeItem(`${key}:open`);
  } catch {
    // Storage off or full: chats just won't survive a reload.
  }
}

type Log = {
  key: string;
  sessions: ChatSession[];
  current: ChatSession;
  /** The open chat came back from storage (a reload), rather than starting new. */
  resumed: boolean;
};

function load(key: string, greeting: string): Log {
  const sessions = readSessions(stored(key));
  const openId = stored(`${key}:open`);
  const open = sessions.find((s) => s.id === openId && Date.now() - s.updatedAt < RESUME_MS);
  return { key, sessions, current: open ?? fresh(greeting), resumed: !!open };
}

/**
 * Landing Home's chat: the open conversation plus past ones, kept in this
 * browser per viewer. A chat is saved once the viewer has said something, and
 * the open one comes back after a reload.
 */
export function useChatLog(viewerId: string | undefined, greeting: string) {
  const key = `landing:chats:${viewerId ?? "anon"}`;
  const [log, setLog] = useState<Log>(() => load(key, greeting));
  // Another persona: their chats, not the last person's open one.
  if (log.key !== key) setLog(load(key, greeting));
  const currentId = useRef(log.current.id);
  currentId.current = log.current.id;

  const isSaved = log.sessions.some((s) => s.id === log.current.id);
  useEffect(() => {
    write(log.key, log.sessions, isSaved ? log.current.id : null);
  }, [log.key, log.sessions, log.current.id, isSaved]);

  /**
   * Adds a message to the open chat, or to `sessionId` when given: a reply
   * that arrives after the person switched chats still lands in its own.
   */
  const add = useCallback((m: Omit<ChatMessage, "id">, sessionId?: string) => {
    const msg = { ...m, id: newId() };
    setLog((prev) => {
      const open = !sessionId || sessionId === prev.current.id;
      const target = open ? prev.current : prev.sessions.find((s) => s.id === sessionId);
      // Updaters can run twice (StrictMode); add each message once.
      if (!target || target.messages.some((x) => x.id === msg.id)) return prev;
      const title =
        target.title === "New chat" && m.who === "me"
          ? m.text.length > 44
            ? `${m.text.slice(0, 42)}…`
            : m.text
          : target.title;
      const next = { ...target, title, updatedAt: Date.now(), messages: [...target.messages, msg] };
      return {
        ...prev,
        current: open ? next : prev.current,
        sessions: next.messages.some((x) => x.who === "me")
          ? [next, ...prev.sessions.filter((s) => s.id !== next.id)]
          : prev.sessions,
      };
    });
  }, []);

  /** Records what became of an action a message offered, wherever that message's chat is. */
  const setOutcome = useCallback((messageId: string, key: string, outcome: ActionOutcome) => {
    const mark = (s: ChatSession): ChatSession =>
      s.messages.some((x) => x.id === messageId)
        ? {
            ...s,
            messages: s.messages.map((x) =>
              x.id === messageId ? { ...x, outcomes: { ...x.outcomes, [key]: outcome } } : x,
            ),
          }
        : s;
    setLog((prev) => ({
      ...prev,
      current: mark(prev.current),
      sessions: prev.sessions.map(mark),
    }));
  }, []);

  const isCurrent = useCallback((sessionId: string) => currentId.current === sessionId, []);
  const open = useCallback(
    (s: ChatSession) => setLog((prev) => ({ ...prev, current: s, resumed: false })),
    [],
  );
  const reset = useCallback(
    () => setLog((prev) => ({ ...prev, current: fresh("New chat. Where to?"), resumed: false })),
    [],
  );

  return {
    current: log.current,
    sessions: log.sessions,
    resumed: log.resumed,
    add,
    setOutcome,
    isCurrent,
    open,
    reset,
  };
}

function fresh(greeting: string): ChatSession {
  return {
    id: newId(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [{ id: newId(), who: "muse", text: greeting }],
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { FurnishReply } from "../../../convex/apartment";
import {
  CHAT_CARDS_MAX,
  type ChatCommand,
  type ChatRentalCard,
  type ChatSource,
} from "../../../convex/lib/homeChatRules";

/** A Marketplace item Muse placed in the apartment, as a card under the reply. */
export type ChatItemCard = FurnishReply["items"][number];
/** What a furnish reply's items cost, what is placed in all, and the furniture budget. */
export type ChatTally = { total: number; spent: number; budget: number | null };

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
  command?: ChatCommand;
  /** What the message added to the City Profile. */
  saved?: string[];
  /** Rentals to choose from. */
  rentals?: ChatRentalCard[];
  /** Items placed in the apartment, with their running total. */
  items?: ChatItemCard[];
  tally?: ChatTally;
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
/** A chat this recent is still open after a reload; an older one waits under "Chats". */
const RESUME_MS = 12 * 60 * 60 * 1000;

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
  };
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
    // The page ignores a command kind it doesn't know.
    ...(isObject(v.command) &&
      typeof v.command.kind === "string" && { command: v.command as ChatCommand }),
    ...(saved && { saved }),
    ...(rentals && { rentals }),
    ...(items && { items }),
    ...(isTally(v.tally) && { tally: v.tally }),
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

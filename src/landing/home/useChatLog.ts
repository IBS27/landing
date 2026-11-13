import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatCommand, ChatSource } from "../../../convex/lib/homeChatRules";

export type ChatMessage = {
  id: string;
  who: "me" | "muse";
  text: string;
  sources?: ChatSource[];
  /** How Muse's reply was made: the model, or Landing's rules (AI off, or the model's answer rejected). */
  via?: "muse" | "rules";
  command?: ChatCommand;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const MAX_SESSIONS = 30;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function read(key: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, sessions: ChatSession[]) {
  try {
    localStorage.setItem(key, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Storage off or full: chats just won't survive a reload.
  }
}

/**
 * Landing Home's chat: the current conversation plus past ones, kept in this
 * browser per viewer. A chat is saved once the viewer has said something.
 */
export function useChatLog(viewerId: string | undefined, greeting: string) {
  const key = `landing:chats:${viewerId ?? "anon"}`;
  const [sessions, setSessions] = useState<ChatSession[]>(() => read(key));
  const [current, setCurrent] = useState<ChatSession>(() => fresh(greeting));
  const currentId = useRef(current.id);
  currentId.current = current.id;

  useEffect(() => setSessions(read(key)), [key]);

  const save = useCallback(
    (s: ChatSession) => {
      if (!s.messages.some((m) => m.who === "me")) return;
      setSessions((prev) => {
        const next = [s, ...prev.filter((p) => p.id !== s.id)];
        write(key, next);
        return next;
      });
    },
    [key],
  );

  /**
   * Adds a message to the open chat, or to `sessionId` when given: a reply
   * that arrives after the person switched chats still lands in its own.
   */
  const add = useCallback(
    (m: Omit<ChatMessage, "id">, sessionId?: string) => {
      const msg = { ...m, id: newId() };
      const append = (s: ChatSession): ChatSession => {
        // Updaters can run twice (StrictMode); add each message once.
        if (s.messages.some((x) => x.id === msg.id)) return s;
        const title =
          s.title === "New chat" && m.who === "me"
            ? m.text.length > 44
              ? `${m.text.slice(0, 42)}…`
              : m.text
            : s.title;
        return { ...s, title, updatedAt: Date.now(), messages: [...s.messages, msg] };
      };
      if (sessionId && sessionId !== currentId.current) {
        setSessions((prev) => {
          const target = prev.find((p) => p.id === sessionId);
          if (!target) return prev;
          const next = [append(target), ...prev.filter((p) => p.id !== sessionId)];
          write(key, next);
          return next;
        });
        return;
      }
      setCurrent((s) => {
        const next = append(s);
        save(next);
        return next;
      });
    },
    [key, save],
  );

  const isCurrent = useCallback((sessionId: string) => currentId.current === sessionId, []);
  const open = useCallback((s: ChatSession) => setCurrent(s), []);
  const reset = useCallback(() => setCurrent(fresh("New chat. Where to?")), []);

  return { current, sessions, add, isCurrent, open, reset };
}

function fresh(greeting: string): ChatSession {
  return {
    id: newId(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [{ id: newId(), who: "muse", text: greeting }],
  };
}

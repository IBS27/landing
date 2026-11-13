import { useCallback, useEffect, useRef, useState } from "react";
import { useM } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ChatState = {
  conversationId: Id<"conversations">;
  lastMessageAt: number;
  status: "checked" | "checking" | "failed" | "needed";
};

/**
 * Runs the chat check whenever the viewer's chat about a rental has messages
 * it hasn't covered: once per new message, and again after the server's
 * cooldown when it asks to wait. Returns `retry` for the "Try again" button.
 */
export function useChatCheck(
  listingId: Id<"listings"> | undefined,
  chat: ChatState | null | undefined,
) {
  const request = useM(api.trust.requestChatCheck);
  const [attempt, setAttempt] = useState(0);
  const asked = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const ask = useCallback(() => {
    if (!listingId) return;
    clearTimeout(timer.current);
    request({ listingId })
      .then((r) => {
        if (r.status === "wait")
          timer.current = setTimeout(() => setAttempt((n) => n + 1), r.retryInMs + 250);
      })
      .catch(() => {});
  }, [listingId, request]);

  const key = chat ? `${chat.conversationId}:${chat.lastMessageAt}:${attempt}` : null;
  const needed = chat?.status === "needed";
  useEffect(() => {
    if (!needed || !key || asked.current === key) return;
    asked.current = key;
    ask();
  }, [needed, key, ask]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return ask;
}

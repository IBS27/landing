import { useEffect, useState } from "react";
import { useM, useViewer } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import type { ConversationDetail, Message } from "./util";

/** Marks the thread read while it is active and the tab is visible and focused. */
export function useMarkRead(conversationId: Id<"conversations">, unread: boolean, active: boolean) {
  const markRead = useM(api.messenger.markRead);
  useEffect(() => {
    if (!unread || !active) return;
    const check = () => {
      if (document.visibilityState === "visible" && document.hasFocus())
        void markRead({ conversationId }).catch(() => {});
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    document.addEventListener("pointerdown", check);
    document.addEventListener("keydown", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("pointerdown", check);
      document.removeEventListener("keydown", check);
    };
  }, [unread, active, conversationId, markRead]);
}

/** Message list plus composer, shared by chat windows and the Messenger page. */
export function Thread({
  detail,
  variant,
  active,
  autoFocus,
}: {
  detail: ConversationDetail;
  variant: "dock" | "page";
  active: boolean;
  autoFocus?: boolean;
}) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  useMarkRead(detail._id, detail.unread, active);
  const viewer = useViewer();
  const replyName = !replyTo
    ? ""
    : replyTo.senderId === viewer._id
      ? "yourself"
      : (detail.members.find((m) => m._id === replyTo.senderId)?.firstName ?? "");
  return (
    <>
      <MessageList
        key={detail._id}
        conversationId={detail._id}
        detail={detail}
        variant={variant}
        onReply={setReplyTo}
      />
      <Composer
        key={`c-${detail._id}`}
        conversationId={detail._id}
        emoji={detail.emoji}
        variant={variant}
        replyTo={replyTo}
        replyName={replyName}
        onCancelReply={() => setReplyTo(null)}
        autoFocus={autoFocus}
      />
    </>
  );
}

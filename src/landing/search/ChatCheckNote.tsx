import { Link } from "@tanstack/react-router";
import { MessageCircleWarning } from "lucide-react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CATEGORY_LABEL } from "./ThingsToCheck";
import { useChatCheck } from "./useChatCheck";

type Flag = { category: string; reason: string };

/**
 * The chat check (#11) inside a Marketplace chat about a rental: runs the
 * check on new messages and returns the flags by message, for `ChatCheckNote`.
 * Does nothing in other chats, or for the lister.
 */
export function useChatNotes(conversationId: Id<"conversations">, kind: string) {
  const notes = useQ(
    api.trust.forConversation,
    kind === "marketplace" ? { conversationId } : "skip",
  );
  useChatCheck(notes?.listingId, notes);
  const byMessage = new Map<Id<"messages">, Flag[]>();
  for (const f of notes?.flags ?? [])
    byMessage.set(f.messageId, [...(byMessage.get(f.messageId) ?? []), f]);
  return { listingId: notes?.listingId, byMessage };
}

/** "Things to check" under a lister's message, linking to the rental's checks on Landing. */
export function ChatCheckNote({
  flags,
  listingId,
  compact,
  indent,
}: {
  flags: Flag[];
  listingId: Id<"listings">;
  compact: boolean;
  /** Left offset so the note lines up with the bubble, past the avatar. */
  indent: number;
}) {
  return (
    <div
      className={cn("mt-1 mb-1.5 flex", compact ? "max-w-[240px]" : "max-w-[min(564px,62%)]")}
      style={{ marginLeft: indent }}
    >
      <div className="flex items-start gap-1.5 rounded-lg bg-[#FFF4D6] px-2.5 py-1.5 text-[#5C4100] text-[12px] leading-4 dark:bg-[#F7B928]/15 dark:text-[#F7B928]">
        <MessageCircleWarning size={14} className="mt-px shrink-0" aria-hidden />
        <div className="min-w-0">
          <span className="font-semibold">Things to check: </span>
          {flags.map((f, i) => (
            <span key={f.category}>
              {i > 0 && " "}
              <span className="font-semibold">{CATEGORY_LABEL[f.category] ?? f.category}.</span>{" "}
              {f.reason}
            </span>
          ))}{" "}
          <Link
            to="/landing/find/listing/$listingId"
            params={{ listingId }}
            className="font-semibold underline"
          >
            See rental checks
          </Link>
        </div>
      </div>
    </div>
  );
}

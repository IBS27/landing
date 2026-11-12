import { useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { MetaAIRing } from "@/features/misc/icons";
import { cn } from "@/lib/format";
import { Avatar, Spinner, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Composer } from "./Composer";
import { ConversationAvatar } from "./ConversationAvatar";
import { MessageList } from "./MessageList";
import { useMarkRead } from "./Thread";

type Person = FunctionReturnType<typeof api.messenger.searchPeople>["people"][number];

/**
 * "New message": a "To:" field with recipient chips and suggestions. With
 * recipients chosen it shows the existing thread with them, or an empty one
 * that is created on first send (a group when there are several people).
 */
export function NewMessage({
  variant,
  onConversation,
  onClose,
}: {
  variant: "dock" | "page";
  /** Called once a thread exists (picked group chat, or after the first send). */
  onConversation: (id: Id<"conversations">) => void;
  /** Closes the composer window (after jumping to Meta AI). */
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const [to, setTo] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useQ(api.messenger.searchPeople, { q });
  const existing = useQ(
    api.messenger.findThread,
    to.length ? { userIds: to.map((p) => p._id) } : "skip",
  );
  const getOrCreateDm = useM(api.messenger.getOrCreateDm);
  const createGroup = useM(api.messenger.createGroup);

  const chosen = new Set(to.map((p) => p._id));
  const showSuggestions = q.trim().length > 0 || to.length === 0;
  const term = q.trim().toLowerCase();
  // Meta AI leads the suggestions, like Facebook's "New message" list.
  const showMetaAI =
    to.length === 0 && (!term || "meta ai".startsWith(term) || term.startsWith("meta"));

  const add = (p: Person) => {
    setTo((t) => [...t, p]);
    setQ("");
    inputRef.current?.focus();
  };

  const ensure = async () => {
    if (existing) return existing;
    if (to.length === 1) return getOrCreateDm({ userId: to[0]._id });
    return createGroup({ userIds: to.map((p) => p._id) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-1 border-divider border-b",
          variant === "dock" ? "min-h-12 px-3 py-2" : "min-h-14 px-4 py-2",
        )}
      >
        <span className="pr-1 text-[15px] text-primary">To:</span>
        {to.map((p) => (
          <span
            key={p._id}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-btn-soft pr-1.5 pl-2.5 font-semibold text-[15px] text-btn-soft-text"
          >
            {p.name}
            <button
              type="button"
              aria-label={`Remove ${p.name}`}
              onClick={() => setTo((t) => t.filter((x) => x._id !== p._id))}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-hover"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !q && to.length) setTo((t) => t.slice(0, -1));
            if (e.key === "Enter") {
              e.preventDefault();
              const first = results?.people.find((p) => !chosen.has(p._id));
              if (first && q.trim()) add(first);
            }
          }}
          // biome-ignore lint/a11y/noAutofocus: the To: field is focused when composing, like Facebook
          autoFocus
          aria-label="Send message to"
          className={cn(
            "h-8 min-w-[80px] flex-1 bg-transparent text-[16px] text-primary outline-none",
            // With a recipient chosen the field drops to its own line under the chips.
            to.length > 0 && "basis-full",
          )}
        />
      </div>

      {showSuggestions ? (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {results === undefined && (
            <li className="flex justify-center py-4">
              <Spinner size={20} />
            </li>
          )}
          {showMetaAI && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  void navigate({ to: "/meta-ai" });
                }}
                className="mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_var(--media-inner-border)]">
                  <MetaAIRing size={28} />
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[15px] text-primary">Meta AI</span>
                  <VerifiedBadge size={12} />
                </span>
              </button>
            </li>
          )}
          {results?.groups.length && q.trim()
            ? results.groups.map((g) => (
                <li key={g._id}>
                  <button
                    type="button"
                    onClick={() => onConversation(g._id)}
                    className="mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
                  >
                    <ConversationAvatar kind="group" photo={g.photo} others={g.others} size={36} />
                    <span className="truncate text-[15px] text-primary">{g.name}</span>
                  </button>
                </li>
              ))
            : null}
          {results?.people
            .filter((p) => !chosen.has(p._id))
            .map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  className="mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
                >
                  <Avatar src={p.avatar} size={36} online={p.online} />
                  <span className="truncate text-[15px] text-primary">{p.name}</span>
                </button>
              </li>
            ))}
          {results && results.people.length === 0 && results.groups.length === 0 && !showMetaAI && (
            <li className="px-4 py-6 text-center text-[15px] text-secondary">No results</li>
          )}
        </ul>
      ) : existing ? (
        <ExistingThread id={existing} variant={variant} onSent={onConversation} />
      ) : (
        <>
          <div className="flex-1" />
          <Composer
            conversationId={null}
            ensureConversation={ensure}
            variant={variant}
            onSent={onConversation}
            autoFocus
          />
        </>
      )}
    </div>
  );
}

function ExistingThread({
  id,
  variant,
  onSent,
}: {
  id: Id<"conversations">;
  variant: "dock" | "page";
  onSent: (id: Id<"conversations">) => void;
}) {
  const detail = useQ(api.messenger.get, { conversationId: id });
  useMarkRead(id, detail?.unread ?? false, true);
  if (!detail)
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  return (
    <>
      <MessageList conversationId={id} detail={detail} variant={variant} onReply={() => {}} />
      <Composer
        conversationId={id}
        emoji={detail.emoji}
        variant={variant}
        onSent={onSent}
        autoFocus
      />
    </>
  );
}

import { Check, ListChecks } from "lucide-react";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { errorText } from "@/landing/errorText";
import { cn } from "@/lib/format";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Poll } from "../../../convex/validators";

/** A poll as Messenger's message list gets it (`pollView` in convex/lib/polls.ts). */
export type ChatPollView = {
  messageId: Id<"messages">;
  question: string;
  closesAt: number | null;
  options: { id: string; label: string; voterIds: Id<"users">[] }[];
  voterCount: number;
};

type Person = { avatar: string; firstName?: string; name: string };

const CLOSES = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function closesLabel(closesAt: number | null, now: number) {
  if (closesAt === null) return null;
  return closesAt <= now ? "Poll closed" : `Closes ${CLOSES.format(closesAt).replace(":00", "")}`;
}

function Header({ question }: { question: string }) {
  return (
    <div className="flex items-start gap-2">
      <ListChecks size={18} className="mt-0.5 shrink-0 text-fb" aria-hidden />
      <span className="font-semibold text-[15px] text-primary leading-5">{question}</span>
    </div>
  );
}

/**
 * A poll in a group chat (#34). Pick any options that work; picking again
 * takes it back. Everyone in the chat sees who picked what.
 */
export function ChatPoll({
  poll,
  viewerId,
  person,
  compact,
}: {
  poll: ChatPollView;
  viewerId: Id<"users">;
  person: (id: Id<"users">) => Person | undefined;
  compact?: boolean;
}) {
  const vote = useM(api.polls.vote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const closed = poll.closesAt !== null && poll.closesAt <= now;
  const picked = new Set(
    poll.options.filter((o) => o.voterIds.includes(viewerId)).map((o) => o.id),
  );
  const most = Math.max(1, ...poll.options.map((o) => o.voterIds.length));

  async function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBusy(true);
    setError(null);
    try {
      await vote({ messageId: poll.messageId, optionIds: [...next] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-[18px] border border-divider bg-card p-3",
        compact ? "w-[208px] max-w-full" : "w-[280px] max-w-full",
      )}
    >
      <Header question={poll.question} />
      <div className="mt-2.5 flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const mine = picked.has(o.id);
          const voters = o.voterIds.map(person).filter((p): p is Person => !!p);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={mine}
              disabled={closed || busy}
              onClick={() => void toggle(o.id)}
              className={cn(
                "relative overflow-hidden rounded-lg border text-left transition-colors enabled:hover:bg-hover disabled:cursor-default",
                mine ? "border-fb" : "border-divider",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-fb/15"
                style={{ width: `${(o.voterIds.length / most) * 100}%` }}
              />
              <span className="relative flex items-center gap-2 px-2.5 py-2">
                <span
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                    mine ? "border-fb bg-fb" : "border-icon-secondary",
                  )}
                >
                  {mine && <Check size={11} strokeWidth={3} className="text-white" />}
                </span>
                <span className="min-w-0 flex-1 break-words text-[14px] text-primary leading-[18px]">
                  {o.label}
                </span>
                {voters.length > 0 && (
                  <span className="flex -space-x-1.5" title={voters.map((v) => v.name).join(", ")}>
                    {voters.slice(0, 3).map((v) => (
                      <span key={v.name} className="rounded-full ring-2 ring-card">
                        <Avatar src={v.avatar} alt={v.name} size={18} />
                      </span>
                    ))}
                  </span>
                )}
                <span className="w-4 shrink-0 text-right font-semibold text-[13px] text-secondary">
                  {o.voterIds.length}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[12px] text-secondary">
        {poll.voterCount} voted
        {poll.closesAt !== null && ` · ${closesLabel(poll.closesAt, now)}`}
      </div>
      {error && <p className="mt-1 text-[12px] text-negative">{error}</p>}
    </div>
  );
}

/** The poll on Muse's draft, before it's sent: the question and options, no votes yet. */
export function PollPreview({ poll }: { poll: Poll }) {
  const closes = closesLabel(poll.closesAt ?? null, Date.now());
  return (
    <div className="flex justify-end">
      <div className="w-[280px] max-w-full rounded-[18px] border border-divider bg-card p-3">
        <Header question={poll.question} />
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {poll.options.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-2 rounded-lg border border-divider px-2.5 py-2 text-[14px] text-primary"
            >
              <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-icon-secondary" />
              {o.label}
            </li>
          ))}
        </ul>
        {closes && <div className="mt-2 text-[12px] text-secondary">{closes}</div>}
      </div>
    </div>
  );
}

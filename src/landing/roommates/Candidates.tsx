import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarDays, Inbox, MessageCircle, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toProfile } from "@/landing/links";
import { cn, plural } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CandidateList, RoommateCandidate } from "../../../convex/lib/roommates";
import { CardTraits, CompareDialog, type EditAnswer, ScoreBadge } from "./Compatibility";
import { askMessage, namesShown, overlapLine } from "./candidateCopy";

/** Saves the viewer's first message as a draft in Landing Inbox; nothing is sent until they approve it. */
export type AskToConnect = (userId: Id<"users">, text: string) => Promise<Id<"proposals">>;

/** Roommate candidates from the viewer's network. Shown while the viewer shares their answers. */
export function RoommateCandidates({ onEditAnswer }: { onEditAnswer?: EditAnswer }) {
  const data = useQ(api.roommates.candidates, {});
  const askToConnect = useM(api.roommates.askToConnect);
  const ask: AskToConnect = (userId, text) => askToConnect({ userId, text });
  return <CandidatesView data={data} onAsk={ask} onEditAnswer={onEditAnswer} />;
}

/** The candidate list without its data source. `undefined` while loading. */
export function CandidatesView({
  data,
  onAsk,
  onEditAnswer,
}: {
  data: CandidateList | null | undefined;
  onAsk: AskToConnect;
  /** Opens the viewer's own answer from a comparison's sources. */
  onEditAnswer?: EditAnswer;
}) {
  const [asking, setAsking] = useState<RoommateCandidate | null>(null);
  // Resolved from the live list, so the comparison updates with it and closes
  // when the person stops sharing, deletes their answers or blocks the viewer.
  const [comparingId, setComparingId] = useState<Id<"users"> | null>(null);
  const comparing = data?.candidates.find((c) => c.user._id === comparingId) ?? null;
  if (comparingId && data !== undefined && !comparing) setComparingId(null);
  if (data === null) return null;
  return (
    <Card className="overflow-hidden" aria-labelledby="candidates-title">
      <div className="px-4 pt-4 pb-2">
        <h2 id="candidates-title" className="font-bold text-[17px] text-primary leading-[22px]">
          From your network
        </h2>
        <p className="text-[13px] text-secondary leading-4">
          Friends, people your friends vouch for and friends of friends who also share their
          answers.
        </p>
      </div>
      {data === undefined ? (
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : data.candidates.length === 0 ? (
        <p className="px-4 pt-2 pb-4 text-[15px] text-secondary leading-5">
          Nobody yet. When your friends or friends of friends share their answers, they'll show up
          here.
        </p>
      ) : (
        <ul className="divide-y divide-divider-soft border-divider-soft border-t">
          {data.candidates.map((c) => (
            <CandidateRow
              key={c.user._id}
              candidate={c}
              onAsk={() => setAsking(c)}
              onCompare={() => setComparingId(c.user._id)}
            />
          ))}
        </ul>
      )}
      {data && (data.total > data.candidates.length || data.partial) && (
        <p className="border-divider-soft border-t px-4 py-3 text-[13px] text-secondary leading-4">
          {data.total > data.candidates.length &&
            `Showing your ${data.candidates.length} closest matches of ${data.total}. `}
          {data.partial && "Part of your network couldn't be checked, so someone may be missing."}
        </p>
      )}
      {comparing && (
        <CompareDialog
          candidate={comparing}
          onClose={() => setComparingId(null)}
          onAsk={() => {
            setComparingId(null);
            setAsking(comparing);
          }}
          onEditAnswer={
            onEditAnswer &&
            ((field) => {
              setComparingId(null);
              onEditAnswer(field);
            })
          }
        />
      )}
      {asking && <AskDialog candidate={asking} onAsk={onAsk} onClose={() => setAsking(null)} />}
    </Card>
  );
}

function CandidateRow({
  candidate: c,
  onAsk,
  onCompare,
}: {
  candidate: RoommateCandidate;
  onAsk: () => void;
  onCompare: () => void;
}) {
  const plans = overlapLine(c.overlap);
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <PersonLink person={c.user}>
          <Avatar src={c.user.avatar} alt={c.user.name} size={56} />
        </PersonLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <PersonLink
              person={c.user}
              className="font-semibold text-[15px] text-primary leading-5"
            >
              {c.user.name}
            </PersonLink>
            <ScoreBadge c={c.compatibility} />
          </div>
          <Reason icon={<Users size={14} />}>
            {c.closeness === "friend" ? (
              <>
                Your friend
                {c.mutualFriendCount > 0 && ` · ${plural(c.mutualFriendCount, "mutual friend")}`}
              </>
            ) : c.mutualFriendCount > 0 ? (
              <>
                Friend of <Names people={c.mutualFriends} total={c.mutualFriendCount} />
              </>
            ) : null}
          </Reason>
          {c.vouchCount > 0 && (
            <Reason icon={<BadgeCheck size={14} />}>
              Vouched for by <Names people={c.vouchedBy} total={c.vouchCount} />
            </Reason>
          )}
          {plans && <Reason icon={<CalendarDays size={14} />}>{plans}</Reason>}
          <ul className="mt-1.5 flex flex-col gap-0.5">
            <CardTraits c={c.compatibility} firstName={c.user.firstName} />
          </ul>
          <button
            type="button"
            onClick={onCompare}
            className="mt-1 font-semibold text-[13px] text-link hover:underline"
          >
            See how you compare
          </button>
        </div>
      </div>
      <Button
        variant="soft"
        className="w-full sm:w-auto"
        icon={<MessageCircle size={16} aria-hidden />}
        onClick={onAsk}
      >
        Ask to connect
      </Button>
    </li>
  );
}

function Reason({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-0.5 flex gap-1.5 text-[13px] text-secondary leading-4">
      <span className="mt-px shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** "Jordan and Priya", "Jordan, Priya and 3 others", each name linking to the profile. */
function Names({ people, total }: { people: RoommateCandidate["mutualFriends"]; total: number }) {
  const { shown, others } = namesShown(people, total);
  return (
    <>
      {shown.map((p, i) => (
        <span key={p._id}>
          {i > 0 && (i === shown.length - 1 && others === 0 ? " and " : ", ")}
          <PersonLink person={p} className="font-semibold text-primary">
            {p.firstName}
          </PersonLink>
        </span>
      ))}
      {others > 0 && ` and ${plural(others, "other")}`}
    </>
  );
}

function PersonLink({
  person,
  className,
  children,
}: {
  person: { username: string; name: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link {...toProfile(person)} className={cn("hover:underline", className)} title={person.name}>
      {children}
    </Link>
  );
}

/**
 * The person edits the first message (the template by default) and saves it
 * to Landing Inbox, where they approve it like every outgoing Landing message.
 */
function AskDialog({
  candidate,
  onAsk,
  onClose,
}: {
  candidate: RoommateCandidate;
  onAsk: AskToConnect;
  onClose: () => void;
}) {
  const first = candidate.user.firstName;
  const [text, setText] = useState(() => askMessage(first, candidate.overlap));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(false);
    try {
      await onAsk(candidate.user._id, text.trim());
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={saved ? "Draft saved" : `Ask ${first} to connect`}
      width={500}
    >
      <div className="px-4 pt-3 pb-4">
        {saved ? (
          <>
            <p className="px-2 text-[15px] text-primary leading-5">
              Draft saved to your Inbox. Your message to {first} is sent once you approve it in
              Landing Inbox.
            </p>
            <div className="flex justify-end gap-2 px-2 pt-4">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Link to="/landing/inbox">
                <Button variant="primary" icon={<Inbox size={16} aria-hidden />}>
                  Open Inbox
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="px-2 pb-2 text-[13px] text-secondary leading-4">
              Edit the message as you like. It's saved to your Landing Inbox, and nothing is sent to{" "}
              {first} until you approve it there.
            </p>
            <label className="block px-2">
              <span className="sr-only">Message to {first}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg bg-input px-3 py-2 text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder"
              />
            </label>
            {error && (
              <p role="alert" className="px-2 pt-1 text-[13px] text-negative">
                Couldn't save your draft. Try again.
              </p>
            )}
            <div className="flex justify-end gap-2 px-2 pt-3">
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy || !text.trim()} onClick={submit}>
                Save draft
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

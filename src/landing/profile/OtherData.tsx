import { Link } from "@tanstack/react-router";
import { Bot, Palette, Sofa, Trash2, UsersRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { timeAgo } from "@/lib/citations";
import { plural } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { answeredCount, QUESTION_COUNT } from "../../../convex/lib/lifestyle";
import { ConfirmAction } from "./ConfirmAction";

/**
 * The other places Muse reads about the viewer (#5): roommate answers (#21),
 * the Move-in Crew (#30), room vibes (#25) and Muse runs made for them. Each
 * shows what's stored and clears it with the feature's own viewer-scoped
 * function, and links to that feature's page to change it.
 */
export function OtherData() {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <h2 className="font-bold text-[17px] text-primary leading-[22px]">
          Other things Muse uses
        </h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-4">
          Only you can see these here. Change them on their own pages, or clear them now.
        </p>
      </div>
      <div className="divide-y divide-divider-soft">
        <RoommateAnswers />
        <MoveInCrew />
        <RoomVibes />
        <MuseRuns />
      </div>
    </Card>
  );
}

const LINK_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-btn-text text-sm hover:brightness-95 dark:hover:brightness-125";

function Row({
  icon,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[15px] text-primary leading-5">{title}</h3>
        <div className="mt-0.5 text-[13px] text-secondary leading-4">{children}</div>
        {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

function Loading() {
  return <Skeleton className="mt-1 h-3 w-48" />;
}

function RoommateAnswers() {
  const mine = useQ(api.roommates.myLifestyle, {});
  const setSharing = useM(api.roommates.setLifestyleSharing);
  const remove = useM(api.roommates.deleteLifestyle);
  const [busy, setBusy] = useState(false);
  const title = "Roommate answers";
  if (mine === undefined)
    return (
      <Row icon={<Sofa size={18} />} title={title}>
        <Loading />
      </Row>
    );
  if (mine === null)
    return (
      <Row
        icon={<Sofa size={18} />}
        title={title}
        actions={
          <Link to="/landing/place/roommates" className={LINK_BUTTON}>
            Answer them
          </Link>
        }
      >
        You haven't answered the roommate questions.
      </Row>
    );
  return (
    <Row
      icon={<Sofa size={18} />}
      title={title}
      actions={
        <>
          <Link to="/landing/place/roommates" className={LINK_BUTTON}>
            View and edit
          </Link>
          {mine.shared && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setSharing({ shared: false }).finally(() => setBusy(false));
              }}
            >
              Stop sharing
            </Button>
          )}
          <ConfirmAction
            label="Delete answers"
            icon={<Trash2 size={16} aria-hidden />}
            title="Delete your roommate answers?"
            body="Your answers are deleted and you leave roommate matching right away. You can answer again any time."
            confirmLabel="Delete"
            onConfirm={() => remove({})}
          />
        </>
      }
    >
      {answeredCount(mine.answers)} of {QUESTION_COUNT} answered ·{" "}
      {mine.shared
        ? "Shared with people in your network who also share theirs"
        : "Private: not shared for roommate matching"}
    </Row>
  );
}

const ANCHORS = [
  ["month", "move-in month"],
  ["neighborhood", "neighborhoods"],
  ["employer", "employer"],
] as const;

function MoveInCrew() {
  const status = useQ(api.crews.status, {});
  const optOut = useM(api.crews.optOut);
  const title = "Move-in Crew";
  if (status === undefined)
    return (
      <Row icon={<UsersRound size={18} />} title={title}>
        <Loading />
      </Row>
    );
  if (!status.optedIn || !status.matchBy)
    return (
      <Row
        icon={<UsersRound size={18} />}
        title={title}
        actions={
          <Link to="/landing/crew" className={LINK_BUTTON}>
            See Move-in Crews
          </Link>
        }
      >
        You haven't opted in.
      </Row>
    );
  const matchBy = status.matchBy;
  const on = ANCHORS.filter(([k]) => matchBy[k]).map(([, label]) => label);
  return (
    <Row
      icon={<UsersRound size={18} />}
      title={title}
      actions={
        <>
          <Link to="/landing/crew" className={LINK_BUTTON}>
            Manage
          </Link>
          <ConfirmAction
            label="Leave crew"
            title="Leave your Move-in Crew?"
            body="You stop appearing in anyone's crew right away. You can opt in again any time."
            confirmLabel="Leave"
            onConfirm={() => optOut({})}
          />
        </>
      }
    >
      Opted in, matched on your {list(on)}.
    </Row>
  );
}

function RoomVibes() {
  const rooms = useQ(api.rooms.mine, {});
  const clearVibe = useM(api.rooms.clearVibe);
  const title = "Room vibes";
  if (rooms === undefined)
    return (
      <Row icon={<Palette size={18} />} title={title}>
        <Loading />
      </Row>
    );
  const withVibe = rooms.filter((r) => r.vibe !== null);
  if (withVibe.length === 0)
    return (
      <Row
        icon={<Palette size={18} />}
        title={title}
        actions={
          <Link to="/landing/place/room" className={LINK_BUTTON}>
            {rooms.length === 0 ? "Scan a room" : "Set a vibe"}
          </Link>
        }
      >
        No room has a vibe yet.
      </Row>
    );
  return (
    <Row icon={<Palette size={18} />} title={title}>
      <ul className="flex flex-col gap-3">
        {withVibe.map((r) => (
          <li key={r._id}>
            <p>
              <span className="font-semibold text-primary">{r.name}:</span> {r.vibe?.summary}
              {r.vibe && r.vibe.origin !== "typed" && " · Muse suggested it"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link to="/landing/place/room" search={{ room: r._id }} className={LINK_BUTTON}>
                Open
              </Link>
              <ConfirmAction
                label="Reset vibe"
                title={`Reset the vibe for ${r.name}?`}
                body="The vibe is cleared and Marketplace matches stop using it. Your room scan stays."
                confirmLabel="Reset"
                onConfirm={() => clearVibe({ roomId: r._id })}
              />
            </div>
          </li>
        ))}
      </ul>
    </Row>
  );
}

function MuseRuns() {
  const runs = useQ(api.museKnows.runs, {});
  const remove = useM(api.museKnows.deleteRuns);
  const title = "Muse runs for you";
  if (runs === undefined)
    return (
      <Row icon={<Bot size={18} />} title={title}>
        <Loading />
      </Row>
    );
  if (runs.total === 0)
    return (
      <Row icon={<Bot size={18} />} title={title}>
        Nothing kept. Muse hasn't made anything just for you, or you deleted it.
      </Row>
    );
  return (
    <Row
      icon={<Bot size={18} />}
      title={title}
      actions={
        <ConfirmAction
          label="Delete runs"
          icon={<Trash2 size={16} aria-hidden />}
          title="Delete Muse's runs for you?"
          body="Landing deletes its record of what Muse read and wrote for you. What you already kept, like profile facts, room vibes and sent messages, doesn't change. Muse runs again the next time you ask."
          confirmLabel="Delete"
          onConfirm={() => remove({})}
        />
      }
    >
      <p>
        Kept so the same request isn't run twice. {runs.more ? `${runs.total}+` : runs.total}{" "}
        {runs.total === 1 ? "run" : "runs"}:
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {runs.tasks.map((t) => (
          <li key={t.task}>
            <span className="text-primary">{t.label}</span> · {plural(t.count, "time")} · last{" "}
            {timeAgo(t.lastAt)}
          </li>
        ))}
      </ul>
    </Row>
  );
}

function list(items: readonly string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

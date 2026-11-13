import { Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { CalendarDays, Inbox, Sparkles, UsersRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQ, useViewerContext } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { errorText } from "@/landing/errorText";
import { toEvent, toGroup } from "@/landing/links";
import { SF_DAY_TIME } from "@/landing/sfTime";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

const openGroupCls =
  "inline-flex h-9 shrink-0 items-center rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125";

function InboxLink() {
  return (
    <Link
      to="/landing/inbox"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
    >
      <Inbox size={16} />
      Review in Inbox
    </Link>
  );
}

function Row({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:flex-nowrap">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[15px] text-primary leading-5">{title}</div>
        <div className="mt-0.5 text-[13px] text-secondary leading-[18px]">{body}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * The crew's Group and first meetup (#31). Muse drafts each one; it waits in
 * Landing Inbox until the person approves it, and only then is the Group or
 * Event created.
 */
export function CrewGroupCard({ crewSize }: { crewSize: number }) {
  const state = useQ(api.crews.crewGroup, {});
  const { viewerId } = useViewerContext();
  const proposeGroup = useAction(api.crews.proposeGroup);
  const proposeMeetup = useAction(api.crews.proposeMeetup);
  const toast = useToast();
  const [busy, setBusy] = useState<null | "group" | "meetup">(null);

  async function run(which: "group" | "meetup") {
    if (!viewerId) return;
    setBusy(which);
    try {
      await (which === "group" ? proposeGroup({ viewerId }) : proposeMeetup({ viewerId }));
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (state === undefined) return null;
  const groupPending = state.groupProposal?.status === "pending";
  const meetupPending = state.meetup?.status === "pending";

  let body: ReactNode;
  if (!state.group && !groupPending && state.fromCrew.length > 0) {
    // Someone in the crew already started one: join theirs rather than start another.
    body = (
      <div className="divide-y divide-divider">
        {state.fromCrew.map((g) => (
          <Row
            key={g._id}
            icon={<UsersRound size={20} />}
            title={
              <Link {...toGroup(g)} className="hover:underline">
                {g.name}
              </Link>
            }
            body={`Started by ${g.owner.name} for your crew · ${g.memberCount} member${g.memberCount === 1 ? "" : "s"}. ${g.joined ? "You're a member." : "You're invited."}`}
            action={
              <Link {...toGroup(g)} className={openGroupCls}>
                {g.joined ? "Open Group" : "View invite"}
              </Link>
            }
          />
        ))}
      </div>
    );
  } else if (!state.group) {
    body = groupPending ? (
      <Row
        icon={<UsersRound size={20} />}
        title="Your crew's Group is drafted"
        body="Muse wrote the name, an intro and a first meetup idea. Nothing is created or sent until you approve it."
        action={<InboxLink />}
      />
    ) : (
      <Row
        icon={<UsersRound size={20} />}
        title="Start a Group for your crew"
        body={
          crewSize > 0
            ? "Muse drafts a private Group with an intro and a first meetup idea from a real upcoming event. You review it in Inbox before anyone is invited."
            : "Once you're matched with people, Muse can start a Group for your crew."
        }
        action={
          <Button
            variant="primary"
            disabled={crewSize === 0 || busy !== null}
            icon={
              busy === "group" ? (
                <Spinner size={16} className="text-white" />
              ) : (
                <Sparkles size={16} />
              )
            }
            onClick={() => void run("group")}
          >
            {busy === "group" ? "Muse is writing…" : "Start crew Group"}
          </Button>
        }
      />
    );
  } else {
    const event = state.meetup?.event;
    body = (
      <div className="divide-y divide-divider">
        <Row
          icon={<UsersRound size={20} />}
          title={
            <Link {...toGroup(state.group)} className="hover:underline">
              {state.group.name}
            </Link>
          }
          body={`Private Group · ${state.group.memberCount} member${state.group.memberCount === 1 ? "" : "s"} so far. Your crew was invited.`}
          action={
            <Link {...toGroup(state.group)} className={openGroupCls}>
              Open Group
            </Link>
          }
        />
        {event ? (
          <Row
            icon={<CalendarDays size={20} />}
            title={
              <Link {...toEvent(event)} className="hover:underline">
                {event.title}
              </Link>
            }
            body={`First meetup · ${SF_DAY_TIME.format(event.startAt)}`}
          />
        ) : meetupPending ? (
          <Row
            icon={<CalendarDays size={20} />}
            title="Your first meetup is drafted"
            body="Muse picked a time and place from an upcoming event. Approve it to create the Event and invite your crew."
            action={<InboxLink />}
          />
        ) : (
          <Row
            icon={<CalendarDays size={20} />}
            title="Plan the first meetup"
            body="Muse picks an upcoming event that fits what your crew shares and drafts it in the Group."
            action={
              <Button
                variant="primary"
                disabled={busy !== null}
                icon={
                  busy === "meetup" ? (
                    <Spinner size={16} className="text-white" />
                  ) : (
                    <Sparkles size={16} />
                  )
                }
                onClick={() => void run("meetup")}
              >
                {busy === "meetup" ? "Muse is planning…" : "Plan first meetup"}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <Card className="px-4 pt-4 pb-1">
      <h2 className="font-bold text-[17px] text-primary leading-5">Crew Group</h2>
      {body}
      {toast.node}
    </Card>
  );
}

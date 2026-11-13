import { Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarCheck, Inbox, MessageCircle, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ, useViewerContext } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { toConversation, toEvent } from "@/landing/links";
import { shortAge } from "@/lib/format";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

type Data = FunctionReturnType<typeof api.chatPlans.mine>;
type Spotted = Data["spotted"][number];
type Plan = Data["plans"][number];

const WHEN = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const when = (t: number) => WHEN.format(t).replace(":00", "");

function errorText(e: unknown) {
  return e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong";
}

const linkButton =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125";

function InboxLink() {
  return (
    <Link to="/landing/inbox" className={linkButton}>
      <Inbox size={16} />
      Review in Inbox
    </Link>
  );
}

function Row({
  emoji,
  title,
  lines,
  actions,
}: {
  emoji: string;
  title: ReactNode;
  lines: ReactNode[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-[20px]"
      >
        {emoji}
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="font-semibold text-[15px] text-primary leading-5">{title}</div>
        {lines.map((l, i) => (
          <div key={i} className="text-[13px] text-secondary leading-[18px]">
            {l}
          </div>
        ))}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function SpottedRow({ s, onError }: { s: Spotted; onError: (m: string) => void }) {
  const { viewerId } = useViewerContext();
  const plan = useAction(api.chatPlans.plan);
  const dismiss = useM(api.chatPlans.dismiss);
  const [busy, setBusy] = useState<null | "plan" | "dismiss">(null);
  const run = async (which: "plan" | "dismiss") => {
    if (!viewerId) return;
    setBusy(which);
    try {
      if (which === "plan")
        await plan({ viewerId, conversationId: s.conversationId, messageId: s.messageId });
      else await dismiss({ conversationId: s.conversationId, messageId: s.messageId });
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const who = s.by ? (s.by.isYou ? "You" : s.by.firstName) : "Someone";
  const chimed = s.chimedIn.length
    ? ` · ${s.chimedIn.length > 2 ? `${s.chimedIn.slice(0, 2).join(", ")} and ${s.chimedIn.length - 2} more` : s.chimedIn.join(" and ")} ${s.chimedIn.length === 1 ? "is" : "are"} in`
    : "";
  return (
    <Row
      emoji={s.activity.emoji}
      title={<span className="line-clamp-2">“{s.text}”</span>}
      lines={[`${who} in ${s.chat} · ${shortAge(s.at)}${chimed}`]}
      actions={
        <>
          <Button variant="ghost" disabled={busy !== null} onClick={() => void run("dismiss")}>
            Not now
          </Button>
          <Button
            variant="primary"
            disabled={busy !== null}
            icon={
              busy === "plan" ? (
                <Spinner size={16} className="text-white" />
              ) : (
                <Sparkles size={16} />
              )
            }
            onClick={() => void run("plan")}
          >
            {busy === "plan" ? "Muse is planning…" : "Plan it"}
          </Button>
        </>
      }
    />
  );
}

function PlanRow({ p, onError }: { p: Plan; onError: (m: string) => void }) {
  const proposeEvent = useM(api.chatPlans.proposeEvent);
  const [busy, setBusy] = useState(false);
  const chatLink = (
    <Link {...toConversation(p.conversationId)} className={linkButton}>
      <MessageCircle size={16} />
      Open chat
    </Link>
  );
  const eventLink = p.event && (
    <Link {...toEvent(p.event._id)} className={linkButton}>
      <CalendarCheck size={16} />
      Open Event
    </Link>
  );
  const lines: ReactNode[] = [];
  if (p.route.length) lines.push(<span className="line-clamp-1">{p.route.join(" → ")}</span>);
  else if (p.place) lines.push(p.place);
  let actions: ReactNode = null;

  switch (p.stage) {
    case "pollDraft":
      lines.push(`${p.chat} · Muse drafted a poll. It waits for your OK.`);
      actions = <InboxLink />;
      break;
    case "polling": {
      const poll = p.poll;
      const tally = poll
        ? `${poll.voters} of ${poll.members} voted${poll.leader ? ` · ${poll.leader.label} leads (${poll.leader.votes})` : ""}`
        : "Poll sent";
      lines.push(
        `${p.chat} · ${poll?.closed ? "Poll closed" : "Poll is out"} · ${tally}`,
        poll && !poll.closed && poll.closesAt
          ? `Muse drafts the Event when the poll closes, ${when(poll.closesAt)}.`
          : "",
      );
      actions = (
        <>
          {chatLink}
          <Button
            variant="primary"
            disabled={busy || !poll?.leader}
            icon={busy ? <Spinner size={16} className="text-white" /> : <CalendarCheck size={16} />}
            onClick={async () => {
              setBusy(true);
              try {
                await proposeEvent({ planId: p._id });
              } catch (e) {
                onError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Make it an Event
          </Button>
        </>
      );
      break;
    }
    case "eventDraft":
      lines.push(`${p.chat} · Muse drafted the Event. It waits for your OK.`);
      actions = <InboxLink />;
      break;
    case "scheduled":
      if (p.event)
        lines.push(`${when(p.event.startAt)} · Muse drafts a reminder for ${p.chat} that morning.`);
      actions = eventLink;
      break;
    case "reminderDraft":
      lines.push(`Today · Muse drafted a reminder for ${p.chat}.`);
      actions = <InboxLink />;
      break;
    case "reminded":
      if (p.event) lines.push(`${when(p.event.startAt)} · Reminder sent to ${p.chat}.`);
      actions = eventLink;
      break;
    case "done":
      if (p.event) lines.push(`${when(p.event.startAt)} · Done`);
      actions = eventLink;
      break;
  }

  return (
    <Row
      emoji={p.emoji}
      title={
        p.event ? (
          <Link {...toEvent(p.event._id)} className="hover:underline">
            {p.event.title}
          </Link>
        ) : (
          p.title
        )
      }
      lines={lines.filter(Boolean)}
      actions={actions}
    />
  );
}

/**
 * Plans from your group chats (#34): talk like "we should hike sometime"
 * becomes a poll, an Event and a day-of reminder. Muse drafts each one, and
 * nothing is sent or created until you approve it in Landing Inbox.
 */
export function ChatPlansCard() {
  const data = useQ(api.chatPlans.mine, {});
  const toast = useToast();
  const onError = (m: string) => toast.show(m);
  const empty = data && data.plans.length === 0 && data.spotted.length === 0;
  return (
    <Card className="px-4 pt-3 pb-1">
      <h2 className="font-bold text-[17px] text-primary leading-5">Plans from your chats</h2>
      <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
        When someone in a group chat says “we should hike sometime”, Muse suggests a time, place and
        route, then runs a poll, makes the Event and reminds everyone on the day. Muse reads a chat
        only when you tap Plan it, and nothing is sent until you approve it in Inbox.
      </p>
      {data === undefined ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : empty ? (
        <p className="py-4 text-[15px] text-secondary">No plan talk in your group chats lately.</p>
      ) : (
        <div className="mt-1 divide-y divide-divider">
          {data.plans.map((p) => (
            <PlanRow key={p._id} p={p} onError={onError} />
          ))}
          {data.spotted.map((s) => (
            <SpottedRow key={s.messageId} s={s} onError={onError} />
          ))}
        </div>
      )}
      {toast.node}
    </Card>
  );
}

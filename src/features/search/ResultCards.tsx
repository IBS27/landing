import { Link, useNavigate } from "@tanstack/react-router";
import { Check, MapPin, MessageCircle, Star, UserCheck, UserPlus, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM } from "@/app/viewer";
import { cn, compactCount, plural, price } from "@/lib/format";
import { Avatar, Button, Card, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type {
  EventResult,
  GroupResult,
  ListingResult,
  PageResult,
  PersonResult,
  PlaceResult,
} from "../../../convex/search";
import type { SearchTab } from "./params";

/* ---------- Shared pieces ---------- */

export function ModuleCard({
  title,
  children,
  seeAll,
  q,
}: {
  title: string;
  children: ReactNode;
  /** Tab the "See all" button opens. */
  seeAll?: SearchTab;
  q: string;
}) {
  return (
    <Card className="rounded-xl p-4">
      <h2 className="pb-1 font-bold text-[20px] text-primary leading-6">{title}</h2>
      <div className="flex flex-col">{children}</div>
      {seeAll && (
        <Link
          to="/search/$tab"
          params={{ tab: seeAll }}
          search={{ q }}
          className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          See all
        </Link>
      )}
    </Card>
  );
}

/** One result: 60px thumb, title, meta lines and an action on the right. */
function ResultRow({
  thumb,
  title,
  meta,
  action,
  className,
}: {
  thumb: ReactNode;
  title: ReactNode;
  meta: ReactNode[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[76px] items-center gap-3 py-2", className)}>
      <div className="flex shrink-0 [&>*]:flex">{thumb}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] text-primary leading-[22px]">{title}</div>
        {meta.filter(Boolean).map((m, i) => (
          <div key={i} className="truncate text-[15px] text-secondary leading-5">
            {m}
          </div>
        ))}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function useMessage() {
  const getOrCreateDm = useM(api.conversations.getOrCreateDm);
  const { openChat } = useChatDock();
  return async (userId: PersonResult["_id"]) => openChat(await getOrCreateDm({ userId }));
}

/* ---------- People ---------- */

function personMeta(p: PersonResult) {
  const lines: string[] = [];
  const first: string[] = [];
  if (p.friendState === "friends") first.push("Friend");
  if (p.friendState === "self") first.push("You");
  if (p.city) first.push(`Lives in ${p.city}`);
  if (first.length) lines.push(first.join(" · "));
  if (p.mutualCount > 0 && p.friendState !== "friends")
    lines.push(plural(p.mutualCount, "mutual friend"));
  else if (p.work) lines.push(p.work);
  else if (p.school) lines.push(`Studied at ${p.school}`);
  return lines;
}

function PersonAction({ p }: { p: PersonResult }) {
  const send = useM(api.friends.sendRequest);
  const cancel = useM(api.friends.cancelRequest);
  const accept = useM(api.friends.acceptRequest);
  const message = useMessage();
  switch (p.friendState) {
    case "self":
      return null;
    case "friends":
      return (
        <Button
          icon={<MessageCircle size={16} strokeWidth={2.4} />}
          onClick={() => void message(p._id)}
        >
          Message
        </Button>
      );
    case "outgoing":
      return (
        <Button
          icon={<UserX size={16} strokeWidth={2.4} />}
          onClick={() => void cancel({ userId: p._id })}
        >
          Cancel request
        </Button>
      );
    case "incoming":
      return (
        <Button
          variant="primary"
          icon={<UserCheck size={16} strokeWidth={2.4} />}
          onClick={() => void accept({ userId: p._id })}
        >
          Confirm request
        </Button>
      );
    default:
      return (
        <Button
          variant="soft"
          icon={<UserPlus size={16} strokeWidth={2.4} />}
          onClick={() => void send({ userId: p._id })}
        >
          Add friend
        </Button>
      );
  }
}

export function PersonRow({ p }: { p: PersonResult }) {
  return (
    <ResultRow
      thumb={
        <Link to="/$username" params={{ username: p.username }}>
          <Avatar src={p.avatar} size={60} />
        </Link>
      }
      title={
        <span className="inline-flex items-center gap-1">
          <Link
            to="/$username"
            params={{ username: p.username }}
            className="font-medium hover:underline"
          >
            {p.name}
          </Link>
          {p.verified && <VerifiedBadge />}
        </span>
      }
      meta={personMeta(p)}
      action={<PersonAction p={p} />}
    />
  );
}

/* ---------- Pages ---------- */

export function PageRow({ page }: { page: PageResult }) {
  const toggle = useM(api.pages.toggleFollow);
  return (
    <ResultRow
      thumb={
        <Link to="/$username" params={{ username: page.username }}>
          <Avatar src={page.avatar} size={60} />
        </Link>
      }
      title={
        <span className="inline-flex items-center gap-1">
          <Link
            to="/$username"
            params={{ username: page.username }}
            className="font-medium hover:underline"
          >
            {page.name}
          </Link>
          {page.verified && <VerifiedBadge />}
        </span>
      }
      meta={[
        ["Page", page.category].filter(Boolean).join(" · "),
        `${compactCount(page.followerCount)} followers`,
      ]}
      action={
        page.following ? (
          <Button
            icon={<Check size={16} strokeWidth={2.6} />}
            onClick={() => void toggle({ pageId: page._id })}
          >
            Following
          </Button>
        ) : (
          <Button variant="soft" onClick={() => void toggle({ pageId: page._id })}>
            Follow
          </Button>
        )
      }
    />
  );
}

/* ---------- Groups ---------- */

function activity(n: number) {
  const perDay = n / 30;
  if (perDay >= 10) return "10+ posts a day";
  if (perDay >= 1) return `${Math.floor(perDay)} post${Math.floor(perDay) === 1 ? "" : "s"} a day`;
  const perWeek = n / 4.3;
  if (perWeek >= 1)
    return `${Math.floor(perWeek)} post${Math.floor(perWeek) === 1 ? "" : "s"} a week`;
  if (n > 0) return `${n} post${n === 1 ? "" : "s"} a month`;
  return null;
}

export function GroupRow({ g }: { g: GroupResult }) {
  const join = useM(api.groups.join);
  const navigate = useNavigate();
  return (
    <ResultRow
      thumb={
        <Link to="/groups/$groupId" params={{ groupId: g.slug }}>
          <Avatar src={g.cover} size={60} square />
        </Link>
      }
      title={
        <Link to="/groups/$groupId" params={{ groupId: g.slug }} className="hover:underline">
          {g.name}
        </Link>
      }
      meta={[
        [
          g.privacy === "public" ? "Public" : "Private",
          `${compactCount(g.memberCount)} members`,
          activity(g.recentPosts),
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
      action={
        g.joined ? (
          <Button
            onClick={() => void navigate({ to: "/groups/$groupId", params: { groupId: g.slug } })}
          >
            Visit
          </Button>
        ) : (
          <Button variant="soft" onClick={() => void join({ groupId: g._id })}>
            Join
          </Button>
        )
      }
    />
  );
}

/* ---------- Events ---------- */

const eventFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function eventDate(ts: number) {
  const parts = eventFmt.formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const minute = get("minute");
  const time = `${get("hour")}${minute === "00" ? "" : `:${minute}`} ${get("dayPeriod")}`;
  return `${get("weekday")}, ${get("month")} ${get("day")} at ${time}`.toUpperCase();
}

export function EventRow({ e }: { e: EventResult }) {
  const respond = useM(api.events.respond);
  const interested = e.viewerStatus === "interested";
  const going = e.viewerStatus === "going";
  return (
    <ResultRow
      thumb={
        <Link to="/events/$eventId" params={{ eventId: e._id }}>
          <Avatar src={e.cover} size={60} square />
        </Link>
      }
      title={
        <>
          <div className="font-semibold text-[13px] text-[#F02849] leading-4">
            {eventDate(e.startAt)}
          </div>
          <Link
            to="/events/$eventId"
            params={{ eventId: e._id }}
            className="line-clamp-2 font-medium hover:underline"
          >
            {e.title}
          </Link>
        </>
      }
      meta={[
        [
          e.online ? "Online" : (e.venue ?? e.city),
          e.interestedCount ? `${compactCount(e.interestedCount)} interested` : null,
          e.goingCount ? `${compactCount(e.goingCount)} going` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
      action={
        going ? (
          <Button
            variant="soft"
            icon={<Check size={16} strokeWidth={2.6} />}
            onClick={() => void respond({ eventId: e._id, status: "none" })}
          >
            Going
          </Button>
        ) : (
          <Button
            variant={interested ? "soft" : "secondary"}
            icon={<Star size={16} strokeWidth={2.4} fill={interested ? "currentColor" : "none"} />}
            onClick={() =>
              void respond({ eventId: e._id, status: interested ? "none" : "interested" })
            }
          >
            Interested
          </Button>
        )
      }
    />
  );
}

/* ---------- Marketplace ---------- */

export function ListingTile({ l }: { l: ListingResult }) {
  return (
    <Link
      to="/marketplace/item/$listingId"
      params={{ listingId: l._id }}
      className="group block min-w-0"
    >
      <div className="aspect-square overflow-hidden rounded-lg bg-btn">
        {l.photo && (
          <img
            src={l.photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-[filter] group-hover:brightness-95"
          />
        )}
      </div>
      <div className="pt-1.5 font-semibold text-[17px] text-primary leading-[22px]">
        {price(l.price)}
      </div>
      <div className="line-clamp-2 text-[15px] text-primary leading-5">{l.title}</div>
      <div className="truncate text-[13px] text-secondary leading-4">{l.location}</div>
    </Link>
  );
}

export function ListingGrid({ items }: { items: ListingResult[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-2">
      {items.map((l) => (
        <ListingTile key={l._id} l={l} />
      ))}
    </div>
  );
}

/* ---------- Places ---------- */

export function PlaceRow({ p }: { p: PlaceResult }) {
  return (
    <ResultRow
      thumb={
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-btn text-icon">
          <MapPin size={28} strokeWidth={2} />
        </span>
      }
      title={
        <Link
          to="/search/$tab"
          params={{ tab: "posts" }}
          search={{ q: p.name }}
          className="font-medium hover:underline"
        >
          {p.name}
        </Link>
      }
      meta={[
        [
          p.postCount ? plural(p.postCount, "post") : null,
          p.eventCount ? plural(p.eventCount, "event") : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
    />
  );
}

/* ---------- Empty ---------- */

export function NoResults() {
  return (
    <Card className="flex flex-col items-center rounded-xl px-6 pt-10 pb-12 text-center">
      <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden>
        <circle cx="56" cy="56" r="56" fill="var(--secondary-button)" />
        <rect x="30" y="26" width="40" height="52" rx="5" fill="var(--card)" />
        <rect x="37" y="36" width="26" height="4" rx="2" fill="var(--divider)" />
        <rect x="37" y="45" width="20" height="4" rx="2" fill="var(--divider)" />
        <rect x="37" y="54" width="23" height="4" rx="2" fill="var(--divider)" />
        <circle cx="66" cy="66" r="14" fill="none" stroke="var(--fb-blue)" strokeWidth="6" />
        <path d="m76 76 12 12" stroke="var(--fb-blue)" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <h2 className="mt-4 font-bold text-[20px] text-primary leading-6">
        We didn't find any results
      </h2>
      <p className="mt-1 max-w-[420px] text-[15px] text-secondary leading-5">
        Make sure everything is spelled correctly or try different keywords.
      </p>
    </Card>
  );
}

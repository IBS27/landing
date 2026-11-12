import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronDown,
  CircleCheck,
  Clock,
  Link2,
  Lock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Users,
  Video,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { PostCard, PostSkeleton } from "@/features/posts";
import { FriendsAudienceIcon, GlobeIcon } from "@/features/posts/icons";
import { cn, compactCount } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/ui/overlays";
import { Avatar, Button, Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  EnvelopeIcon,
  InterestedButton,
  ResponseMenu,
  SaveMenuItem,
  ShareArrowIcon,
  ShareEventDialog,
  StarIcon,
  ToastProvider,
  useCopyLink,
} from "./EventActions";
import { statsLine } from "./EventCard";
import { GuestsDialog, InviteDialog } from "./EventDialogs";
import { EventsLayout, EventsRail } from "./EventsRail";
import { duration, hideBroken, longDate } from "./format";
import { StaticMap } from "./StaticMap";

type EventView = NonNullable<FunctionReturnType<typeof api.events.get>>;
type Tab = "about" | "discussion";

/** /events/$eventId — the event permalink. */
export function EventPage({ eventId, tab }: { eventId: string; tab: Tab }) {
  const event = useQ(api.events.get, { eventId });
  return (
    <ToastProvider>
      <EventsLayout
        rail={
          <EventsRail
            section="none"
            label="Event Permalink Left Rail"
            recommendedFor={event?._id}
          />
        }
      >
        {event === undefined ? (
          <HeaderSkeleton />
        ) : event === null ? (
          <Unavailable />
        ) : (
          <EventBody event={event} tab={tab} />
        )}
      </EventsLayout>
    </ToastProvider>
  );
}

function Unavailable() {
  return (
    <div className="flex flex-col items-center px-4 pt-[180px] text-center">
      <svg viewBox="0 0 112 112" width="112" height="112" className="text-secondary" aria-hidden>
        <rect
          x="16"
          y="24"
          width="80"
          height="64"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          d="M40 52l32 16M72 52 40 68"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <h1 className="mt-4 font-bold text-[20px] text-secondary leading-6">
        This Page Isn't Available
      </h1>
      <p className="mt-2 max-w-[452px] text-[17px] text-secondary leading-5">
        The link may be broken, or the page may have been removed. Check to see if the link you're
        trying to open is correct.
      </p>
      <Link
        to="/"
        className="mt-6 flex h-10 items-center rounded-lg bg-btn-primary px-12 font-semibold text-[17px] text-white hover:bg-btn-primary-hover"
      >
        Go to Feed
      </Link>
      <Link to="/events" className="mt-4 font-semibold text-[17px] text-link hover:underline">
        Go back
      </Link>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="bg-card pb-4">
      <Skeleton className="mx-auto h-[350px] w-full max-w-[665px] rounded-t-none" />
      <div className="mx-auto max-w-[1080px] space-y-3 px-7 pt-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-7 w-[420px]" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

function EventBody({ event, tab }: { event: EventView; tab: Tab }) {
  const [dialog, setDialog] = useState<
    null | "invite" | "share" | { guests: "going" | "interested" | "invited" }
  >(null);
  const location = event.online ? "Online" : (event.venue ?? event.address ?? event.city);
  const shareTarget = { ...event, location };

  return (
    <>
      <EventHeader
        event={event}
        tab={tab}
        location={location}
        onInvite={() => setDialog("invite")}
        onShare={() => setDialog("share")}
      />
      <div className="mx-auto flex max-w-[1080px] items-start gap-4 px-4 pt-4 pb-10">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {tab === "about" ? (
            <>
              <DetailsCard event={event} onGuests={() => setDialog({ guests: "going" })} />
              <HostCard event={event} />
              <SuggestedCard eventId={event._id} />
            </>
          ) : (
            <Discussion event={event} />
          )}
        </div>
        <div className="sticky top-[72px] hidden w-[432px] shrink-0 flex-col gap-4 lg:flex">
          {event.online ? (
            <Card className="rounded-xl p-4">
              <h2 className="font-bold text-[20px] text-primary leading-6">Online event</h2>
              <p className="mt-2 flex items-center gap-3 text-[15px] text-primary">
                <Video size={20} className="text-icon-secondary" />
                {event.viewerStatus === "going" || event.isHost
                  ? "The link is available to guests."
                  : "Respond Going to see the link."}
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-xl">
              <StaticMap seed={event._id} address={event.address} />
              <div className="px-4 py-3">
                <p className="font-semibold text-[17px] text-primary leading-5">
                  {event.venue ?? event.city}
                </p>
                <p className="mt-0.5 text-[15px] text-secondary leading-5">
                  {[event.address, event.city].filter(Boolean).join(", ")}
                </p>
              </div>
            </Card>
          )}
          <GuestsCard event={event} onSeeAll={(s) => setDialog({ guests: s })} />
          <p className="px-1 text-[13px] text-secondary leading-4">
            Privacy · Terms · Advertising · Ad Choices · Cookies · More · Meta © 2026
          </p>
        </div>
      </div>
      {dialog === "invite" && <InviteDialog eventId={event._id} onClose={() => setDialog(null)} />}
      {dialog === "share" && (
        <ShareEventDialog event={shareTarget} onClose={() => setDialog(null)} />
      )}
      {dialog && typeof dialog === "object" && (
        <GuestsDialog
          eventId={event._id}
          initial={dialog.guests}
          isHost={event.isHost}
          counts={{
            going: event.goingCount,
            interested: event.interestedCount,
            invited: event.invitedCount,
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/* ---------------- Header ---------------- */

const actionBtn =
  "flex h-9 items-center gap-1.5 rounded-lg px-3 font-semibold text-[15px] transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125";

function EventHeader({
  event,
  tab,
  location,
  onInvite,
  onShare,
}: {
  event: EventView;
  tab: Tab;
  location: string;
  onInvite: () => void;
  onShare: () => void;
}) {
  const respond = useM(api.events.respond);
  const copy = useCopyLink();
  const navigate = useNavigate();
  const day = new Date(event.startAt).getDate();
  const responded = event.viewerStatus === "going" || event.viewerStatus === "interested";

  return (
    <div className="relative overflow-hidden bg-card shadow-[0_1px_2px_var(--shadow-1)]">
      {/* Blurred cover backdrop fading into the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[608px]">
        <img
          src={event.cover}
          onError={hideBroken}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-90 blur-[40px]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--card)_0%,var(--card)_42%,color-mix(in_srgb,var(--card)_70%,transparent)_58%,transparent_100%)]" />
      </div>
      <div className="relative mx-auto max-w-[1080px] px-4">
        <div className="mx-auto aspect-[1.9] w-full max-w-[665px] overflow-hidden rounded-b-lg bg-btn">
          <img
            src={event.cover}
            onError={hideBroken}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="px-3">
          <div className="-mt-16 flex h-20 w-20 flex-col overflow-hidden rounded-lg bg-card shadow-[0_0_12px_rgba(0,0,0,.1)] dark:bg-[#3a3b3c]">
            <div className="h-5 shrink-0 bg-[#dd2334]" />
            <div className="flex flex-1 items-center justify-center font-semibold text-[40px] text-primary leading-none">
              {day}
            </div>
          </div>
          <p className="mt-[13px] font-bold text-[15px] text-negative leading-5">
            {longDate(event.startAt, event.endAt)}
          </p>
          <h1 className="mt-1.5 font-bold text-[28px] text-primary leading-8">{event.title}</h1>
          <p className="mt-1.5 text-[17px] text-secondary leading-5">{location}</p>
        </div>
        <div className="mt-[11px] h-px bg-divider" />
        <div className="flex h-[60px] items-center justify-between gap-2">
          <div className="flex h-full" role="tablist">
            {(["about", "discussion"] as const).map((t) => (
              <Link
                key={t}
                to="/events/$eventId"
                params={{ eventId: event._id }}
                search={t === "discussion" ? { tab: "discussion" } : {}}
                role="tab"
                aria-selected={tab === t}
                className={cn(
                  "relative flex h-full items-center px-4 font-semibold text-[15px]",
                  tab === t ? "text-link" : "text-secondary",
                )}
              >
                <span className={cn("rounded-lg px-1 py-2", tab !== t && "hover:bg-hover")}>
                  {t === "about" ? "About" : "Discussion"}
                </span>
                {tab === t && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-[1px] bg-fb" />
                )}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {event.isHost ? (
              <>
                <Link
                  to="/events/create"
                  search={{ edit: event._id }}
                  className={cn(actionBtn, "bg-btn text-btn-text")}
                >
                  <Pencil size={16} strokeWidth={2.4} />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={onInvite}
                  className={cn(actionBtn, "bg-btn-primary text-white")}
                >
                  <EnvelopeIcon />
                  Invite
                </button>
              </>
            ) : event.isPast ? null : responded ? (
              <>
                <ResponseMenu eventId={event._id} status={event.viewerStatus} align="end">
                  <button type="button" className={cn(actionBtn, "bg-btn-soft text-btn-soft-text")}>
                    {event.viewerStatus === "going" ? (
                      <CircleCheck size={16} strokeWidth={2.4} />
                    ) : (
                      <StarIcon filled />
                    )}
                    {event.viewerStatus === "going" ? "Going" : "Interested"}
                    <ChevronDown size={16} strokeWidth={2.6} />
                  </button>
                </ResponseMenu>
                <InviteButton onClick={onInvite} />
              </>
            ) : (
              <>
                <InterestedButton eventId={event._id} status={event.viewerStatus} />
                <button
                  type="button"
                  onClick={() => void respond({ eventId: event._id, status: "going" })}
                  className={cn(actionBtn, "bg-btn text-btn-text")}
                >
                  <CircleCheck size={16} strokeWidth={2.2} />
                  Going
                </button>
                <InviteButton onClick={onInvite} />
              </>
            )}
            <button
              type="button"
              aria-label="Share"
              onClick={onShare}
              className={cn(actionBtn, "w-12 justify-center bg-btn text-btn-text")}
            >
              <ShareArrowIcon />
            </button>
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More"
                  className={cn(actionBtn, "w-12 justify-center bg-btn text-btn-text")}
                >
                  <MoreHorizontal size={18} strokeWidth={2.6} />
                </button>
              </MenuTrigger>
              <MenuContent width={300}>
                <SaveMenuItem eventId={event._id} />
                <MenuItem
                  icon={<Link2 size={20} />}
                  label="Copy event link"
                  onSelect={() => copy(event._id)}
                />
                {event.isHost && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Pencil size={20} />}
                      label="Edit event"
                      onSelect={() =>
                        void navigate({ to: "/events/create", search: { edit: event._id } })
                      }
                    />
                  </>
                )}
                {!event.isHost && event.viewerStatus && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Users size={20} />}
                      label={event.viewerStatus === "invited" ? "Decline invitation" : "Can't go"}
                      onSelect={() => void respond({ eventId: event._id, status: "none" })}
                    />
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(actionBtn, "bg-btn text-btn-text")}>
      <EnvelopeIcon />
      Invite
    </button>
  );
}

/* ---------------- About cards ---------------- */

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 flex w-5 shrink-0 justify-center text-icon-secondary">{icon}</span>
      <div className="min-w-0 flex-1 text-[15px] text-primary leading-5">{children}</div>
    </div>
  );
}

function privacyLine(e: EventView) {
  switch (e.privacy) {
    case "public":
      return { icon: <GlobeIcon size={20} />, text: "Public · Anyone on or off Facebook" };
    case "friends":
      return {
        icon: <FriendsAudienceIcon size={20} />,
        text: `Friends · Friends of ${e.host.firstName}`,
      };
    case "group":
      return {
        icon: <Users size={20} />,
        text: `Group · Members of ${e.group?.name ?? "the group"}`,
      };
    default:
      return { icon: <Lock size={20} />, text: "Private · Only people who are invited" };
  }
}

function DetailsCard({ event, onGuests }: { event: EventView; onGuests: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const responded = event.goingCount + event.interestedCount;
  const privacy = privacyLine(event);
  const dur = duration(event.startAt, event.endAt);
  const long = event.description.length > 320;
  const desc = expanded || !long ? event.description : event.description.slice(0, 300).trimEnd();

  return (
    <Card className="rounded-xl p-4">
      <h2 className="mb-2 font-bold text-[20px] text-primary leading-6">Details</h2>
      {responded > 0 && (
        <Row icon={<Users size={20} fill="currentColor" />}>
          <button type="button" onClick={onGuests} className="hover:underline">
            {responded.toLocaleString("en-US")} {responded === 1 ? "person" : "people"} responded
          </button>
        </Row>
      )}
      <Row icon={<HostGlyph />}>
        Event by{" "}
        <Link
          to="/$username"
          params={{ username: event.host.username }}
          className="font-semibold hover:underline"
        >
          {event.host.name}
        </Link>
        {event.group && (
          <>
            {" "}
            in{" "}
            <Link
              to="/groups/$groupId"
              params={{ groupId: event.group.slug }}
              className="font-semibold hover:underline"
            >
              {event.group.name}
            </Link>
          </>
        )}
      </Row>
      <Row
        icon={
          event.online ? (
            <Video size={20} />
          ) : (
            <MapPin size={20} fill="currentColor" stroke="var(--card)" />
          )
        }
      >
        <span className="font-semibold">
          {event.online ? "Online event" : (event.venue ?? event.city)}
        </span>
      </Row>
      {dur && <Row icon={<Clock size={20} />}>Duration: {dur}</Row>}
      <Row icon={privacy.icon}>{privacy.text}</Row>
      {event.description && (
        <p className="mt-3 whitespace-pre-line text-[15px] text-primary leading-5">
          {desc}
          {long && !expanded && (
            <>
              …{" "}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="font-semibold hover:underline"
              >
                See more
              </button>
            </>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {[event.city, event.category].map((c) => (
          <Link
            key={c}
            to="/events/search"
            search={c === event.category ? { q: c, category: c } : { q: c }}
            className="rounded bg-btn px-2 py-1.5 font-semibold text-[13px] text-btn-text leading-4 hover:brightness-95 dark:hover:brightness-125"
          >
            {c}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function HostGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <circle cx="10" cy="5.75" r="3.75" />
      <path d="M3 16.25C3 12.8 5.9 11 10 11s7 1.8 7 5.25c0 .97-.78 1.75-1.75 1.75H4.75C3.78 18 3 17.22 3 16.25Z" />
    </svg>
  );
}

function HostCard({ event }: { event: EventView }) {
  const { host, hostInfo } = event;
  const isPage = host.kind === "page";
  const meta = [
    hostInfo.pastEvents > 0
      ? `${hostInfo.pastEvents} past event${hostInfo.pastEvents === 1 ? "" : "s"}`
      : null,
    isPage ? "Page" : hostInfo.isFriend ? "Friend" : null,
    hostInfo.pageCategory,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="rounded-xl p-4">
      <h2 className="mb-4 font-bold text-[20px] text-primary leading-6">Meet your host</h2>
      <div className="flex w-full max-w-[292px] flex-col items-center rounded-lg border border-divider p-4 text-center">
        <Link to="/$username" params={{ username: host.username }} className="hover:brightness-95">
          <Avatar src={host.avatar} size={168} />
        </Link>
        <Link
          to="/$username"
          params={{ username: host.username }}
          className="mt-3 font-semibold text-[17px] text-primary leading-5 hover:underline"
        >
          {host.name}
        </Link>
        <p className="mt-1 text-[13px] text-secondary leading-4">{meta}</p>
        {hostInfo.bio && (
          <p className="mt-2 line-clamp-3 text-[15px] text-primary leading-5">{hostInfo.bio}</p>
        )}
        <Link
          to="/$username"
          params={{ username: host.username }}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
        >
          {isPage ? "Learn more" : "View profile"}
        </Link>
      </div>
    </Card>
  );
}

function SuggestedCard({ eventId }: { eventId: Id<"events"> }) {
  const recs = useQ(api.events.recommended, { excludeId: eventId, limit: 3 });
  if (!recs || recs.length === 0) return null;
  return (
    <Card className="rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-[20px] text-primary leading-6">Suggested events</h2>
        <Link to="/events" className="rounded px-1 text-[15px] text-link hover:bg-hover">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {recs.map((e) => (
          <div
            key={e._id}
            className="relative flex flex-col overflow-hidden rounded-lg border border-divider"
          >
            <Link
              to="/events/$eventId"
              params={{ eventId: e._id }}
              className="absolute inset-0"
              aria-label={e.title}
            />
            <img
              src={e.cover}
              onError={hideBroken}
              alt=""
              className="pointer-events-none aspect-square w-full object-cover"
            />
            <div className="pointer-events-none flex flex-1 flex-col px-3 pt-2">
              <p className="font-semibold text-[13px] text-negative uppercase leading-4">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(new Date(e.startAt))}
              </p>
              <p className="mt-1 line-clamp-2 font-semibold text-[15px] text-primary leading-5">
                {e.title}
              </p>
              <p className="truncate text-[13px] text-secondary leading-4">{e.location}</p>
              <p className="mt-0.5 text-[13px] text-secondary leading-4">{statsLine(e)}</p>
            </div>
            <div className="relative px-3 pt-3 pb-3">
              <InterestedButton eventId={e._id} status={e.viewerStatus} className="w-full" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GuestsCard({
  event,
  onSeeAll,
}: {
  event: EventView;
  onSeeAll: (s: "going" | "interested") => void;
}) {
  const friends = [...event.friendsGoing, ...event.friendsInterested];
  const friendCount = event.friendsGoingCount + event.friendsInterestedCount;
  return (
    <Card className="rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[20px] text-primary leading-6">Guests</h2>
        <button
          type="button"
          onClick={() => onSeeAll("going")}
          className="rounded px-1 text-[15px] text-link hover:bg-hover"
        >
          See all
        </button>
      </div>
      <div className="mt-3 flex">
        {(["going", "interested"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeeAll(s)}
            className="flex flex-1 flex-col items-center rounded-lg py-1 hover:bg-hover"
          >
            <span className="font-bold text-[20px] text-primary leading-6">
              {compactCount(s === "going" ? event.goingCount : event.interestedCount)}
            </span>
            <span className="font-semibold text-[13px] text-secondary leading-4">
              {s === "going" ? "Going" : "Interested"}
            </span>
          </button>
        ))}
      </div>
      {friendCount > 0 && (
        <div className="mt-3 border-divider border-t pt-3">
          <div className="flex -space-x-1.5">
            {friends.slice(0, 8).map((u) => (
              <Link
                key={u._id}
                to="/$username"
                params={{ username: u.username }}
                title={u.name}
                className="rounded-full ring-2 ring-card"
              >
                <Avatar src={u.avatar} size={32} />
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-secondary leading-4">{friendSentence(event)}</p>
        </div>
      )}
    </Card>
  );
}

function friendSentence(e: EventView) {
  const first = e.friendsGoing[0] ?? e.friendsInterested[0];
  if (!first) return "";
  const total = e.friendsGoingCount + e.friendsInterestedCount;
  const verb = e.friendsGoing.length > 0 ? "going" : "interested";
  if (total === 1) return `${first.name} is ${verb}`;
  const others = total - 1;
  return `${first.name} and ${others} other friend${others === 1 ? "" : "s"} ${
    e.friendsGoing.length > 0 ? "responded" : "are interested"
  }`;
}

/* ---------------- Discussion ---------------- */

/** Stable ref callback: focuses the element once when it mounts. */
function focusOnMount(el: HTMLElement | null) {
  el?.focus();
}

function Discussion({ event }: { event: EventView }) {
  const viewer = useViewer();
  const posts = useQ(api.events.discussion, { eventId: event._id });
  const post = useM(api.events.post);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await post({ eventId: event._id, text });
      setText("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card className="rounded-xl px-4 py-3">
        <div className="flex items-start gap-2">
          <Avatar src={viewer.avatar} size={40} />
          {open ? (
            <div className="flex-1">
              <textarea
                ref={focusOnMount}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write something..."
                aria-label="Write something"
                rows={3}
                className="w-full resize-none rounded-2xl bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" className="text-link" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!text.trim() || busy}
                  onClick={() => void submit()}
                  className="w-24"
                >
                  Post
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="h-10 flex-1 rounded-full bg-input px-3 text-left text-[17px] text-secondary hover:brightness-95 dark:hover:brightness-125"
            >
              Write something...
            </button>
          )}
        </div>
      </Card>
      {posts === undefined ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <Card className="rounded-xl">
          <EmptyState title="No posts yet" body="Start the conversation by writing a post." />
        </Card>
      ) : (
        posts.map((p) => <PostCard key={p._id} post={p} />)
      )}
    </>
  );
}

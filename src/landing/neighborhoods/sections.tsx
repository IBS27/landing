import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Coffee,
  Footprints,
  Landmark,
  Library,
  MapPin,
  Mountain,
  Music,
  ShoppingBasket,
  Sparkles,
  Store,
  Trees,
  UsersRound,
  Utensils,
  Waves,
  Wine,
} from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { cardDate, hideBroken } from "@/features/events/format";
import { toEvent, toGroup, toProfile } from "@/landing/links";
import { NotForMe } from "@/landing/profile/NotForMe";
import { cn, compactCount, plural } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Avatar, Card } from "@/ui/primitives";
import type {
  ForYou,
  ForYouItem,
  HoodEvent,
  HoodGroup,
  HoodPerson,
  HoodPlace,
  Reason,
} from "../../../convex/lib/neighborhoodPage";
import type { UserSummary } from "../../../convex/lib/users";

/**
 * A neighborhood page's sections (#16). Each takes one neighborhood's data
 * from `neighborhoods.page` and lays itself out by its own width (container
 * queries), so "Try the neighborhood" (#19) can render two side by side.
 *
 * Shapes: cards and thumbnails use the 8px radius of Facebook's cards; chips
 * and pills are fully round.
 */

/* ───────────── "Not for me" ───────────── */

type Skips = { has: (id: string) => boolean; set: (id: string, on: boolean) => void };
const SkipsContext = createContext<Skips | null>(null);

/**
 * Cards skipped with "Not for me" during this visit. They stay on screen,
 * dimmed, so Undo is still there; cards skipped before are left out. Wrap a
 * page (or each compared neighborhood) so a skip shows on every copy of a card.
 */
export function SkipsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const value: Skips = {
    has: (id) => ids.has(id),
    set: (id, on) =>
      setIds((cur) => {
        const next = new Set(cur);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
  };
  return <SkipsContext.Provider value={value}>{children}</SkipsContext.Provider>;
}

function useSkips(): Skips {
  const shared = useContext(SkipsContext);
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  return (
    shared ?? {
      has: (id) => ids.has(id),
      set: (id, on) =>
        setIds((cur) => {
          const next = new Set(cur);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
    }
  );
}

/** Hide what was skipped on an earlier visit; keep what was skipped just now. */
function shown<T extends { skipped: boolean }>(skips: Skips, item: T, id: string) {
  return !item.skipped || skips.has(id);
}

/* ───────────── Shared bits ───────────── */

/** A section card: title, an optional line under it, and its body. */
export function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("@container overflow-hidden", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
          {sub && <p className="mt-0.5 text-[15px] text-secondary leading-5">{sub}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-comment px-3 py-3 text-[15px] text-secondary leading-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-icon">
        {icon}
      </span>
      {children}
    </div>
  );
}

/** "See all 12" / "See less" under a list. */
function MoreToggle({
  open,
  total,
  onToggle,
}: {
  open: boolean;
  total: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text transition-colors hover:brightness-95 active:scale-[0.99] dark:hover:brightness-125"
    >
      {open ? "See less" : `See all ${total}`}
    </button>
  );
}

function FacePile({ users }: { users: UserSummary[] }) {
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {users.map((u) => (
        <Avatar key={u._id} src={u.avatar} size={20} className="rounded-full ring-2 ring-card" />
      ))}
    </span>
  );
}

/** "Climbing · from your brief". */
function ReasonLine({ reason, className }: { reason: Reason; className?: string }) {
  const full = `${reason.label} · ${reason.because}${
    reason.also.length ? ` (also ${reason.also.join(", ")})` : ""
  }`;
  return (
    <p
      title={full}
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[13px] text-btn-soft-text leading-4",
        className,
      )}
    >
      <Sparkles size={13} strokeWidth={2.4} className="shrink-0" aria-hidden />
      <span className="truncate">
        <span className="font-semibold">{reason.label}</span>
        <span> · {reason.because}</span>
      </span>
    </p>
  );
}

const PLACE_ICONS: Record<string, typeof Coffee> = {
  bakery: Coffee,
  cafe: Coffee,
  bar: Wine,
  brewery: Wine,
  restaurant: Utensils,
  dessert: Utensils,
  "music-venue": Music,
  park: Trees,
  plaza: Trees,
  beach: Waves,
  trail: Mountain,
  stairway: Footprints,
  viewpoint: Mountain,
  museum: Landmark,
  landmark: Landmark,
  library: Library,
  bookstore: Library,
  market: ShoppingBasket,
  grocery: ShoppingBasket,
  shop: Store,
};

function PlaceTile({ place, size }: { place: HoodPlace; size: number }) {
  const Icon = PLACE_ICONS[place.kind] ?? MapPin;
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-btn-soft text-btn-soft-text"
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.4)} strokeWidth={2} />
    </span>
  );
}

function Thumb({ src, size }: { src: string; size: number }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-lg bg-comment"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={hideBroken}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

function groupLine(g: HoodGroup) {
  return `${g.privacy === "public" ? "Public" : "Private"} group · ${compactCount(g.memberCount)} ${
    g.memberCount === 1 ? "member" : "members"
  }`;
}

/** "Sofia is going", "Sofia and 2 other friends are going". */
function friendsLine(friends: UserSummary[], count: number, verb: { one: string; many: string }) {
  const [first] = friends;
  if (!first) return null;
  if (count === 1) return `${first.firstName} ${verb.one}`;
  return `${first.firstName} and ${plural(count - 1, "other friend")} ${verb.many}`;
}

/* ───────────── For you ───────────── */

/**
 * Groups, Events and places that share the viewer's interests, each saying
 * why. Without a City Profile it asks for the brief instead.
 */
export function ForYouSection({ forYou, label }: { forYou: ForYou; label: string }) {
  const skips = useSkips();
  if (forYou.state === "no_profile")
    return (
      <Section title="For you">
        <div className="flex flex-col gap-3 rounded-lg bg-comment p-4 @min-[520px]:flex-row @min-[520px]:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn-soft text-btn-soft-text">
            <Sparkles size={20} strokeWidth={2.2} />
          </span>
          <p className="min-w-0 flex-1 text-[15px] text-primary leading-5">
            Tell us what you're into and we'll pick out the Groups, Events and places in {label}{" "}
            that fit.
          </p>
          <Link
            to="/landing/welcome"
            className="flex h-9 shrink-0 items-center justify-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white transition-colors hover:bg-btn-primary-hover active:scale-[0.98]"
          >
            Set up your City Profile
          </Link>
        </div>
      </Section>
    );
  const items = forYou.items.filter((i) =>
    i.kind === "place" ? true : shown(skips, i.kind === "event" ? i.event : i.group, i.key),
  );
  return (
    <Section title="For you" sub={`Picked from your City Profile`}>
      {items.length === 0 ? (
        <Empty icon={<Sparkles size={18} />}>
          Nothing in {label} matches your interests yet. New Groups and Events show up here as
          they're posted.
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-2 @min-[600px]:grid-cols-2">
          {items.map((item) => (
            <li key={item.key} className="min-w-0">
              <ForYouCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ForYouCard({ item }: { item: ForYouItem }) {
  const skips = useSkips();
  const skipped = skips.has(item.key);
  let media: ReactNode;
  let title: ReactNode;
  let meta: string;
  let footer: ReactNode = null;
  if (item.kind === "event") {
    const e = item.event;
    media = <Thumb src={e.cover} size={64} />;
    title = (
      <Link {...toEvent(e._id)} className="hover:underline">
        {e.title}
      </Link>
    );
    meta = `${cardDate(e.startAt, e.endAt)} · ${e.place}`;
    footer = (
      <NotForMe targetKind="event" targetId={e._id} onChange={(on) => skips.set(item.key, on)} />
    );
  } else if (item.kind === "group") {
    const g = item.group;
    media = <Thumb src={g.cover} size={64} />;
    title = (
      <Link {...toGroup(g)} className="hover:underline">
        {g.name}
      </Link>
    );
    meta = groupLine(g);
    footer = (
      <NotForMe targetKind="group" targetId={g._id} onChange={(on) => skips.set(item.key, on)} />
    );
  } else {
    media = <PlaceTile place={item.place} size={64} />;
    title = item.place.name;
    meta = `${item.place.kindLabel} · ${item.place.at}`;
    footer = <SourcesChip sources={item.sources} />;
  }
  return (
    <article className="flex h-full gap-3 rounded-lg p-2">
      <div className={cn("shrink-0 transition-opacity", skipped && "opacity-50")}>{media}</div>
      <div className="min-w-0 flex-1">
        <div className={cn("transition-opacity", skipped && "opacity-50")}>
          <p className="line-clamp-2 font-semibold text-[15px] text-primary leading-5">{title}</p>
          <p className="mt-0.5 truncate text-[13px] text-secondary leading-4">{meta}</p>
          <ReasonLine reason={item.reason} className="mt-1.5" />
        </div>
        <div className={cn("mt-1.5 flex min-h-8 items-center", item.kind !== "place" && "-ml-2")}>
          {footer}
        </div>
      </div>
    </article>
  );
}

/* ───────────── Events ───────────── */

const EVENTS_SHOWN = 4;

/** Upcoming Events here (next 30 days), soonest first. */
export function EventsSection({ events, label }: { events: HoodEvent[]; label: string }) {
  const skips = useSkips();
  const [all, setAll] = useState(false);
  const list = events.filter((e) => shown(skips, e, `event:${e._id}`));
  return (
    <Section title="Upcoming events" sub="In the next 30 days">
      {list.length === 0 ? (
        <Empty icon={<CalendarDays size={18} />}>
          No upcoming events in {label} you can see yet.
        </Empty>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 @min-[440px]:grid-cols-2 @min-[760px]:grid-cols-3">
            {(all ? list : list.slice(0, EVENTS_SHOWN)).map((e) => (
              <li key={e._id} className="min-w-0">
                <EventTile event={e} />
              </li>
            ))}
          </ul>
          {list.length > EVENTS_SHOWN && (
            <MoreToggle open={all} total={list.length} onToggle={() => setAll((x) => !x)} />
          )}
        </>
      )}
    </Section>
  );
}

const STATUS_LABEL = { going: "Going", interested: "Interested", invited: "Invited" } as const;

function EventTile({ event: e }: { event: HoodEvent }) {
  const skips = useSkips();
  const key = `event:${e._id}`;
  const stats = [
    e.goingCount > 0 && `${compactCount(e.goingCount)} going`,
    e.interestedCount > 0 && `${compactCount(e.interestedCount)} interested`,
  ]
    .filter(Boolean)
    .join(" · ");
  const friends = friendsLine(e.friendsGoing, e.friendsGoing.length, {
    one: "is going",
    many: "are going",
  });
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg ring-1 ring-divider">
      <Link
        {...toEvent(e._id)}
        className={cn(
          "group/tile block outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
          skips.has(key) && "opacity-50",
        )}
      >
        <div className="relative aspect-[1.91/1] overflow-hidden bg-comment">
          <img
            src={e.cover}
            alt=""
            loading="lazy"
            onError={hideBroken}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/tile:scale-[1.03]"
          />
          {e.viewerStatus && (
            <span className="absolute top-2 left-2 rounded-full bg-card/95 px-2 py-0.5 font-semibold text-[12px] text-primary leading-4 shadow-base">
              {STATUS_LABEL[e.viewerStatus]}
            </span>
          )}
        </div>
        <div className="px-3 pt-2.5">
          <p className="font-semibold text-[13px] text-badge uppercase leading-4">
            {cardDate(e.startAt, e.endAt)}
          </p>
          <p className="mt-1 line-clamp-2 font-semibold text-[15px] text-primary leading-5 group-hover/tile:underline">
            {e.title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-secondary leading-4">{e.place}</p>
          {stats && <p className="mt-0.5 text-[13px] text-secondary leading-4">{stats}</p>}
          {friends && (
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[13px] text-secondary leading-4">
              <FacePile users={e.friendsGoing} />
              <span className="truncate">{friends}</span>
            </p>
          )}
        </div>
      </Link>
      {/* Nothing to skip on an Event you're going to. */}
      {e.viewerStatus === "going" ? (
        <div className="pb-3" />
      ) : (
        <div className="mt-auto flex items-center px-1 pt-1 pb-1.5">
          <NotForMe targetKind="event" targetId={e._id} onChange={(on) => skips.set(key, on)} />
        </div>
      )}
    </article>
  );
}

/* ───────────── Groups ───────────── */

const GROUPS_SHOWN = 4;

/** Groups based here, most active first. */
export function GroupsSection({ groups, label }: { groups: HoodGroup[]; label: string }) {
  const skips = useSkips();
  const [all, setAll] = useState(false);
  const list = groups.filter((g) => shown(skips, g, `group:${g._id}`));
  return (
    <Section title="Groups" sub={`Based in ${label}`}>
      {list.length === 0 ? (
        <Empty icon={<UsersRound size={18} />}>No Groups are based in {label} yet.</Empty>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-1 @min-[600px]:grid-cols-2 @min-[600px]:gap-x-3">
            {(all ? list : list.slice(0, GROUPS_SHOWN)).map((g) => (
              <li key={g._id} className="min-w-0">
                <GroupRow group={g} />
              </li>
            ))}
          </ul>
          {list.length > GROUPS_SHOWN && (
            <MoreToggle open={all} total={list.length} onToggle={() => setAll((x) => !x)} />
          )}
        </>
      )}
    </Section>
  );
}

function GroupRow({ group: g }: { group: HoodGroup }) {
  const skips = useSkips();
  const key = `group:${g._id}`;
  const friends = friendsLine(g.friends, g.friendCount, {
    one: "is a member",
    many: "are members",
  });
  return (
    <article className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-hover">
      <Link
        {...toGroup(g)}
        className={cn("flex min-w-0 flex-1 gap-3", skips.has(key) && "opacity-50")}
      >
        <Thumb src={g.cover} size={60} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold text-[15px] text-primary leading-5 hover:underline">
            {g.name}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-secondary leading-4">
            {g.joined ? "Joined · " : ""}
            {groupLine(g)}
          </p>
          {friends && (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-secondary leading-4">
              <FacePile users={g.friends} />
              <span className="truncate">{friends}</span>
            </p>
          )}
        </div>
      </Link>
      {!g.joined && (
        <div className="-mr-1 shrink-0 self-center">
          <NotForMe targetKind="group" targetId={g._id} onChange={(on) => skips.set(key, on)} />
        </div>
      )}
    </article>
  );
}

/* ───────────── People ───────────── */

/**
 * People the viewer knows who are active here: crew members who picked this
 * neighborhood too, friends, and friends of friends, each with what links
 * them to it (a Group they're in, an Event they're going to).
 */
export function PeopleSection({ people, label }: { people: HoodPerson[]; label: string }) {
  return (
    <Section title="People you may know here" sub={`In ${label}'s Groups and Events`}>
      {people.length === 0 ? (
        <Empty icon={<UsersRound size={18} />}>
          None of your friends or their friends are in {label}'s Groups or Events yet.
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-1 @min-[600px]:grid-cols-2 @min-[600px]:gap-x-3">
          {people.map((p) => (
            <li key={p.user._id} className="min-w-0">
              <PersonRow person={p} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function tieLine(p: HoodPerson) {
  if (p.crew) return "In your Move-in Crew";
  if (p.tie === "friend") return "Friend";
  const [a, b] = p.mutual;
  if (!a) return plural(p.mutualCount, "mutual friend");
  if (p.mutualCount === 1) return `Friends with ${a.firstName}`;
  if (p.mutualCount === 2 && b) return `Friends with ${a.firstName} and ${b.firstName}`;
  return `Friends with ${a.firstName} and ${plural(p.mutualCount - 1, "other")}`;
}

function viaLine(via: HoodPerson["via"]) {
  const first = via[0];
  if (!first) return null;
  const text = first.kind === "group" ? `Member of ${first.name}` : `Going to ${first.title}`;
  return via.length > 1 ? `${text} and ${via.length - 1} more` : text;
}

function PersonRow({ person: p }: { person: HoodPerson }) {
  const via = viaLine(p.via);
  return (
    <Link
      {...toProfile(p.user)}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
    >
      <Avatar src={p.user.avatar} size={48} online={p.user.online} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[15px] text-primary leading-5">
          {p.user.name}
        </span>
        <span
          className={cn(
            "block truncate text-[13px] leading-4",
            p.crew ? "font-semibold text-btn-soft-text" : "text-secondary",
          )}
        >
          {tieLine(p)}
        </span>
        {via && (
          <span className="mt-0.5 block truncate text-[13px] text-secondary leading-4">{via}</span>
        )}
      </span>
    </Link>
  );
}

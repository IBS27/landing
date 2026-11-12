import { Link } from "@tanstack/react-router";
import { Link2, MoreHorizontal, Share2 } from "lucide-react";
import { useState } from "react";
import { compactCount } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Card, Skeleton } from "@/ui/primitives";
import type { EventCardView } from "../../../convex/events";
import {
  GoingButton,
  InterestedButton,
  SaveMenuItem,
  ShareArrowIcon,
  ShareEventDialog,
  useCopyLink,
} from "./EventActions";
import { cardDate, hideBroken, relativeDate } from "./format";

export function statsLine(e: Pick<EventCardView, "interestedCount" | "goingCount">) {
  const parts = [];
  if (e.interestedCount > 0) parts.push(`${compactCount(e.interestedCount)} interested`);
  if (e.goingCount > 0) parts.push(`${compactCount(e.goingCount)} going`);
  return parts.join(" · ");
}

/** Discover grid card: cover, date, title, place, stats, Interested + Share. */
export function EventCard({ event }: { event: EventCardView }) {
  const [sharing, setSharing] = useState(false);
  const copy = useCopyLink();
  return (
    <Card className="relative flex h-full min-h-[316px] flex-col overflow-hidden rounded-xl">
      <Link
        to="/events/$eventId"
        params={{ eventId: event._id }}
        className="absolute inset-0 z-0"
        aria-label={event.title}
      />
      <div className="pointer-events-none relative h-[142px] bg-[#c9ccd1] dark:bg-[#3e4042]">
        <img
          src={event.cover}
          onError={hideBroken}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="More options for this event"
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-white hover:bg-black/70"
          >
            <MoreHorizontal size={16} strokeWidth={2.6} />
          </button>
        </MenuTrigger>
        <MenuContent width={300}>
          <SaveMenuItem eventId={event._id} />
          <MenuItem icon={<Share2 size={20} />} label="Share" onSelect={() => setSharing(true)} />
          <MenuItem icon={<Link2 size={20} />} label="Copy link" onSelect={() => copy(event._id)} />
        </MenuContent>
      </Menu>
      <div className="pointer-events-none relative flex flex-col px-4 pt-3">
        <p className="font-semibold text-[13px] text-primary leading-4">
          {cardDate(event.startAt, event.endAt)}
        </p>
        <p className="mt-1 line-clamp-2 font-semibold text-[17px] text-primary leading-5">
          {event.title}
        </p>
        <p className="mt-1 truncate font-semibold text-[15px] text-secondary leading-5">
          {event.location}
        </p>
        <p className="mt-1 text-[13px] text-secondary leading-4">{statsLine(event)}</p>
      </div>
      <div className="relative z-10 mt-auto flex gap-2 px-4 pt-2.5 pb-3">
        {event.viewerStatus === "invited" && <GoingButton eventId={event._id} />}
        <InterestedButton eventId={event._id} status={event.viewerStatus} className="flex-1" />
        <button
          type="button"
          aria-label="Share"
          onClick={() => setSharing(true)}
          className="flex h-9 w-12 items-center justify-center rounded-lg bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
        >
          <ShareArrowIcon />
        </button>
      </div>
      {sharing && <ShareEventDialog event={event} onClose={() => setSharing(false)} />}
    </Card>
  );
}

export function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl" aria-hidden>
      <Skeleton className="h-[142px] rounded-none" />
      <div className="space-y-2 px-4 pt-3 pb-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-6 h-9 w-full" />
      </div>
    </Card>
  );
}

/** Search-results row: 60px thumb, uppercase date, title, meta, soft "Interested". */
export function EventRow({ event }: { event: EventCardView }) {
  const meta = [
    event.interestedCount > 0
      ? `${event.interestedCount.toLocaleString("en-US")} ${event.interestedCount === 1 ? "person" : "people"} interested`
      : event.goingCount > 0
        ? `${event.goingCount.toLocaleString("en-US")} ${event.goingCount === 1 ? "person" : "people"} going`
        : null,
    event.location,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="relative flex items-center gap-3 rounded-xl px-4 py-2 hover:bg-[color-mix(in_srgb,var(--card),var(--primary-text)_3%)]">
      <Link
        to="/events/$eventId"
        params={{ eventId: event._id }}
        className="absolute inset-0 rounded-xl"
        aria-label={event.title}
      />
      <img
        src={event.cover}
        onError={hideBroken}
        alt=""
        className="pointer-events-none my-2 h-[60px] w-[60px] shrink-0 rounded-lg object-cover"
      />
      <div className="pointer-events-none min-w-0 flex-1 py-2">
        <p className="text-[13px] text-primary uppercase leading-4">
          {relativeDate(event.startAt, event.endAt, Date.now(), true)}
        </p>
        <p className="line-clamp-2 font-medium text-[17px] text-primary leading-5">{event.title}</p>
        <p className="truncate text-[15px] text-secondary leading-5">{meta}</p>
      </div>
      <InterestedButton
        eventId={event._id}
        status={event.viewerStatus}
        compact
        className="relative shrink-0"
      />
    </Card>
  );
}

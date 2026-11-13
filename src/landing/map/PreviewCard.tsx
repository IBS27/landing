import { Link } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { cardDate } from "@/features/events/format";
import { cn, compactCount, plural, price } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { toEvent, toGroup, toListing } from "../links";
import type { EventPin, GroupPin, ListingPin, RouteStop, StopLink } from "./types";

/**
 * The card a pin opens: a photo, the title and one key fact (price, date or
 * member count), linking to the thing's own Facebook page. Desktop shows it
 * above the pin; at phone width it's a sheet along the bottom of the map.
 */

export type Selected =
  | { kind: "listing"; pin: ListingPin }
  | { kind: "event"; pin: EventPin }
  | { kind: "group"; pin: GroupPin }
  | { kind: "stop"; stop: RouteStop; n: number };

export function PreviewCard({
  selected,
  compact,
  onClose,
}: {
  selected: Selected;
  compact: boolean;
  onClose: () => void;
}) {
  const close = (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className={cn(
        "absolute flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors",
        compact
          ? "top-2 right-2 bg-btn hover:bg-hover"
          : "top-2 right-2 bg-card/90 shadow-base backdrop-blur-sm hover:bg-card",
      )}
    >
      <X size={16} strokeWidth={2.5} />
    </button>
  );
  return (
    <div
      role="dialog"
      aria-label={titleOf(selected)}
      className={cn(
        "lm-card relative overflow-hidden bg-card text-left shadow-elevated",
        compact ? "w-full rounded-[12px]" : "w-[288px] rounded-[12px]",
      )}
    >
      {selected.kind === "stop" ? (
        <StopBody stop={selected.stop} n={selected.n} compact={compact} />
      ) : (
        <PinBody selected={selected} compact={compact} />
      )}
      {close}
    </div>
  );
}

function titleOf(s: Selected) {
  if (s.kind === "stop") return `Stop ${s.n}: ${s.stop.name}`;
  if (s.kind === "group") return s.pin.name;
  return s.pin.title;
}

function PinBody({
  selected,
  compact,
}: {
  selected: Exclude<Selected, { kind: "stop" }>;
  compact: boolean;
}) {
  let photo: string | null;
  let body: ReactNode;
  let link: ReturnType<typeof toListing> | ReturnType<typeof toEvent> | ReturnType<typeof toGroup>;
  if (selected.kind === "listing") {
    const l = selected.pin;
    photo = l.photo;
    link = toListing(l._id);
    body = (
      <>
        <p className="font-bold text-[17px] text-primary leading-[22px]">
          {price(l.price)}
          {l.home?.listingType !== "sale" && l.home ? (
            <span className="font-normal text-[13px] text-secondary"> / month</span>
          ) : null}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[15px] text-primary leading-5">{l.title}</p>
        <p className="mt-1 text-[13px] text-secondary leading-4">
          {l.home ? `${homeLine(l.home)} in ${l.area.split(",")[0]}` : l.area}
        </p>
        <p className="mt-0.5 text-[12px] text-secondary leading-4">Location is approximate</p>
      </>
    );
  } else if (selected.kind === "event") {
    const e = selected.pin;
    photo = e.cover;
    link = toEvent(e._id);
    body = (
      <>
        <p className="font-semibold text-[13px] text-badge uppercase leading-4">
          {cardDate(e.startAt, null)}
        </p>
        <p className="mt-1 line-clamp-2 font-bold text-[15px] text-primary leading-5">{e.title}</p>
        <p className="mt-1 line-clamp-1 text-[13px] text-secondary leading-4">{e.place}</p>
      </>
    );
  } else {
    const g = selected.pin;
    photo = g.cover;
    link = toGroup({ slug: g.slug });
    body = (
      <>
        <p className="line-clamp-2 font-bold text-[15px] text-primary leading-5">{g.name}</p>
        <p className="mt-1 text-[13px] text-secondary leading-4">
          {g.privacy === "public" ? "Public" : "Private"} group · {compactCount(g.memberCount)}{" "}
          {g.memberCount === 1 ? "member" : "members"}
        </p>
      </>
    );
  }
  return (
    <Link
      {...link}
      className={cn(
        "group/card block outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
        compact && "flex items-center gap-3 p-2 pr-10",
      )}
    >
      {photo && (
        <div
          className={cn(
            "shrink-0 overflow-hidden bg-comment",
            compact ? "h-[84px] w-[84px] rounded-[8px]" : "h-[148px] w-full",
          )}
        >
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.03]"
          />
        </div>
      )}
      <div className={cn("min-w-0", compact ? "py-1" : "px-3 pt-2.5 pb-3")}>{body}</div>
    </Link>
  );
}

/** "Private room", "Studio" or "2 beds · 1 bath". */
function homeLine(h: NonNullable<ListingPin["home"]>) {
  if (h.propertyType === "room") return "Private room";
  if (h.bedrooms === 0 || h.propertyType === "studio") return "Studio";
  return `${plural(h.bedrooms, "bed")} · ${plural(h.bathrooms, "bath")}`;
}

function stopLink(link: StopLink) {
  if (link.kind === "event") return { to: toEvent(link._id), label: "View event" };
  if (link.kind === "group") return { to: toGroup({ slug: link.slug }), label: "View group" };
  return { to: toListing(link._id), label: "View listing" };
}

function StopBody({ stop, n, compact }: { stop: RouteStop; n: number; compact: boolean }) {
  const link = stop.link ? stopLink(stop.link) : null;
  return (
    <div className={cn("pr-10", compact ? "p-3" : "px-3 pt-3 pb-3")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fb font-bold text-[13px] text-white tabular-nums">
          {n}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-[15px] text-primary leading-5">{stop.name}</p>
          {stop.note && (
            <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">{stop.note}</p>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[34px]">
        <SourcesChip sources={stop.sources} />
        {link && (
          <Link
            {...link.to}
            className="inline-flex h-6 items-center gap-0.5 rounded-full px-1 font-semibold text-[13px] text-link hover:underline"
          >
            {link.label}
            <ChevronRight size={14} strokeWidth={2.5} />
          </Link>
        )}
      </div>
    </div>
  );
}

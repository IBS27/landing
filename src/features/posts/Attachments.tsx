import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { cn, price } from "@/lib/format";
import type { ResolvedAttachment } from "./types";

const eventDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Attachment cards under a post: link previews, Marketplace listings, events. */
export function AttachmentCard({ att }: { att: ResolvedAttachment }) {
  if (att.kind === "link")
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="group block">
        {att.image && (
          <img
            src={att.image}
            alt=""
            loading="lazy"
            className="aspect-[1.91/1] w-full border-divider border-y object-cover"
          />
        )}
        <div className="bg-comment px-4 py-3 group-hover:brightness-[0.97] dark:group-hover:brightness-110">
          <p className="truncate text-[13px] text-secondary uppercase leading-4">{att.domain}</p>
          <p className="mt-0.5 line-clamp-2 font-semibold text-[17px] text-primary leading-[22px]">
            {att.title}
          </p>
          {att.description && (
            <p className="mt-0.5 truncate text-[15px] text-secondary leading-5">
              {att.description}
            </p>
          )}
        </div>
      </a>
    );

  if (att.kind === "listing")
    return (
      <Link
        to="/marketplace/item/$listingId"
        params={{ listingId: att.listingId }}
        className="group block"
      >
        {att.photo && (
          <img
            src={att.photo}
            alt=""
            loading="lazy"
            className="aspect-square max-h-[500px] w-full border-divider border-y object-cover"
          />
        )}
        <div className="flex items-center gap-3 bg-comment px-4 py-3 group-hover:brightness-[0.97] dark:group-hover:brightness-110">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[17px] leading-[22px]">
              {att.status === "sold" ? (
                <span className="text-secondary line-through">{price(att.price)}</span>
              ) : (
                price(att.price)
              )}
              {att.status !== "active" && (
                <span className="ml-1 font-normal text-[15px] text-secondary">
                  · {att.status === "sold" ? "Sold" : "Pending"}
                </span>
              )}
            </p>
            <p className="truncate text-[15px] leading-5">{att.title}</p>
            <p className="truncate text-[13px] text-secondary leading-4">{att.location}</p>
          </div>
          <span className="flex h-9 shrink-0 items-center rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text">
            View listing
          </span>
        </div>
      </Link>
    );

  return (
    <Link to="/events/$eventId" params={{ eventId: att.eventId }} className="group block">
      <img
        src={att.cover}
        alt=""
        loading="lazy"
        className="aspect-[1.91/1] w-full border-divider border-y object-cover"
      />
      <div className="flex items-center gap-3 bg-comment px-4 py-3 group-hover:brightness-[0.97] dark:group-hover:brightness-110">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[13px] text-negative uppercase leading-4">
            {eventDateFmt.format(new Date(att.startAt)).replace(",", "").replace(",", " AT")}
          </p>
          <p className="mt-0.5 truncate font-semibold text-[17px] leading-[22px]">{att.title}</p>
          <p className="truncate text-[15px] text-secondary leading-5">
            {att.online ? "Online event" : [att.venue, att.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text",
          )}
        >
          <Star size={16} strokeWidth={2.4} /> Interested
        </span>
      </div>
    </Link>
  );
}

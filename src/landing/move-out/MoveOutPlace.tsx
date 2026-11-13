import { Link } from "@tanstack/react-router";
import { Home, KeyRound, Store } from "lucide-react";
import { useQ } from "@/app/viewer";
import { toRentalCheck } from "@/landing/links";
import { dateLabel } from "@/landing/place/placeParts";
import { cn } from "@/lib/format";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { placeStatusLabel } from "../../../convex/lib/placeRules";
import { subletStateLabel, toSubletMyPlace } from "./placeSublet";

/** A link that looks like a small `Button` (a button can't sit inside a link). */
const linkButton = (primary?: boolean) =>
  cn(
    "inline-flex h-8 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-semibold text-sm transition-[filter,background-color] active:scale-[0.98]",
    primary
      ? "bg-btn-primary text-white hover:bg-btn-primary-hover"
      : "bg-btn text-btn-text hover:brightness-95 dark:hover:brightness-125",
  );

/**
 * The top of Move out (#141): the place you're leaving, when you leave, and
 * its sublet. Without a place, a pointer to My Place; the sublet form below
 * still works on its own.
 */
export function MoveOutPlace() {
  const mine = useQ(api.myPlace.mine, {});
  if (mine === undefined)
    return (
      <Card className="mb-4 p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </Card>
    );
  const place = mine.current;
  if (!place)
    return (
      <Card className="mb-4 flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <Home size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[17px] text-primary leading-5">Your place</h2>
          <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
            Add the place you're leaving on My Place, and your sublet fills in from it.
          </p>
          <Link to="/landing/place" className={cn(linkButton(), "mt-3")}>
            Go to My Place
          </Link>
        </div>
      </Card>
    );

  const title =
    place.listing?.title ?? `Your place in ${place.neighborhood?.name ?? "San Francisco"}`;
  const sublet = place.sublet;
  return (
    <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      {place.listing?.photo ? (
        <img
          src={place.listing.photo}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-highlight text-accent">
          <Home size={28} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-secondary leading-4">Your place</p>
        <h2 className="mt-0.5 truncate font-bold text-[17px] text-primary leading-5">{title}</h2>
        <p className="mt-1 text-[13px] text-secondary leading-4">
          <span className="font-semibold text-primary">{placeStatusLabel(place.status)}</span>
          {place.moveOut && <> · Move-out {dateLabel(place.moveOut)}</>}
          {sublet && <> · {subletStateLabel(sublet)}</>}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {sublet && sublet.status !== "sold" ? (
          <Link {...toRentalCheck(sublet.listingId)} className={linkButton()}>
            <Store size={16} aria-hidden />
            View sublet
          </Link>
        ) : (
          <Link {...toSubletMyPlace()} className={linkButton(true)}>
            <KeyRound size={16} aria-hidden />
            Sublet my place
          </Link>
        )}
        <Link to="/landing/place" className={linkButton()}>
          Edit on My Place
        </Link>
      </div>
    </Card>
  );
}

import { Link } from "@tanstack/react-router";
import { Home, KeyRound, Store } from "lucide-react";
import { useQ } from "@/app/viewer";
import { toRentalCheck } from "@/landing/links";
import { dateLabel } from "@/landing/place/placeParts";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { placeStatusLabel } from "../../../convex/lib/placeRules";
import { subletStateLabel, toSubletMyPlace } from "./placeSublet";

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
          <Link to="/landing/place" className="mt-2 inline-block">
            <Button variant="secondary" size="sm">
              Go to My Place
            </Button>
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
        <p className="font-semibold text-[13px] text-secondary">Your place</p>
        <h2 className="truncate font-bold text-[17px] text-primary leading-5">{title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-secondary">
          <span className="rounded-full bg-btn-soft px-2 py-0.5 font-semibold text-btn-soft-text">
            {placeStatusLabel(place.status)}
          </span>
          {place.moveOut && <span>Move-out {dateLabel(place.moveOut)}</span>}
          {sublet && (
            <span className="inline-flex items-center gap-1">
              <KeyRound size={13} aria-hidden />
              {subletStateLabel(sublet)}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {sublet && sublet.status !== "sold" ? (
          <Link {...toRentalCheck(sublet.listingId)}>
            <Button variant="secondary" size="sm" icon={<Store size={15} />}>
              View sublet
            </Button>
          </Link>
        ) : (
          <Link {...toSubletMyPlace()}>
            <Button variant="primary" size="sm" icon={<KeyRound size={15} />}>
              Sublet my place
            </Button>
          </Link>
        )}
        <Link to="/landing/place">
          <Button variant="secondary" size="sm">
            Edit on My Place
          </Button>
        </Link>
      </div>
    </Card>
  );
}

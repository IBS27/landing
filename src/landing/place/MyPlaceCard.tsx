import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Box, Home, KeyRound, Lock, MapPin, Plus, Search, Sofa, Store } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toNeighborhood, toRentalCheck, toRoom, toUnit } from "@/landing/links";
import { subletStateLabel, toSubletMyPlace } from "@/landing/move-out/placeSublet";
import { plural, price } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { placeStatusLabel } from "../../../convex/lib/placeRules";
import { PlaceForm } from "./PlaceForm";
import { dateLabel, errorText } from "./placeParts";

type Mine = FunctionReturnType<typeof api.myPlace.mine>;
type Current = NonNullable<Mine["current"]>;
type Past = Mine["past"][number];

/**
 * My Place's record of the apartment the person chose (#132): what it is, when
 * they move in, and links to its listing, neighborhood, rooms and 3D unit.
 * Only the owner ever sees it.
 */
export function MyPlaceCard() {
  const mine = useQ(api.myPlace.mine, {});
  if (mine === undefined)
    return (
      <Card className="mb-4 flex gap-4 p-4">
        <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
        </div>
      </Card>
    );
  return (
    <>
      {mine.current ? <CurrentPlace place={mine.current} /> : <NoPlace />}
      {mine.past.length > 0 && <PastPlaces past={mine.past} />}
    </>
  );
}

function PrivateNote() {
  return (
    <p className="flex items-center gap-1 text-[13px] text-secondary leading-4">
      <Lock size={12} aria-hidden /> Only you can see this
    </p>
  );
}

function NoPlace() {
  const [adding, setAdding] = useState(false);
  return (
    <Card className="mb-4 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <Home size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[17px] text-primary leading-[22px]">Your place</h2>
          <p className="mt-0.5 max-w-[60ch] text-[15px] text-secondary leading-5">
            Picked an apartment? Add it, and your rooms, 3D unit and City Profile start from it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Add the place I found
            </Button>
            <Link to="/landing/find">
              <Button variant="secondary" icon={<Search size={16} />}>
                Find a place
              </Button>
            </Link>
          </div>
          <div className="mt-3">
            <PrivateNote />
          </div>
        </div>
      </div>
      <PlaceForm open={adding} onOpenChange={setAdding} />
    </Card>
  );
}

function CurrentPlace({ place }: { place: Current }) {
  const [editing, setEditing] = useState(false);
  const { listing, neighborhood } = place;
  const title = listing?.title ?? `Your place in ${neighborhood?.name ?? "San Francisco"}`;
  const when =
    place.status === "moving_in"
      ? `Move-in ${dateLabel(place.moveIn)}`
      : place.status === "moving_out" && place.moveOut
        ? `Move-out ${dateLabel(place.moveOut)}`
        : `Moved in ${dateLabel(place.moveIn)}`;
  // A sublet listed from this place and not yet taken (#141).
  const sublet = place.sublet && place.sublet.status !== "sold" ? place.sublet : null;
  const facts = [
    listing && `${price(listing.price)}/mo`,
    listing?.bedrooms != null &&
      (listing.bedrooms === 0
        ? "Studio"
        : `${plural(listing.bedrooms, "bed")}, ${plural(listing.bathrooms ?? 0, "bath")}`),
  ].filter(Boolean);

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        {listing?.photo ? (
          <img
            src={listing.photo}
            alt=""
            className="h-40 w-full shrink-0 rounded-lg object-cover sm:h-28 sm:w-28"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-highlight text-accent">
            <Home size={28} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-[13px] text-secondary">Your place</p>
              <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[15px] text-secondary leading-5">
            <span className="font-semibold text-primary">{placeStatusLabel(place.status)}</span>
            <span aria-hidden>·</span>
            <span>{when}</span>
            {facts.length > 0 && <span aria-hidden>·</span>}
            {facts.length > 0 && <span>{facts.join(", ")}</span>}
          </p>
          {place.listingGone && (
            <p className="mt-1 text-[13px] text-secondary">
              The listing you took is no longer available.
            </p>
          )}
          <nav aria-label="Your place" className="mt-4 flex flex-wrap gap-2">
            {neighborhood && (
              <Link {...toNeighborhood(neighborhood.slug)} className={chip}>
                <MapPin size={16} aria-hidden />
                {neighborhood.name}
              </Link>
            )}
            {listing && (
              <Link {...toRentalCheck(listing._id)} className={chip}>
                <Store size={16} aria-hidden />
                Listing
              </Link>
            )}
            <Link
              {...toUnit(
                place.unit ? { unit: place.unit._id } : listing ? { listing: listing._id } : {},
              )}
              className={chip}
            >
              <Box size={16} aria-hidden />
              {place.unit ? "Your 3D unit" : "Explore in 3D"}
            </Link>
            {place.rooms.map((r) => (
              <Link key={r._id} {...toRoom(r._id)} className={chip}>
                <Sofa size={16} aria-hidden />
                {r.name}
              </Link>
            ))}
            {sublet ? (
              <Link to="/landing/move-out" className={chip}>
                <KeyRound size={16} aria-hidden />
                {subletStateLabel(sublet)}
              </Link>
            ) : (
              <Link {...toSubletMyPlace()} className={chip}>
                <KeyRound size={16} aria-hidden />
                Sublet my place
              </Link>
            )}
          </nav>
          {place.status === "moving_out" && !sublet && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-highlight p-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-[13px] text-primary leading-[18px]">
                <span className="font-semibold">Moving out?</span> List your place as a sublet. The
                form fills in from your place, and you check everything before it's listed.
              </p>
              <Link {...toSubletMyPlace()} className="shrink-0">
                <Button variant="primary" size="sm" icon={<KeyRound size={15} />}>
                  Sublet my place
                </Button>
              </Link>
            </div>
          )}
          <div className="mt-3">
            <PrivateNote />
          </div>
        </div>
      </div>
      <PlaceForm
        open={editing}
        onOpenChange={setEditing}
        place={{
          _id: place._id,
          status: place.status,
          moveIn: place.moveIn,
          moveOut: place.moveOut,
          neighborhood,
          fromListing: listing !== null || place.listingGone,
        }}
      />
    </Card>
  );
}

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 dark:hover:brightness-125";

function PastPlaces({ past }: { past: Past[] }) {
  const remove = useM(api.myPlace.remove);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="mb-4 p-4">
      <h2 className="font-bold text-[17px] text-primary leading-[22px]">Places you've left</h2>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-negative">
          {error}
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {past.map((p) => (
          <li key={p._id} className="flex items-center gap-3 py-1">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-[15px] text-primary">
                {p.listing?.title ?? p.neighborhood?.name ?? "A place in San Francisco"}
              </span>
              <span className="block text-[13px] text-secondary">
                {dateLabel(p.moveIn)}
                {p.moveOut ? ` to ${dateLabel(p.moveOut)}` : ""}
                {p.sublet && (
                  <>
                    {" · "}
                    <Link {...toRentalCheck(p.sublet.listingId)} className="hover:underline">
                      {subletStateLabel(p.sublet)}
                    </Link>
                  </>
                )}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove({ placeId: p._id }).catch((e) => setError(errorText(e)))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

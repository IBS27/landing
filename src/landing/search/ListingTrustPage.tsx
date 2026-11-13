import { Link } from "@tanstack/react-router";
import { Bath, BedDouble, CalendarDays, Flag, MapPin, MessageCircle, Store } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { ListingGallery } from "@/features/marketplace/ListingGallery";
import { toConversation, toListing, toProfile } from "@/landing/links";
import { LandingPage } from "@/landing/shell/LandingPage";
import { price } from "@/lib/format";
import { Avatar, Button, Card, EmptyState, Skeleton } from "@/ui/primitives";
import { ReportDialog } from "@/ui/ReportDialog";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LISTING_REPORT_REASONS } from "../../../convex/lib/reports";
import { ListerNetwork } from "./ListerNetwork";
import { ChatCheck, ThingsToCheck, VerifiedBadges } from "./ThingsToCheck";
import { UnitDetails } from "./UnitDetails";
import { useChatCheck } from "./useChatCheck";

/** `/landing/find/listing/:id`: a rental with its verified levels and things to check. */
export function ListingTrustPage({ listingId }: { listingId: Id<"listings"> }) {
  const data = useQ(api.trust.forListing, { listingId });
  const report = useM(api.reports.create);
  const [reporting, setReporting] = useState(false);

  // Check the viewer's chat with the lister when it's new or has new messages.
  const retryCheck = useChatCheck(listingId, data?.chat);

  if (data === undefined)
    return (
      <LandingPage title={<Skeleton className="h-7 w-72" />}>
        <Skeleton className="h-[360px] w-full rounded-lg" />
      </LandingPage>
    );
  if (data === null)
    return (
      <LandingPage title="Listing">
        <Card>
          <EmptyState title="This rental isn't available" body="It may have been removed." />
        </Card>
      </LandingPage>
    );

  const { listing, lister, rental } = { ...data, rental: data.listing.rental };
  const where = [listing.neighborhood, listing.city.replace(/, CA$/, "")]
    .filter(Boolean)
    .join(", ");

  return (
    <LandingPage
      title={listing.title}
      description={
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} aria-hidden /> {where}
        </span>
      }
      actions={
        <>
          <Link to="/landing/place/unit" search={{ listing: listing._id }}>
            <Button variant="secondary">Explore in 3D</Button>
          </Link>
          <Link {...toListing(listing._id)}>
            <Button variant="secondary" icon={<Store size={16} />}>
              View on Marketplace
            </Button>
          </Link>
          {data.chat ? (
            <Link {...toConversation(data.chat.conversationId)}>
              <Button variant="primary" icon={<MessageCircle size={16} />}>
                Open chat
              </Button>
            </Link>
          ) : (
            <Link {...toListing(listing._id)}>
              <Button variant="primary" icon={<MessageCircle size={16} />}>
                Message lister
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-hidden">
            {listing.photos.length > 0 && (
              <div className="flex h-[560px]">
                <ListingGallery
                  key={listing._id}
                  title={listing.title}
                  photos={listing.photos}
                  rentalMedia={listing.rentalMedia}
                  video={null}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-[24px] text-primary leading-7">
                  {price(listing.price)}
                </span>
                <span className="text-[15px] text-secondary">/ month</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-primary">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble size={16} className="text-secondary" aria-hidden />
                  {rental.propertyType === "room"
                    ? "Private room"
                    : rental.bedrooms === 0
                      ? "Studio"
                      : `${rental.bedrooms} bed`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath size={16} className="text-secondary" aria-hidden />
                  {rental.bathrooms} bath
                </span>
                {rental.availableFrom && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={16} className="text-secondary" aria-hidden />
                    Available{" "}
                    {new Date(rental.availableFrom).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <VerifiedBadges badges={data.badges} />
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] text-primary leading-5">
                {listing.description}
              </p>
            </div>
          </Card>
          {data.chat && lister && (
            <ChatCheck chat={data.chat} listerFirstName={lister.firstName} onRetry={retryCheck} />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <UnitDetails listingId={listing._id} />
          {!data.isOwn && <ThingsToCheck signals={data.signals} lister={lister} />}
          {lister && (
            <Card className="p-4">
              <h2 className="font-bold text-[17px] text-primary leading-5">Listed by</h2>
              <Link
                {...toProfile(lister)}
                className="mt-3 flex items-center gap-3 rounded-lg p-1 hover:bg-hover"
              >
                <Avatar src={lister.avatar} size={44} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[15px] text-primary">
                    {lister.name}
                  </div>
                  <div className="text-[13px] text-secondary">
                    {lister.city ? `Lives in ${lister.city} · ` : ""}Joined{" "}
                    {new Date(lister.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </Link>
            </Card>
          )}
          {!data.isOwn && <ListerNetwork listingId={listing._id} />}
          {!data.isOwn && (
            <Button
              variant="ghost"
              icon={<Flag size={16} />}
              disabled={data.reported}
              onClick={() => setReporting(true)}
              className="self-start"
            >
              {data.reported ? "You reported this listing" : "Report listing"}
            </Button>
          )}
        </div>
      </div>

      {reporting && (
        <ReportDialog
          noun="listing"
          reasons={LISTING_REPORT_REASONS}
          onSubmit={(reason) => report({ targetType: "listing", targetId: listing._id, reason })}
          onClose={() => setReporting(false)}
        />
      )}
    </LandingPage>
  );
}

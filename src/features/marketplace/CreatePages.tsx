import { Link } from "@tanstack/react-router";
import { useQ } from "@/app/viewer";
import { Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { kindOf, ListingComposer } from "./Composer";
import { HelpIcon, SellingTagIcon, TagIcon } from "./icons";
import { MpShell, RailDivider, RailRow } from "./rails";

/* Spot illustrations for the listing-type cards (60px circles). */
function ItemArt() {
  return (
    <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden>
      <circle cx="30" cy="30" r="30" fill="#FF7A9A" />
      <path d="M14 26c0-5 5-8 9-6l8 4 8-4c4-2 8 1 8 6v12H14Z" fill="#2D88FF" />
      <rect x="14" y="36" width="30" height="8" rx="1" fill="#E4405F" />
      <path d="M30 14v12" stroke="#1C1E21" strokeWidth="1.6" />
      <rect x="28" y="24" width="4" height="6" rx="1" fill="#fff" />
      <path d="M38 26a5 5 0 1 1 0 8" fill="none" stroke="#1C1E21" strokeWidth="1.6" />
    </svg>
  );
}
function VehicleArt() {
  return (
    <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden>
      <circle cx="30" cy="30" r="30" fill="#2ABBA7" />
      <path d="M10 36l4-8c1-2 3-3 5-3h18c2 0 4 1 6 3l6 4v6H10Z" fill="#0F5E55" />
      <path d="M22 27h14l4 5H19Z" fill="#7FE0D1" />
      <circle cx="19" cy="38" r="4.5" fill="#1C1E21" />
      <circle cx="19" cy="38" r="2" fill="#fff" />
      <circle cx="41" cy="38" r="4.5" fill="#1C1E21" />
      <circle cx="41" cy="38" r="2" fill="#fff" />
      <path d="M8 34h6M8 37h4" stroke="#1C1E21" strokeWidth="1.5" />
    </svg>
  );
}
function HomeArt() {
  return (
    <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden>
      <circle cx="30" cy="30" r="30" fill="#FFB067" />
      <rect x="18" y="20" width="24" height="26" fill="#E95F28" />
      <path d="M16 20h28l-3-6H19Z" fill="#B93E12" />
      {[22, 28, 34].map((x) => (
        <rect key={x} x={x} y="25" width="3" height="5" fill="#FFE2C4" />
      ))}
      <rect x="22" y="36" width="5" height="10" rx="2.5" fill="#1C1E21" />
      {[30, 34].map((x) => (
        <rect key={x} x={x} y="37" width="3" height="5" fill="#FFE2C4" />
      ))}
      <rect x="16" y="44" width="28" height="3" fill="#2D88FF" />
    </svg>
  );
}

const TYPES = [
  {
    to: "/marketplace/create/item",
    title: "Item for sale",
    body: "Create a single listing for one or more items to sell.",
    art: <ItemArt />,
  },
  {
    to: "/marketplace/create/vehicle",
    title: "Vehicle for sale",
    body: "Sell a car, truck or other type of vehicle.",
    art: <VehicleArt />,
  },
  {
    to: "/marketplace/create/rental",
    title: "Home for sale or rent",
    body: "List a house or apartment for sale or rent.",
    art: <HomeArt />,
  },
] as const;

/** /marketplace/create: choose listing type. */
export function CreateChooserPage() {
  return (
    <MpShell
      mainClassName="pb-0!"
      rail={
        <>
          <div className="mt-[11px] flex h-9 items-center px-4">
            <h1 className="font-bold text-[24px] text-primary leading-7">Create new listing</h1>
          </div>
          <div className="mt-3 px-2">
            <RailRow
              icon={<TagIcon />}
              label="Choose listing type"
              active
              to="/marketplace/create"
            />
            <RailDivider className="my-2" />
            <RailRow
              icon={<SellingTagIcon />}
              label="Your listings"
              to="/marketplace/you/selling"
            />
            <RailRow
              icon={<HelpIcon />}
              label="Seller Help"
              href="https://www.facebook.com/help/1889067784738765"
            />
          </div>
        </>
      }
    >
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-[532px] max-w-full">
          <h2 className="px-3 font-bold text-[20px] text-primary leading-6">Choose listing type</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {TYPES.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="flex h-[210px] w-[158px] flex-col items-center justify-center rounded-xl bg-card p-4 text-center shadow-base transition-colors hover:bg-hover"
              >
                {t.art}
                <span className="mt-2 font-semibold text-[15px] text-primary leading-5">
                  {t.title}
                </span>
                <span className="mt-0.5 text-[13px] text-secondary leading-4">{t.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MpShell>
  );
}

/** /marketplace/edit/$listingId */
export function EditListingPage({ listingId }: { listingId: string }) {
  const l = useQ(api.listings.get, { listingId });
  if (l === undefined)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  if (!l?.isOwner)
    return (
      <div className="py-24 text-center">
        <p className="font-bold text-[20px] text-secondary">You can't edit this listing</p>
        <Link
          to="/marketplace"
          className="mt-3 inline-block font-semibold text-link hover:underline"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  return <ListingComposer key={l._id} kind={kindOf(l)} editing={l} />;
}

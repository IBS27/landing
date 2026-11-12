import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  BedDouble,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Fuel,
  Gauge,
  Info,
  Link2,
  MoreHorizontal,
  Palette,
  ParkingSquare,
  PawPrint,
  Pencil,
  Ruler,
  Settings2,
  ShieldCheck,
  Sofa,
  Trash2,
  WashingMachine,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ } from "@/app/viewer";
import { PlayGlyph, VideoPlayer } from "@/features/posts/VideoPlayer";
import { FacebookLogo } from "@/icons";
import { cn, price } from "@/lib/format";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Tooltip,
} from "@/ui/overlays";
import { Avatar, Button, Skeleton, Spinner } from "@/ui/primitives";
import { ReportDialog } from "@/ui/ReportDialog";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  bedsBaths,
  conditionLabel,
  listedAgo,
  MEETUPS,
  propertyTypeLabel,
} from "../../../convex/lib/listings";
import { LISTING_REPORT_REASONS } from "../../../convex/lib/reports";
import { areaMap } from "../maps/lookup";
import { ListingGrid } from "./grid";
import { BookmarkFill, BookmarkOutline, MessengerGradient, ShareArrow } from "./icons";
import { MapTile } from "./MapTile";
import { LocationChip, MainRail, MpShell } from "./rails";
import { useToast } from "./toast";

type Detail = NonNullable<FunctionReturnType<typeof api.listings.get>>;

const DEFAULT_MESSAGE = "Hi, is this available?";
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** /marketplace/item/$listingId */
export function ItemPage({ listingId }: { listingId: string }) {
  const listing = useQ(api.listings.get, { listingId });
  const recordView = useM(api.listings.recordView);
  const viewed = useRef<string | null>(null);
  const id = listing?._id;
  useEffect(() => {
    if (!id || viewed.current === id) return;
    viewed.current = id;
    void recordView({ listingId: id }).catch(() => {});
  }, [id, recordView]);

  return (
    <MpShell rail={<MainRail active={null} />} mainClassName="pt-5">
      {listing === undefined ? (
        <Skeleton className="h-[calc(100vh-132px)] min-h-[560px] w-full rounded-none" />
      ) : listing === null ? (
        <Unavailable />
      ) : (
        <>
          <ItemContainer key={listing._id} l={listing} />
          <div className="mt-2 flex h-9 items-center justify-between">
            <h2 className="font-bold text-[20px] text-primary leading-6">Today's picks</h2>
            <LocationChip />
          </div>
          <Related listingId={listing._id} />
        </>
      )}
    </MpShell>
  );
}

function Unavailable() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="font-bold text-[20px] text-secondary">This listing isn't available anymore</p>
      <p className="mt-1 text-[15px] text-secondary">
        It may have been sold or deleted by the seller.
      </p>
      <Link
        to="/marketplace"
        className="mt-4 rounded-md bg-btn-primary px-4 py-2 font-semibold text-[15px] text-white"
      >
        Browse Marketplace
      </Link>
    </div>
  );
}

function Related({ listingId }: { listingId: Id<"listings"> }) {
  const [limit, setLimit] = useState(24);
  const items = useQ(api.listings.related, { listingId, limit });
  return (
    <div className="pt-1">
      <ListingGrid
        data={items ? { items, hasMore: items.length >= limit && limit < 96 } : undefined}
        onMore={() => setLimit((n) => (items && items.length >= n ? n + 24 : n))}
      />
    </div>
  );
}

function ItemContainer({ l }: { l: Detail }) {
  const toast = useToast();
  return (
    <div className="flex h-[calc(100vh-132px)] min-h-[560px] overflow-hidden bg-card">
      <Gallery photos={l.photos} video={l.video} title={l.title} />
      <aside className="flex w-[356px] shrink-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-[11px] pb-5">
          <Header l={l} toast={toast.show} />
          {l.isOwner && l.stats && <Insights stats={l.stats} />}
          <Details l={l} />
          <LocationMap l={l} />
          <SellerInfo l={l} />
          {!l.isOwner && <SponsoredAd listingId={l._id} toast={toast.show} />}
        </div>
        {!l.isOwner && <MessageBar l={l} />}
      </aside>
      {toast.node}
    </div>
  );
}

/* ───────────── Gallery ───────────── */

function Gallery({
  photos,
  video,
  title,
}: {
  photos: string[];
  video: Detail["video"];
  title: string;
}) {
  const [i, setI] = useState(0);
  // The listing video (if any) leads the gallery, then the photos.
  const slides = [
    ...(video ? [{ video, thumb: video.poster ?? "" }] : []),
    ...photos.map((p) => ({ video: null, thumb: p })),
  ];
  const n = slides.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
      if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);
  const slide = slides[i];
  const src = slide && !slide.video ? slide.thumb : undefined;
  return (
    <div ref={ref} className="relative min-w-0 flex-1 overflow-hidden bg-black">
      {slide?.video && (
        <VideoPlayer
          key={slide.video.url}
          src={slide.video.url}
          poster={slide.video.poster}
          label={`${title} video`}
          className={n > 1 ? "h-[calc(100%-52px)] w-full" : "h-full w-full"}
        />
      )}
      {src && (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          <img src={src} alt={title} className="relative h-full w-full object-contain" />
        </>
      )}
      {n > 1 && (
        <>
          <GalleryArrow side="left" onClick={() => go(-1)} />
          <GalleryArrow side="right" onClick={() => go(1)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[52px] items-start justify-center gap-3">
            {slides.map((p, k) => (
              <button
                key={p.thumb + String(k)}
                type="button"
                aria-label={p.video ? "View video" : `View photo ${k + 1 - (video ? 1 : 0)}`}
                aria-current={k === i}
                onClick={() => setI(k)}
                className="relative h-9 w-9 overflow-hidden rounded-[6px] bg-[#3a3b3c]"
              >
                {p.thumb && <img src={p.thumb} alt="" className="h-full w-full object-cover" />}
                {p.video && (
                  <span className="absolute inset-0 flex items-center justify-center text-white">
                    <PlayGlyph size={14} />
                  </span>
                )}
                <span
                  className={cn(
                    "absolute inset-0 rounded-[6px]",
                    k === i ? "ring-2 ring-white ring-inset" : "bg-black/40 hover:bg-black/20",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "View previous image" : "View next image"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#E2E5E9] text-[#080809] hover:bg-[#d8dadf]",
        side === "left" ? "left-2.5" : "right-2.5",
      )}
    >
      {side === "left" ? (
        <ChevronLeft size={26} strokeWidth={2.25} />
      ) : (
        <ChevronRight size={26} strokeWidth={2.25} />
      )}
    </button>
  );
}

/* ───────────── Header + actions ───────────── */

function priceLine(l: Detail) {
  if (l.price === 0) return "Free";
  const p = price(l.price);
  return l.rental && l.rental.listingType !== "sale" ? `${p} / Month` : p;
}

function Header({ l, toast }: { l: Detail; toast: (m: string) => void }) {
  return (
    <>
      <h1 className="break-words font-bold text-[24px] text-primary leading-7">{l.title}</h1>
      <div className="flex flex-wrap items-center gap-x-1.5 text-[17px] leading-[22px]">
        <span className="font-medium text-primary">{priceLine(l)}</span>
        {l.originalPrice !== null && l.originalPrice > l.price && (
          <span className="font-medium text-secondary line-through">{price(l.originalPrice)}</span>
        )}
        {l.status !== "active" && (
          <span
            className={cn(
              "ml-1 rounded px-1.5 py-0.5 font-semibold text-[13px] leading-4",
              l.status === "sold" ? "bg-negative text-white" : "bg-[#F7B928] text-[#080809]",
            )}
          >
            {l.status === "sold" ? "Sold" : "Pending"}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-secondary leading-4">
        Listed {listedAgo(l.createdAt)} in {l.location.city}
      </p>
      {l.meetup.length > 0 && (
        <div className="mt-2.5 -mb-1 flex flex-wrap gap-x-3 gap-y-1">
          {l.meetup.map((m) => (
            <span key={m} className="flex items-center gap-1 text-[13px] text-secondary leading-4">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-secondary font-semibold text-[9px]">
                {m === "public" ? "P" : "D"}
              </span>
              {MEETUPS.find((x) => x.value === m)?.label}
            </span>
          ))}
        </div>
      )}
      {l.isOwner ? <OwnerActions l={l} toast={toast} /> : <BuyerActions l={l} toast={toast} />}
    </>
  );
}

const actionBtn =
  "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125";

function ShareButton({ l, toast }: { l: Detail; toast: (m: string) => void }) {
  const create = useM(api.posts.create);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/marketplace/item/${l._id}`);
      toast("Link copied to clipboard");
    } catch {
      toast("Couldn't copy the link");
    }
  };
  return (
    <Menu>
      <Tooltip content="Share">
        <MenuTrigger asChild>
          <button type="button" aria-label="Share" className={cn(actionBtn, "w-12")}>
            <ShareArrow size={18} />
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent width={300}>
        <MenuItem
          icon={<ShareArrow size={18} />}
          label="Share to Feed"
          sub="Post this listing to your Feed"
          onSelect={() =>
            void create({
              attachments: [{ kind: "listing", listingId: l._id }],
              privacy: "friends",
            })
              .then(() => toast("Shared to your Feed"))
              .catch(() => toast("Couldn't share this listing"))
          }
        />
        <MenuItem icon={<Link2 size={18} />} label="Copy link" onSelect={() => void copy()} />
      </MenuContent>
    </Menu>
  );
}

function SaveButton({ l, toast }: { l: Detail; toast: (m: string) => void }) {
  const toggle = useM(api.saved.toggle);
  const [busy, setBusy] = useState(false);
  return (
    <Tooltip content={l.viewerSaved ? "Unsave" : "Save"}>
      <button
        type="button"
        aria-label={l.viewerSaved ? "Unsave" : "Save"}
        aria-pressed={l.viewerSaved}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const saved = await toggle({ kind: "listing", refId: l._id });
            toast(saved ? "Saved to your items" : "Removed from saved items");
          } finally {
            setBusy(false);
          }
        }}
        className={cn(actionBtn, "w-12", l.viewerSaved && "text-accent!")}
      >
        {l.viewerSaved ? <BookmarkFill size={18} /> : <BookmarkOutline size={18} />}
      </button>
    </Tooltip>
  );
}

function BuyerActions({ l, toast }: { l: Detail; toast: (m: string) => void }) {
  const { openChat } = useChatDock();
  const report = useM(api.reports.create);
  const [dialog, setDialog] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={() => (l.conversationId ? openChat(l.conversationId) : setDialog(true))}
        className={cn(actionBtn, "flex-1")}
      >
        <MessengerIcon16 />
        Message
      </button>
      <SaveButton l={l} toast={toast} />
      <ShareButton l={l} toast={toast} />
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label="More Item Options" className={cn(actionBtn, "w-12")}>
            <MoreHorizontal size={20} />
          </button>
        </MenuTrigger>
        <MenuContent width={300}>
          <MenuItem
            icon={<ShieldCheck size={18} />}
            label="Report listing"
            onSelect={() => setReporting(true)}
          />
          <MenuItem
            icon={<Link2 size={18} />}
            label="Copy link"
            onSelect={() =>
              void navigator.clipboard
                .writeText(`${window.location.origin}/marketplace/item/${l._id}`)
                .then(() => toast("Link copied to clipboard"))
                .catch(() => {})
            }
          />
        </MenuContent>
      </Menu>
      {dialog && <MessageDialog l={l} onClose={() => setDialog(false)} />}
      {reporting && (
        <ReportDialog
          noun="listing"
          reasons={LISTING_REPORT_REASONS}
          onSubmit={(reason) => report({ targetType: "listing", targetId: l._id, reason })}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}

function MessengerIcon16() {
  return (
    <svg viewBox="0 0 12 13" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M6 .5C2.75.5.25 2.88.25 6.08c0 1.67.69 3.12 1.8 4.12.1.08.15.21.16.34l.03 1.02c.01.33.35.54.65.41l1.14-.5a.46.46 0 0 1 .3-.02c.53.14 1.08.22 1.67.22 3.25 0 5.75-2.38 5.75-5.58S9.25.5 6 .5Zm3.45 4.3L7.76 7.47a.87.87 0 0 1-1.25.23L5.17 6.7a.35.35 0 0 0-.42 0l-1.81 1.37c-.24.18-.56-.1-.4-.36L4.24 5.03a.87.87 0 0 1 1.25-.23l1.34 1a.35.35 0 0 0 .42 0l1.81-1.37c.24-.18.56.1.4.36Z" />
    </svg>
  );
}

function OwnerActions({ l, toast }: { l: Detail; toast: (m: string) => void }) {
  const setStatus = useM(api.listings.setStatus);
  const remove = useM(api.listings.remove);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const sold = l.status === "sold";
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={() =>
          void setStatus({ listingId: l._id, status: sold ? "active" : "sold" }).then(() =>
            toast(sold ? "Marked as available" : "Marked as sold"),
          )
        }
        className={cn(actionBtn, "flex-1")}
      >
        <Check size={18} strokeWidth={2.5} />
        {sold ? "Mark as available" : "Mark as sold"}
      </button>
      <Tooltip content="Edit listing">
        <Link
          to="/marketplace/edit/$listingId"
          params={{ listingId: l._id }}
          aria-label="Edit listing"
          className={cn(actionBtn, "w-12")}
        >
          <Pencil size={18} strokeWidth={2.25} />
        </Link>
      </Tooltip>
      <ShareButton l={l} toast={toast} />
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label="More Item Options" className={cn(actionBtn, "w-12")}>
            <MoreHorizontal size={20} />
          </button>
        </MenuTrigger>
        <MenuContent width={300}>
          {l.status !== "pending" ? (
            <MenuItem
              icon={<CalendarDays size={18} />}
              label="Mark as pending"
              onSelect={() =>
                void setStatus({ listingId: l._id, status: "pending" }).then(() =>
                  toast("Marked as pending"),
                )
              }
            />
          ) : (
            <MenuItem
              icon={<Check size={18} />}
              label="Mark as available"
              onSelect={() =>
                void setStatus({ listingId: l._id, status: "active" }).then(() =>
                  toast("Marked as available"),
                )
              }
            />
          )}
          <MenuItem
            icon={<Pencil size={18} />}
            label="Edit listing"
            onSelect={() =>
              void navigate({ to: "/marketplace/edit/$listingId", params: { listingId: l._id } })
            }
          />
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={18} />}
            label="Delete listing"
            onSelect={() => setConfirm(true)}
          />
        </MenuContent>
      </Menu>
      <Modal open={confirm} onOpenChange={setConfirm} title="Delete listing?">
        <p className="p-4 text-[15px] text-primary">
          Are you sure you want to delete this listing? You can't undo this.
        </p>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="link" className="px-3" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await remove({ listingId: l._id });
              setConfirm(false);
              void navigate({ to: "/marketplace/you/selling" });
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Insights({ stats }: { stats: NonNullable<Detail["stats"]> }) {
  const items = [
    { n: stats.views, label: "Clicks on listing" },
    { n: stats.saves, label: "Saves" },
    { n: stats.chats, label: "Chats" },
  ];
  return (
    <section className="mt-4 rounded-lg bg-wash p-3">
      <h2 className="font-semibold text-[15px] text-primary">Listing insights</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {items.map((s) => (
          <div key={s.label}>
            <p className="font-bold text-[20px] text-primary leading-6">
              {s.n.toLocaleString("en-US")}
            </p>
            <p className="text-[13px] text-secondary leading-4">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Details ───────────── */

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="pt-[21px] pb-1 font-semibold text-[17px] text-primary leading-5">{children}</h2>
  );
}

function IconLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-[15px] text-primary leading-5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-icon">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <p className="whitespace-pre-wrap break-words pt-3 text-[15px] text-primary leading-5">
      {long && !open ? `${text.slice(0, 380).trimEnd()}... ` : text}
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="font-semibold hover:underline"
        >
          {open ? " See less" : "See more"}
        </button>
      )}
    </p>
  );
}

const ic = { size: 20, strokeWidth: 2 } as const;

function Details({ l }: { l: Detail }) {
  if (l.rental) {
    const r = l.rental;
    const sale = r.listingType === "sale";
    return (
      <>
        <SectionHeading>{sale ? "Home details" : "Unit details"}</SectionHeading>
        <div className="grid grid-cols-2 gap-x-2">
          <IconLine icon={<BedDouble {...ic} />}>{bedsBaths(r)}</IconLine>
          <IconLine icon={<Building2 {...ic} />}>
            {propertyTypeLabel(r.propertyType)}
            {r.listingType === "sublet" ? " sublet" : ""}
          </IconLine>
          {r.sqft !== undefined && (
            <IconLine icon={<Ruler {...ic} />}>
              {r.sqft.toLocaleString("en-US")} square feet
            </IconLine>
          )}
          {r.laundry && <IconLine icon={<WashingMachine {...ic} />}>{r.laundry}</IconLine>}
          {r.parking && <IconLine icon={<ParkingSquare {...ic} />}>{r.parking}</IconLine>}
          {r.petsAllowed !== undefined && (
            <IconLine icon={<PawPrint {...ic} />}>
              {r.petsAllowed ? "Pet friendly" : "No pets"}
            </IconLine>
          )}
          {r.furnished !== undefined && (
            <IconLine icon={<Sofa {...ic} />}>{r.furnished ? "Furnished" : "Unfurnished"}</IconLine>
          )}
          {!sale && (
            <IconLine icon={<CalendarDays {...ic} />}>
              {r.availableFrom && r.availableFrom > Date.now()
                ? `Available ${dateFmt.format(r.availableFrom)}`
                : "Available now"}
              {r.availableTo ? ` – ${dateFmt.format(r.availableTo)}` : ""}
            </IconLine>
          )}
        </div>
        {r.address && (
          <>
            <SectionHeading>{sale ? "Location" : "Rental location"}</SectionHeading>
            <p className="pt-1 text-[15px] text-primary leading-5">
              {r.address}
              {l.location.neighborhood ? `, ${l.location.neighborhood}` : ""}
            </p>
          </>
        )}
        <SectionHeading>Description</SectionHeading>
        <Description text={l.description} />
      </>
    );
  }
  if (l.vehicle) {
    const v = l.vehicle;
    return (
      <>
        <SectionHeading>About this vehicle</SectionHeading>
        {v.mileage !== undefined && (
          <IconLine icon={<Gauge {...ic} />}>
            Driven {v.mileage.toLocaleString("en-US")} miles
          </IconLine>
        )}
        {v.transmission && <IconLine icon={<Settings2 {...ic} />}>{v.transmission}</IconLine>}
        {v.bodyStyle && <IconLine icon={<Car {...ic} />}>Body style: {v.bodyStyle}</IconLine>}
        {v.exteriorColor && (
          <IconLine icon={<Palette {...ic} />}>Exterior color: {v.exteriorColor}</IconLine>
        )}
        {v.fuelType && <IconLine icon={<Fuel {...ic} />}>Fuel type: {v.fuelType}</IconLine>}
        {v.titleStatus && <IconLine icon={<ShieldCheck {...ic} />}>{v.titleStatus}</IconLine>}
        {l.condition && (
          <IconLine icon={<Check {...ic} />}>Condition: {conditionLabel(l.condition)}</IconLine>
        )}
        <SectionHeading>Seller's description</SectionHeading>
        <Description text={l.description} />
      </>
    );
  }
  return (
    <>
      <SectionHeading>Details</SectionHeading>
      <Description text={l.description} />
    </>
  );
}

/* ───────────── Location ───────────── */

/** The short map strip under the details; opens a larger map of the approximate area. */
function LocationMap({ l }: { l: Detail }) {
  const [open, setOpen] = useState(false);
  const place = l.location.neighborhood ?? l.location.city.split(",")[0] ?? l.location.city;
  const area = areaMap(l.location.neighborhood) ?? areaMap(l.location.city);
  if (!area) {
    return (
      <p className="mt-[21px] text-[13px] leading-4">
        <span className="text-primary">{l.location.city}</span>
        <span className="text-secondary"> · Location is approximate</span>
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={`View ${place} on map`}
        onClick={() => setOpen(true)}
        className="mt-4 block w-full overflow-hidden rounded-lg"
      >
        {/* FB's item map is a short 51px strip (no area circle); the dialog shows the area. */}
        <MapTile src={area.tile} alt={`Map of ${place}`} height={51} info />
      </button>
      <p className="mt-5 text-[13px] leading-4">
        <span className="text-primary">{l.location.city}</span>
        <span className="text-secondary"> · Location is approximate</span>
      </p>
      <Modal open={open} onOpenChange={setOpen} title="Location" width={700}>
        <div className="p-4">
          <div className="overflow-hidden rounded-lg">
            <MapTile src={area.map} alt={`Map of ${place}`} height={420} radius={64} info />
          </div>
          <p className="mt-3 text-[15px] text-primary leading-5">
            {l.location.neighborhood ? `${l.location.neighborhood}, ` : ""}
            {l.location.city}
          </p>
          <p className="text-[13px] text-secondary leading-4">
            Location is approximate. The seller's exact address is never shown.
          </p>
        </div>
      </Modal>
    </>
  );
}

/* ───────────── Seller ───────────── */

function Star({ fill }: { fill: "full" | "half" | "empty" }) {
  const id = useId();
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      {fill === "half" && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#E0761A" />
            <stop offset="50%" stopColor="var(--color-btn)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M8 .9l2.1 4.5 4.9.6-3.6 3.4.9 4.9L8 11.9l-4.3 2.4.9-4.9L1 6l4.9-.6Z"
        fill={fill === "full" ? "#E0761A" : fill === "half" ? `url(#${id})` : "var(--color-btn)"}
      />
    </svg>
  );
}

function Stars({ stars, count }: { stars: number; count: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" title={`${stars} out of 5 stars`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} fill={stars >= n ? "full" : stars >= n - 0.5 ? "half" : "empty"} />
        ))}
      </span>
      <span className="text-[12px] text-secondary leading-4">({count})</span>
    </span>
  );
}

function SellerInfo({ l }: { l: Detail }) {
  const s = l.seller;
  return (
    <section className="pt-[13px]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[17px] text-primary leading-5">Seller information</h2>
        <Link
          to="/$username"
          params={{ username: s.username }}
          className="text-[15px] text-link hover:underline"
        >
          Seller details
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Link
          to="/$username"
          params={{ username: s.username }}
          className="flex shrink-0 rounded-full"
        >
          <Avatar src={s.avatar} size={48} />
        </Link>
        <Link
          to="/$username"
          params={{ username: s.username }}
          className="min-w-0 flex-1 truncate font-semibold text-[15px] text-primary hover:underline"
        >
          {s.name}
        </Link>
        <Stars stars={s.rating.stars} count={s.rating.count} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-[15px] text-primary leading-5">
        <span className="flex h-5 w-5 items-center justify-center grayscale">
          <FacebookLogo size={20} />
        </span>
        Joined Facebook in {s.joinedYear}
      </div>
    </section>
  );
}

/* ───────────── Sponsored ───────────── */

/** The "Ad" block under Seller information: one Page ad, picked per listing. */
function SponsoredAd({
  listingId,
  toast,
}: {
  listingId: Id<"listings">;
  toast: (m: string) => void;
}) {
  const ads = useQ(api.listings.ads, {});
  const hide = useM(api.listings.hideAd);
  const [why, setWhy] = useState(false);
  if (!ads || ads.length === 0) return null;
  let h = 0;
  for (const c of listingId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ad = ads[h % ads.length];
  const remove = (reason: "hidden" | "reported") =>
    void hide({ postId: ad.postId, reason })
      .then(() =>
        toast(
          reason === "hidden"
            ? "Ad hidden. You'll see fewer ads like this."
            : "Thanks for reporting this ad.",
        ),
      )
      .catch(() => toast("Couldn't update this ad"));
  return (
    <section className="pt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[17px] text-primary leading-5">Ad</h2>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Ad options"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-icon shadow-[0_0_0_1px_var(--color-divider)] hover:bg-hover"
            >
              <MoreHorizontal size={20} />
            </button>
          </MenuTrigger>
          <MenuContent align="end" width={300}>
            <MenuItem
              icon={<EyeOff size={20} />}
              label="Hide ad"
              sub="See fewer ads like this."
              onSelect={() => remove("hidden")}
            />
            <MenuItem
              icon={<Flag size={20} />}
              label="Report ad"
              sub="Tell us about a problem with this ad."
              onSelect={() => remove("reported")}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Info size={20} />}
              label="Why am I seeing this ad?"
              onSelect={() => setWhy(true)}
            />
          </MenuContent>
        </Menu>
      </div>
      <Link
        to="/$username/posts/$postId"
        params={{ username: ad.page.username, postId: ad.postId }}
        className="group mt-4 ml-4 flex gap-3"
      >
        <Avatar src={ad.page.avatar} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-primary leading-5 group-hover:underline">
            {ad.page.name}
          </span>
          <span className="block truncate text-[13px] text-secondary leading-4">{ad.tagline}</span>
          <span className="relative mt-1 block aspect-square w-[157px] overflow-hidden rounded-lg border border-divider bg-input">
            <img src={ad.image} alt={ad.headline} className="h-full w-full object-cover" />
            {ad.video && (
              <span className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white">
                <PlayGlyph size={22} className="ml-0.5" />
              </span>
            )}
          </span>
        </span>
      </Link>
      <Modal open={why} onOpenChange={setWhy} title="Why am I seeing this ad?" width={548}>
        <div className="flex gap-3 p-4">
          <Avatar src={ad.page.avatar} size={40} />
          <p className="text-[15px] text-primary leading-5">
            <b className="font-semibold">{ad.page.name}</b> wants to reach people who browse
            Marketplace in the San Francisco Bay Area. You're seeing this ad based on your location
            and activity on Facebook.
          </p>
        </div>
      </Modal>
    </section>
  );
}

/* ───────────── Messaging ───────────── */

function useSendToSeller(l: Detail) {
  const send = useM(api.listings.messageSeller);
  const { openChat } = useChatDock();
  return async (text: string) => {
    const conversationId = await send({ listingId: l._id, text });
    openChat(conversationId);
    return conversationId;
  };
}

/** The sticky "Send seller a message" bar at the bottom of the panel. */
function MessageBar({ l }: { l: Detail }) {
  const send = useSendToSeller(l);
  const [text, setText] = useState(DEFAULT_MESSAGE);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await send(text);
      setSent(true);
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="shrink-0 border-divider border-t-[0.5px] px-4 pt-[14px] pb-[14px]">
      <div className="flex items-center gap-2 text-[15px] text-primary leading-5">
        <MessengerGradient size={16} />
        {sent ? "Message sent to seller" : "Send seller a message"}
      </div>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-divider bg-card px-4">
          <textarea
            aria-label="Message to seller"
            rows={1}
            value={text}
            placeholder="Send a message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            className="h-5 w-full resize-none bg-transparent text-[16px] text-primary leading-5 outline-none placeholder:text-placeholder"
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="flex h-9 w-[66px] items-center justify-center rounded-lg bg-btn-primary font-semibold text-[15px] text-white hover:bg-btn-primary-hover disabled:bg-btn disabled:text-disabled"
        >
          {busy ? <Spinner size={16} className="text-white" /> : "Send"}
        </button>
      </form>
    </div>
  );
}

function MessageDialog({ l, onClose }: { l: Detail; onClose: () => void }) {
  const send = useSendToSeller(l);
  const [text, setText] = useState(DEFAULT_MESSAGE);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Message seller" width={548}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          {l.photos[0] && (
            <img src={l.photos[0]} alt="" className="h-14 w-14 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-[15px] text-primary">{l.title}</p>
            <p className="text-[13px] text-secondary">
              {priceLine(l)} · {l.seller.name}
            </p>
          </div>
        </div>
        <textarea
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="mt-4 w-full resize-none rounded-lg border border-divider bg-card p-3 text-[15px] text-primary outline-none focus:border-fb"
        />
        <Button
          variant="primary"
          block
          className="mt-3"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await send(text);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          Send message
        </Button>
      </div>
    </Modal>
  );
}

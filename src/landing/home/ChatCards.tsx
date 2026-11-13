import { Link } from "@tanstack/react-router";
import { Box, Check, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toLandingPage, toListing, toRentalCheck } from "@/landing/links";
import { dateLabel, defaultMoveIn, errorText, todayInSF } from "@/landing/place/placeParts";
import { cn, price } from "@/lib/format";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ChatRentalCard, ChatSource } from "../../../convex/lib/homeChatRules";
import { placeProblem } from "../../../convex/lib/placeRules";
import type { ChatItemCard, ChatTally } from "./useChatLog";

/**
 * The cards a reply in Landing Home's chat carries: rentals to choose from,
 * the items Muse placed in the apartment, and the line saying what a message
 * saved. Code builds every card from the reply's data; Muse writes none of it.
 */

/** What the rental cards need from the page. */
export type RentalActions = {
  /** The listing that is already the person's place, if any. */
  currentListingId: string | null;
  /** What choosing a place replaces ("1BR · Valencia St"), if they have one. */
  replaces: string | null;
  /** The City Profile's move-in, for the date the form starts on. */
  statedMoveIn: { month: string; date?: string } | null;
  /** Makes the rental the person's place. Rejects with a `ConvexError` when it can't. */
  onChoose: (card: ChatRentalCard, moveIn: string) => Promise<void>;
  /** A card is hovered or focused (null when it no longer is): the map lifts its pin. */
  onHover: (listingId: string | null) => void;
  /** Flies the map to the rental's pin; absent for a rental the map doesn't show. */
  locate: (listingId: string) => (() => void) | null;
  onOpenApartment: () => void;
};

/**
 * Source links under a claim. Only links inside the app are followed
 * (`onSource` checks). `dots` puts a "·" between them.
 */
export function Sources({
  sources,
  onSource,
  className,
  dots,
}: {
  sources: readonly ChatSource[];
  onSource: (href: string) => void;
  className?: string;
  dots?: boolean;
}) {
  // A fixed list whose labels can repeat: the index is the key.
  return sources.map((s, i) => {
    const href = s.href;
    const dot = dots && i > 0 ? "·" : null;
    return href ? (
      <span key={i} className={cn("inline-flex gap-1", className)}>
        {dot}
        <button
          type="button"
          title={s.label}
          className="lh-link lh-focus min-w-0 truncate rounded-sm"
          onClick={() => onSource(href)}
        >
          {s.label}
        </button>
      </span>
    ) : (
      <span key={i} title={s.label} className={className}>
        {dot && `${dot} `}
        {s.label}
      </span>
    );
  });
}

/** "Saved to your City Profile: …", linking to the profile, where each fact can be edited. */
export function SavedLine({ saved }: { saved: readonly string[] }) {
  return (
    <Link
      {...toLandingPage("profile")}
      className="lh-saved lh-glass lh-focus text-secondary hover:text-primary"
    >
      <Check size={12} strokeWidth={3} className="shrink-0 text-positive" aria-hidden />
      <span className="min-w-0">
        Saved to your City Profile: <span className="text-primary">{saved.join(" · ")}</span>
      </span>
    </Link>
  );
}

/** A row of cards that scrolls sideways, with arrows when there is more either way. */
function CardRow({ label, children }: { label: string; children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  }, []);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [measure]);
  const page = (dir: 1 | -1) =>
    row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="lh-cards">
      <ul ref={row} aria-label={label} className="lh-card-row" onScroll={measure}>
        {children}
      </ul>
      {more.left && (
        <button
          type="button"
          aria-label="Earlier cards"
          className="lh-card-arrow lh-glass lh-focus left-1"
          onClick={() => page(-1)}
        >
          <ChevronLeft size={18} strokeWidth={2.4} />
        </button>
      )}
      {more.right && (
        <button
          type="button"
          aria-label="More cards"
          className="lh-card-arrow lh-glass lh-focus right-1"
          onClick={() => page(1)}
        >
          <ChevronRight size={18} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

/* ───────────── Rentals ───────────── */

export function RentalCards({
  rentals,
  actions,
  onSource,
}: {
  rentals: readonly ChatRentalCard[];
  actions: RentalActions;
  onSource: (href: string) => void;
}) {
  // No reasons to show (someone with no City Profile yet): shorter cards, all the same height.
  const compact = rentals.every((r) => r.reasons.length === 0);
  // Cards that leave while hovered (another chat opens) never get a mouseleave.
  const { onHover } = actions;
  useEffect(() => () => onHover(null), [onHover]);
  return (
    <CardRow label="Rentals to choose from">
      {rentals.map((r) => (
        <RentalCard key={r.id} rental={r} compact={compact} actions={actions} onSource={onSource} />
      ))}
    </CardRow>
  );
}

function RentalCard({
  rental: r,
  compact,
  actions,
  onSource,
}: {
  rental: ChatRentalCard;
  compact: boolean;
  actions: RentalActions;
  onSource: (href: string) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const mine = actions.currentListingId === r.id;
  const locate = actions.locate(r.id);
  const hover = (on: boolean) => actions.onHover(on ? r.id : null);
  return (
    <li
      className={cn("lh-card lh-rental lh-glass", compact && "lh-rental-compact")}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      onFocus={() => hover(true)}
      onBlur={() => hover(false)}
    >
      {/* The short card gives the form its whole height. */}
      <div className={cn("flex gap-2.5", compact && choosing && "hidden")}>
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-comment">
          {r.photo && <img src={r.photo} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[16px] text-primary leading-5">
            {price(r.price)}
            <span className="font-normal text-[12px] text-secondary"> / month</span>
          </p>
          <p className="truncate text-[13px] text-primary leading-[18px]" title={r.title}>
            {r.title}
          </p>
          <p className="truncate text-[12px] text-secondary leading-4">
            {[
              r.neighborhood,
              r.availableFrom ? `From ${shortDate(r.availableFrom)}` : "Available now",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {choosing ? (
        <ChooseForm rental={r} actions={actions} onCancel={() => setChoosing(false)} />
      ) : (
        <>
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            {r.reasons.slice(0, 2).map((reason) => (
              <li key={reason.text} className="min-w-0">
                <p className="truncate text-[13px] text-primary leading-[18px]" title={reason.text}>
                  {reason.text}
                </p>
                {reason.sources.length > 0 && (
                  <p className="flex min-w-0 gap-1.5 text-[11px] text-secondary leading-[14px]">
                    <Sources
                      sources={reason.sources}
                      onSource={onSource}
                      className="min-w-0 truncate"
                    />
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            {mine ? (
              <button
                type="button"
                className="lh-btn lh-btn-primary lh-btn-grow lh-focus"
                onClick={actions.onOpenApartment}
              >
                <Check size={14} strokeWidth={3} aria-hidden /> Your place
              </button>
            ) : (
              <button
                type="button"
                className="lh-btn lh-btn-primary lh-btn-grow lh-focus"
                onClick={() => setChoosing(true)}
              >
                Choose this place
              </button>
            )}
            <Link
              {...toRentalCheck(r.id as Id<"listings">)}
              className="lh-btn lh-btn-quiet lh-focus"
              aria-label={`View ${r.title}`}
            >
              View
            </Link>
            {locate && (
              <button
                type="button"
                className="lh-btn lh-btn-quiet lh-btn-icon lh-focus"
                aria-label={`Show ${r.title} on the map`}
                title="Show on the map"
                onClick={locate}
              >
                <MapPin size={16} aria-hidden />
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

/** "Dec 2" from "2026-12-02". */
function shortDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * "Choose this place", inside the card: the move-in date, then it's theirs.
 * Private, like "I'm taking this place" on the rental's page (#132): the
 * lister isn't told.
 */
function ChooseForm({
  rental,
  actions,
  onCancel,
}: {
  rental: ChatRentalCard;
  actions: RentalActions;
  onCancel: () => void;
}) {
  const id = useId();
  const today = todayInSF();
  const [moveIn, setMoveIn] = useState(() =>
    defaultMoveIn({ today, available: rental.availableFrom, stated: actions.statedMoveIn }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = placeProblem({ status: "moving_in", moveIn }, today);
  const early =
    !problem && rental.availableFrom && moveIn < rental.availableFrom
      ? `It's available from ${dateLabel(rental.availableFrom)}.`
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    try {
      await actions.onChoose(rental, moveIn);
      // The page takes it from here (the Apartment tab opens); the card goes back to normal.
      onCancel();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="shrink-0 font-semibold text-[13px] text-primary">
          Move-in date
        </label>
        <input
          id={id}
          type="date"
          required
          // biome-ignore lint/a11y/noAutofocus: the form opens because the person asked for it.
          autoFocus
          value={moveIn}
          min={today}
          onChange={(e) => setMoveIn(e.target.value)}
          className="lh-focus h-8 min-w-0 flex-1 rounded-lg border border-divider bg-card px-2 text-[13px] text-primary"
        />
      </div>
      {error || problem ? (
        <p role="alert" className="line-clamp-2 flex-1 text-[12px] text-negative leading-4">
          {error ?? problem}
        </p>
      ) : (
        <p className="line-clamp-2 flex-1 text-[12px] text-secondary leading-4">
          {early ??
            (actions.replaces
              ? `Replaces ${actions.replaces}. `
              : "It becomes your place and gets a 3D model. ")}
          {!early && "Only you can see it; the lister isn't told."}
        </p>
      )}
      <div className="flex gap-1.5">
        <button type="button" className="lh-btn lh-btn-quiet lh-focus" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !!problem}
          className="lh-btn lh-btn-primary lh-btn-grow lh-focus"
        >
          {busy ? "Saving…" : "Make it my place"}
        </button>
      </div>
    </form>
  );
}

/* ───────────── Furnishing picks ───────────── */

/**
 * "$1,240 of $1,500 placed": what is placed in the apartment against its one
 * furniture budget (#153), the same two numbers as the Apartment tab's chip;
 * "$1,240 placed" with no budget. The server never places past the budget, so
 * "over" shows only if a placed listing's price rose before this reply.
 */
export function Tally({ tally }: { tally: ChatTally }) {
  const { spent, budget } = tally;
  if (budget === null)
    return (
      <p className="mt-1.5 text-[12px] text-secondary">
        <b className="text-primary tabular-nums">{price(spent)}</b> placed
      </p>
    );
  const over = spent > budget;
  return (
    <div className="mt-2">
      <p className="text-[12px] text-secondary">
        <b className={cn("tabular-nums", over ? "text-negative" : "text-primary")}>
          {price(spent)}
        </b>{" "}
        of {price(budget)}
        {over ? ", over your budget" : " placed"}
      </p>
      <div
        role="meter"
        aria-label="Furniture budget used"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(spent, budget)}
        aria-valuetext={`${price(spent)} of ${price(budget)}`}
        className="mt-1 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary-text)_12%,transparent)]"
      >
        <div
          className={cn("h-full rounded-full", over ? "bg-negative" : "bg-fb")}
          style={{ width: `${budget > 0 ? Math.min(100, (spent / budget) * 100) : 100}%` }}
        />
      </div>
    </div>
  );
}

export function ItemCards({
  items,
  focused,
  onFocusItem,
}: {
  items: readonly ChatItemCard[];
  /** The item the 3D view is showing. */
  focused: string | null;
  onFocusItem: (itemId: string) => void;
}) {
  return (
    <CardRow label="Pieces placed in your apartment">
      {items.map((i) => (
        <li key={i.itemId} className="lh-card lh-item lh-glass">
          <div className="flex gap-2.5">
            <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] bg-comment">
              {i.photo && <img src={i.photo} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate font-semibold text-[13px] text-primary leading-[18px]"
                title={i.title}
              >
                {i.title}
              </p>
              <p className="text-[13px] text-primary leading-[18px]">
                <b className="tabular-nums">{price(i.price)}</b>
                <span className="text-secondary"> · {KIND_LABEL[i.kind] ?? i.kind}</span>
              </p>
            </div>
          </div>
          <p
            className="line-clamp-2 min-h-0 flex-1 text-[12px] text-secondary leading-4"
            title={i.reason}
          >
            {i.reason}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-pressed={focused === i.itemId}
              className="lh-btn lh-btn-soft lh-btn-grow lh-focus"
              onClick={() => onFocusItem(i.itemId)}
            >
              <Box size={14} aria-hidden /> Show in 3D
            </button>
            <Link
              {...toListing(i.listingId)}
              className="lh-btn lh-btn-quiet lh-focus"
              aria-label={`${i.title} on Marketplace`}
            >
              Listing
            </Link>
          </div>
        </li>
      ))}
    </CardRow>
  );
}

const KIND_LABEL: Record<string, string> = {
  sofa: "Sofa",
  bed: "Bed",
  table: "Table",
  storage: "Storage",
  chair: "Chair",
  desk: "Desk",
  lamp: "Lamp",
  rug: "Rug",
  art: "Art",
  plant: "Plant",
  decor: "Decor",
};

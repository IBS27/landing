import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { toNeighborhood, toRentalCheck } from "@/landing/links";
import { cn, price } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Button, Card, Skeleton } from "@/ui/primitives";
import type { api } from "../../../convex/_generated/api";
import type { RentalFilters } from "../../../convex/lib/rentalFit";

type Search = FunctionReturnType<typeof api.rentals.search>;

const BEDROOMS = [1, 2, 3] as const;
const MAX_PRICES = [2000, 2500, 3000, 3500, 4000, 5000] as const;

/** A reason's source, as a quiet inline link after its text rather than a grey chip. */
const SOURCE_LINK =
  "ml-1.5 h-[18px]! gap-0.5! rounded px-1! align-top font-normal! text-secondary! bg-transparent! hover:bg-hover! hover:text-primary! data-[state=open]:bg-hover! data-[state=open]:text-primary!";

/**
 * Rentals ranked by fit with the viewer's City Profile (#10): budget, transit,
 * interests, target neighborhood and move-in date. Must-haves filter the list.
 * Each result shows the reasons behind its rank, with sources.
 */
export function RentalResults({
  data,
  filters,
  onFilters,
}: {
  data: Search | undefined;
  filters: RentalFilters;
  onFilters: (f: RentalFilters) => void;
}) {
  const set = (patch: RentalFilters) => onFilters({ ...filters, ...patch });
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-bold text-[17px] text-primary leading-5">Rentals for you</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Ranked by your budget, transit, interests, neighborhoods and move-in date from your City
          Profile.
        </p>
      </div>
      <fieldset className="flex flex-wrap gap-2 px-4 pb-3">
        <legend className="sr-only">Must-haves</legend>
        <Select
          label="Bedrooms"
          value={filters.bedrooms}
          onChange={(bedrooms) => set({ bedrooms })}
        >
          <option value="">Any bedrooms</option>
          {BEDROOMS.map((n) => (
            <option key={n} value={n}>
              {n}+ bedrooms
            </option>
          ))}
        </Select>
        <Select
          label="Max price"
          value={filters.maxPrice}
          onChange={(maxPrice) => set({ maxPrice })}
        >
          <option value="">Any price</option>
          {MAX_PRICES.map((n) => (
            <option key={n} value={n}>
              Up to {price(n)}
            </option>
          ))}
        </Select>
        <Toggle on={!!filters.pets} onClick={() => set({ pets: !filters.pets || undefined })}>
          Pets allowed
        </Toggle>
        <Toggle
          on={!!filters.furnished}
          onClick={() => set({ furnished: !filters.furnished || undefined })}
        >
          Furnished
        </Toggle>
      </fieldset>
      {data === undefined ? (
        <div className="p-4">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {data.needsBrief && (
            <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg bg-wash p-3 dark:bg-hover">
              <p className="text-[13px] text-primary leading-[18px]">
                Finish your brief to rank rentals by your budget, transit and interests. Until then,
                these are the newest.
              </p>
              <Link to="/landing/welcome">
                <Button variant="primary" size="sm">
                  Finish your brief
                </Button>
              </Link>
            </div>
          )}
          {data.results.length === 0 && (
            <p className="px-4 pb-4 text-[15px] text-secondary">
              No rentals meet your must-haves. Try removing one.
            </p>
          )}
          <ul className="divide-y divide-divider">
            {data.results.map((r) => (
              <li key={r._id} className="flex gap-3 px-4 py-3">
                {r.photo ? (
                  <img
                    src={r.photo}
                    alt=""
                    className="h-[72px] w-[72px] shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-[72px] w-[72px] shrink-0 rounded-lg bg-comment" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    {...toRentalCheck(r._id)}
                    className="line-clamp-2 font-semibold text-[15px] text-primary leading-5 hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
                    <span className="font-semibold text-primary">{price(r.price)}/mo</span>
                    {r.listingType === "sublet" ? " · Sublet" : ""}
                    {r.area ? (
                      <>
                        {" · "}
                        <Link {...toNeighborhood(r.area)} className="hover:underline">
                          {r.area.label}
                        </Link>
                      </>
                    ) : (
                      r.neighborhood && ` · ${r.neighborhood}`
                    )}
                    {r.verified && (
                      <>
                        {" · "}
                        <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-positive">
                          <BadgeCheck
                            size={13}
                            strokeWidth={2.5}
                            aria-hidden
                            className="shrink-0"
                          />
                          Verified
                        </span>
                      </>
                    )}
                  </p>
                  {r.reasons.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {r.reasons.map((x) => (
                        <li key={x.kind} className="flex items-start gap-1.5">
                          {x.tone === "good" ? (
                            <CircleCheck
                              size={14}
                              strokeWidth={2.25}
                              aria-hidden
                              className="mt-0.5 shrink-0 text-positive"
                            />
                          ) : (
                            <CircleAlert
                              size={14}
                              strokeWidth={2.25}
                              aria-hidden
                              className="mt-0.5 shrink-0 text-[#B07A00] dark:text-[#F7B928]"
                            />
                          )}
                          <p className="min-w-0 text-[13px] text-primary leading-[18px]">
                            {x.text}
                            <SourcesChip
                              sources={x.sources}
                              label="Source"
                              className={SOURCE_LINK}
                            />
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const FILTER =
  "h-8 rounded-full font-semibold text-[13px] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent dark:hover:brightness-125";
const filterTone = (on: boolean) => (on ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-primary");

/** A must-have dropdown styled like the toggles beside it; empty means "any". */
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        className={cn(
          FILTER,
          filterTone(value !== undefined),
          "cursor-pointer appearance-none pr-8 pl-3",
        )}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2.5}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2",
          value !== undefined ? "text-btn-soft-text" : "text-primary",
        )}
      />
    </span>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(FILTER, filterTone(on), "px-3")}
    >
      {children}
    </button>
  );
}

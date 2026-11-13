import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { toRentalCheck } from "@/landing/links";
import { cn, price } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Button, Card, Skeleton } from "@/ui/primitives";
import type { api } from "../../../convex/_generated/api";
import type { RentalFilters } from "../../../convex/lib/rentalFit";

type Search = FunctionReturnType<typeof api.rentals.search>;

const BEDROOMS = [1, 2, 3] as const;
const MAX_PRICES = [2000, 2500, 3000, 3500, 4000, 5000] as const;

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
  const select =
    "h-8 rounded-full bg-btn px-3 font-semibold text-[13px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";
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
        <select
          aria-label="Bedrooms"
          className={select}
          value={filters.bedrooms ?? ""}
          onChange={(e) => set({ bedrooms: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Any bedrooms</option>
          {BEDROOMS.map((n) => (
            <option key={n} value={n}>
              {n}+ bedrooms
            </option>
          ))}
        </select>
        <select
          aria-label="Max price"
          className={select}
          value={filters.maxPrice ?? ""}
          onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Any price</option>
          {MAX_PRICES.map((n) => (
            <option key={n} value={n}>
              Up to {price(n)}
            </option>
          ))}
        </select>
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
              <li key={r._id}>
                <div className="flex gap-3 px-4 py-3">
                  {r.photo ? (
                    <img
                      src={r.photo}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-md bg-wash" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        {...toRentalCheck(r._id)}
                        className="truncate font-semibold text-[15px] text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.verified && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E3F5E5] px-2 py-0.5 font-semibold text-[#24832C] text-[12px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
                          <BadgeCheck size={13} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-secondary">
                      {price(r.price)}/mo
                      {r.listingType === "sublet" ? " · Sublet" : ""}
                      {r.neighborhood ? ` · ${r.neighborhood}` : ""}
                    </div>
                    {r.reasons.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.reasons.map((x) => (
                          <li
                            key={x.kind}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[12px]",
                              x.tone === "good"
                                ? "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]"
                                : "bg-[#FFF4D6] text-[#8A6100] dark:bg-[#F7B928]/20 dark:text-[#F7B928]",
                            )}
                          >
                            {x.tone === "good" ? (
                              <CircleCheck size={12} aria-hidden />
                            ) : (
                              <CircleAlert size={12} aria-hidden />
                            )}
                            <span className="font-semibold">{x.text}</span>
                            <SourcesChip sources={x.sources} label="Source" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
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
      className={cn(
        "h-8 rounded-full px-3 font-semibold text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
        on ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-primary",
      )}
    >
      {children}
    </button>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, BellRing } from "lucide-react";
import { useCallback, useState } from "react";
import { useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import { type CategoryMeta, categoryBySlug } from "../../../convex/lib/listings";
import {
  type FilterKind,
  FilterPanel,
  filterKey,
  type MpSearch,
  toFilters,
  VEHICLE_TYPES,
} from "./filters";
import { ListingGrid, useGrowingLimit, useSticky } from "./grid";
import { useNear } from "./location";
import {
  CategoryList,
  CreateListingButton,
  CrumbHeader,
  LocationChip,
  LocationLink,
  MainRail,
  MpShell,
  RailDivider,
  RailSearch,
  RailTitle,
} from "./rails";

type BrowseArgs = { category?: string; q?: string; search: MpSearch };

/** Live, filtered, infinitely growing listing results. */
function useBrowse({ category, q, search }: BrowseArgs) {
  const near = useNear();
  const key = `${category ?? ""}|${q ?? ""}|${filterKey(search)}|${near.lat},${near.lng},${near.radiusMi}`;
  const { limit, more } = useGrowingLimit(key);
  const fresh = useQ(api.listings.browse, {
    category,
    q,
    filters: toFilters(search),
    sort: search.sort,
    near,
    limit,
  });
  const data = useSticky(fresh, key);
  const loading = fresh === undefined;
  const onMore = useCallback(() => {
    if (!loading) more();
  }, [loading, more]);
  return { data, onMore };
}

function PicksHeader({ title = "Today's picks" }: { title?: string }) {
  return (
    <div className="flex h-9 items-center justify-between">
      <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
      <LocationChip />
    </div>
  );
}

/** /marketplace — Browse all: Today's picks. */
export function BrowsePage() {
  const { data, onMore } = useBrowse({ search: {} });
  return (
    <MpShell rail={<MainRail active="browse" />}>
      <div className="pb-3">
        <PicksHeader />
      </div>
      <div>
        <ListingGrid data={data} onMore={onMore} />
      </div>
    </MpShell>
  );
}

function filterKind(meta: CategoryMeta | null): FilterKind {
  if (meta?.slug === "vehicles") return "vehicles";
  if (meta?.slug === "propertyrentals") return "rentals";
  if (meta?.slug === "propertyforsale") return "homesales";
  return "general";
}

/** Rail for category and search pages: crumb, title, search, filters, categories. */
function FilterRail({
  crumbs,
  title,
  meta,
  search,
  searchMode,
}: {
  crumbs: { label: string; to?: string }[];
  title: string;
  meta: CategoryMeta | null;
  search: MpSearch;
  searchMode?: boolean;
}) {
  const kind = filterKind(meta);
  return (
    <>
      <CrumbHeader crumbs={crumbs} title={title} />
      <div className="mt-2.5">
        <RailSearch key={search.q ?? ""} initial={search.q ?? ""} category={meta?.slug} />
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {meta && !searchMode && <NotifyMe slug={meta.slug} />}
        <CreateListingButton className="mx-2 mt-2" />
        <RailDivider className="mt-3" />
        <div className="pt-3">
          <RailTitle>Filters</RailTitle>
          <LocationLink className="mt-2" />
          <div className="mt-1">
            <FilterPanel kind={kind} value={search} />
          </div>
        </div>
        <RailDivider className="mt-2" />
        <div className="pt-4">
          <RailTitle>Categories</RailTitle>
          <CategoryList
            active={meta?.slug}
            linkFor={
              searchMode
                ? (slug) => ({
                    to: "/marketplace/search",
                    search: { q: search.q, category: slug === meta?.slug ? undefined : slug },
                  })
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
}

const NOTIFY_KEY = "fb-clone:marketplace-alerts";
function readAlerts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** "Notify Me" follows a category (a per-viewer alert preference). */
function NotifyMe({ slug }: { slug: string }) {
  const viewer = useViewer();
  const key = `${viewer._id}:${slug}`;
  const [on, setOn] = useState(() => readAlerts().includes(key));
  return (
    <button
      type="button"
      onClick={() => {
        const next = on ? readAlerts().filter((k) => k !== key) : [...readAlerts(), key];
        try {
          localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
        } catch {
          // Preference only lasts for this tab without storage.
        }
        setOn(!on);
      }}
      className={cn(
        "mx-2 flex h-9 w-[calc(100%-16px)] items-center justify-center gap-1.5 rounded-lg font-semibold text-[15px] hover:brightness-95 dark:hover:brightness-125",
        on ? "bg-btn text-btn-text" : "bg-btn-soft text-btn-soft-text",
      )}
    >
      {on ? <BellRing size={16} strokeWidth={2.25} /> : <Bell size={16} strokeWidth={2.25} />}
      {on ? "Notifications on" : "Notify Me"}
    </button>
  );
}

const SHOP_CHIPS: Record<string, { label: string; patch: Partial<MpSearch> }[]> = {
  propertyrentals: [
    { label: "Apartments for Rent", patch: { type: "apartment" } },
    { label: "Condos for Rent", patch: { type: "condo" } },
    { label: "Houses for Rent", patch: { type: "house" } },
    { label: "Townhouses for Rent", patch: { type: "townhouse" } },
  ],
  propertyforsale: [
    { label: "Houses for Sale", patch: { type: "house" } },
    { label: "Townhouses for Sale", patch: { type: "townhouse" } },
    { label: "Apartments for Sale", patch: { type: "apartment" } },
  ],
  vehicles: VEHICLE_TYPES.slice(0, 6).map((t) => ({
    label: t === "Car/Truck" ? "Cars & Trucks" : t === "Motorcycle" ? "Motorcycles" : t,
    patch: { vehicleType: t },
  })),
};

function ShopByCategory({ slug, search }: { slug: string; search: MpSearch }) {
  const navigate = useNavigate();
  const chips = SHOP_CHIPS[slug];
  if (!chips) return null;
  return (
    <section className="mt-5 rounded-xl border border-divider bg-card px-4 pt-4 pb-6 shadow-base">
      <h2 className="font-bold text-[20px] text-primary leading-6">Shop by Category</h2>
      <div className="mt-[15px] flex flex-wrap gap-2">
        {chips.map((c) => {
          const [k, v] = Object.entries(c.patch)[0] as [keyof MpSearch, string];
          const active = search[k] === v;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={active}
              onClick={() =>
                void navigate({
                  to: ".",
                  search: (prev: Record<string, unknown>) => ({
                    ...prev,
                    [k]: active ? undefined : v,
                  }),
                  replace: true,
                })
              }
              className={cn(
                "h-9 rounded-full px-3 font-semibold text-[15px] transition-colors",
                active
                  ? "bg-highlight text-link"
                  : "bg-btn text-btn-text hover:brightness-95 dark:hover:brightness-125",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** /marketplace/category/$category */
export function CategoryPage({ slug, search }: { slug: string; search: MpSearch }) {
  const meta = categoryBySlug(slug);
  const { data, onMore } = useBrowse({ category: slug, search });
  if (!meta)
    return (
      <MpShell rail={<MainRail active={null} />}>
        <div className="py-24 text-center">
          <p className="font-bold text-[20px] text-secondary">This category isn't available</p>
          <Link
            to="/marketplace"
            className="mt-3 inline-block font-semibold text-link hover:underline"
          >
            Browse all
          </Link>
        </div>
      </MpShell>
    );
  const chips = SHOP_CHIPS[slug];
  return (
    <MpShell
      rail={
        <FilterRail
          crumbs={[{ label: "Marketplace", to: "/marketplace" }, { label: meta.label }]}
          title={meta.label}
          meta={meta}
          search={search}
        />
      }
    >
      {chips ? (
        <ShopByCategory slug={slug} search={search} />
      ) : (
        <div className="pb-3">
          <PicksHeader />
        </div>
      )}
      <div className={chips ? "pt-[26px]" : undefined}>
        <ListingGrid data={data} onMore={onMore} />
      </div>
    </MpShell>
  );
}

/** /marketplace/search?q= */
export function SearchPage({ search }: { search: MpSearch }) {
  const meta = search.category ? categoryBySlug(search.category) : null;
  const { data, onMore } = useBrowse({ category: meta?.slug, q: search.q, search });
  return (
    <MpShell
      rail={
        <FilterRail
          crumbs={[{ label: "Marketplace", to: "/marketplace" }, { label: "Search results" }]}
          title="Search results"
          meta={meta}
          search={search}
          searchMode
        />
      }
    >
      <div className="pb-3">
        <PicksHeader
          title={
            search.q
              ? `Results for "${search.q}"${meta ? ` in ${meta.label}` : ""}`
              : "Search results"
          }
        />
      </div>
      <div>
        <ListingGrid
          data={search.q ? data : { items: [], hasMore: false }}
          onMore={onMore}
          empty={
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-bold text-[20px] text-secondary leading-6">
                {search.q ? "No results found" : "Search Marketplace"}
              </p>
              <p className="mt-1 text-[15px] text-secondary">
                {search.q
                  ? "Try a different search, or check your spelling and filters."
                  : "Search for items, vehicles and homes near you."}
              </p>
            </div>
          }
        />
      </div>
    </MpShell>
  );
}

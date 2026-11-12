import { Link, useNavigate } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useQ } from "@/app/viewer";
import {
  CalendarStarGlyph,
  CardsGlyph,
  FlagGlyph,
  GroupsGlyph,
  PeopleGlyph,
  PhotoGlyph,
  PinGlyph,
  PostsGlyph,
  StoreGlyph,
  VideoGlyph,
} from "@/features/misc/glyphs";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import type { SearchParams, SearchTab } from "./params";

type IconType = ComponentType<{ size?: number; className?: string }>;

export const TABS: { tab: SearchTab; label: string; Icon: IconType }[] = [
  { tab: "top", label: "All", Icon: CardsGlyph },
  { tab: "posts", label: "Posts", Icon: PostsGlyph },
  { tab: "people", label: "People", Icon: PeopleGlyph },
  { tab: "photos", label: "Photos", Icon: PhotoGlyph },
  { tab: "videos", label: "Videos", Icon: VideoGlyph },
  { tab: "marketplace", label: "Marketplace", Icon: StoreGlyph },
  { tab: "pages", label: "Pages", Icon: FlagGlyph },
  { tab: "places", label: "Places", Icon: PinGlyph },
  { tab: "groups", label: "Groups", Icon: GroupsGlyph },
  { tab: "events", label: "Events", Icon: CalendarStarGlyph },
];

/* ---------- Filter controls ---------- */

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-[46px] w-full items-center justify-between rounded-lg pr-2 pl-2 text-left hover:bg-hover"
    >
      <span className="text-[15px] text-primary leading-5">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-fb" : "bg-[#8f9297] dark:bg-[#6f7276]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform",
            on && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

function Caret() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M10 14a1 1 0 0 1-.755-.349L5.329 9.182a1.367 1.367 0 0 1-.205-1.46A1.184 1.184 0 0 1 6.2 7h7.6a1.18 1.18 0 0 1 1.074.721 1.357 1.357 0 0 1-.2 1.457l-3.918 4.474A1 1 0 0 1 10 14z" />
    </svg>
  );
}

function FilterSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex h-[46px] w-full items-center justify-between rounded-lg pr-3 pl-2 text-left hover:bg-hover data-[state=open]:bg-hover"
        >
          <span
            className={cn(
              "truncate text-[15px] leading-5",
              current ? "font-semibold text-primary" : "text-primary",
            )}
          >
            {current ? current.label : label}
          </span>
          <span className="text-icon-secondary">
            <Caret />
          </span>
        </button>
      </MenuTrigger>
      <MenuContent width={294} align="start" className="max-h-[360px] overflow-y-auto">
        <MenuItem label={label} onSelect={() => onChange(undefined)} />
        {options.map((o) => (
          <MenuItem
            key={String(o.value)}
            label={<span className={cn(o.value === value && "text-link")}>{o.label}</span>}
            onSelect={() => onChange(o.value)}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

/* ---------- Rail ---------- */

function PostFilters({
  params,
  set,
  withSeen,
}: {
  params: SearchParams;
  set: (patch: Partial<SearchParams>) => void;
  withSeen: boolean;
}) {
  const year = new Date().getFullYear();
  return (
    <>
      {withSeen && (
        <>
          <Toggle
            label="Recent posts"
            on={!!params.recent}
            onChange={(v) => set({ recent: v || undefined })}
          />
          <Toggle
            label="Posts you've seen"
            on={!!params.seen}
            onChange={(v) => set({ seen: v || undefined })}
          />
        </>
      )}
      <FilterSelect
        label="Date posted"
        value={params.date}
        options={[0, 1, 2, 3, 4, 5].map((i) => ({ value: year - i, label: String(year - i) }))}
        onChange={(v) => set({ date: v })}
      />
      <FilterSelect
        label="Posts from"
        value={params.from}
        options={[
          { value: "you" as const, label: "Your posts" },
          { value: "friends" as const, label: "Your friends" },
          { value: "groups" as const, label: "Your groups and Pages" },
          { value: "public" as const, label: "Public posts" },
        ]}
        onChange={(v) => set({ from: v })}
      />
    </>
  );
}

function PeopleFilters({
  params,
  set,
}: {
  params: SearchParams;
  set: (patch: Partial<SearchParams>) => void;
}) {
  const cities = useQ(api.search.peopleCities, params.q ? { q: params.q } : "skip") ?? [];
  return (
    <>
      <Toggle
        label="Friends of friends"
        on={!!params.fof}
        onChange={(v) => set({ fof: v || undefined })}
      />
      <FilterSelect
        label="City"
        value={params.city}
        options={cities.map((c) => ({ value: c, label: c }))}
        onChange={(v) => set({ city: v })}
      />
    </>
  );
}

function SubFilters({
  tab,
  params,
  set,
}: {
  tab: SearchTab;
  params: SearchParams;
  set: (patch: Partial<SearchParams>) => void;
}) {
  switch (tab) {
    case "top":
    case "posts":
      return <PostFilters params={params} set={set} withSeen />;
    case "photos":
    case "videos":
      return <PostFilters params={params} set={set} withSeen={false} />;
    case "people":
      return <PeopleFilters params={params} set={set} />;
    case "groups":
      return (
        <>
          <Toggle
            label="Public groups"
            on={!!params.pub}
            onChange={(v) => set({ pub: v || undefined })}
          />
          <Toggle
            label="My groups"
            on={!!params.mine}
            onChange={(v) => set({ mine: v || undefined })}
          />
        </>
      );
    case "events":
      return (
        <>
          <Toggle
            label="Online events"
            on={!!params.online}
            onChange={(v) => set({ online: v || undefined })}
          />
          <FilterSelect
            label="Dates"
            value={params.when}
            options={[
              { value: "today" as const, label: "Today" },
              { value: "tomorrow" as const, label: "Tomorrow" },
              { value: "week" as const, label: "This week" },
              { value: "month" as const, label: "This month" },
            ]}
            onChange={(v) => set({ when: v })}
          />
        </>
      );
    case "marketplace":
      return (
        <FilterSelect
          label="Price"
          value={params.max}
          options={[25, 50, 100, 250, 500, 1000, 2500].map((n) => ({
            value: n,
            label: `Under $${n.toLocaleString("en-US")}`,
          }))}
          onChange={(v) => set({ max: v })}
        />
      );
    default:
      return null;
  }
}

/** Left "Search results" rail: tab list with the active tab's filters under it. */
export function SearchRail({ tab, params }: { tab: SearchTab; params: SearchParams }) {
  const navigate = useNavigate();
  const set = (patch: Partial<SearchParams>) =>
    void navigate({
      to: "/search/$tab",
      params: { tab },
      search: { ...params, ...patch },
      replace: true,
    });

  return (
    <aside
      aria-label="Result filters"
      className="sticky top-14 h-[calc(100vh-56px)] w-[360px] shrink-0 overflow-y-auto bg-card shadow-[1px_0_2px_var(--shadow-1)]"
    >
      <h1 className="px-4 pt-[14px] font-bold text-[24px] text-primary leading-7">
        Search results
      </h1>
      <div className="mx-4 mt-[15px] h-px bg-divider" />
      <h2 className="px-4 pt-[16px] pb-2 font-semibold text-[17px] text-primary leading-5">
        Filters
      </h2>
      <nav className="px-2 pb-4">
        {TABS.map(({ tab: t, label, Icon }) => {
          const active = t === tab;
          return (
            <div key={t}>
              <Link
                to="/search/$tab"
                params={{ tab: t }}
                search={{ q: params.q }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[52px] items-center gap-3 rounded-lg px-2 transition-colors",
                  active ? "bg-wash dark:bg-hover" : "hover:bg-hover",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-fb text-white" : "bg-btn text-icon",
                  )}
                >
                  <Icon size={20} />
                </span>
                <span className="font-medium text-[15px] text-primary leading-5">{label}</span>
              </Link>
              {active && (
                <div className="flex flex-col pt-1 pb-2 pl-[50px]">
                  <SubFilters tab={tab} params={params} set={set} />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

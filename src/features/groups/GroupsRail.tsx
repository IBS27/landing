import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useQ } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CompassGlyph, FeedGlyph, GearGlyph, PeopleGlyph, PlusGlyph, SearchGlyph } from "./icons";
import { lastActive } from "./util";

export type RailSection = "feed" | "discover" | "joins" | null;

/** Groups' 360px white sidebar: title, search, nav rows, Create, joined groups. */
export function GroupsRail({ active }: { active: RailSection }) {
  const mine = useQ(api.groups.mine, {});
  return (
    <nav
      aria-label="List of groups"
      className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col overflow-y-auto bg-card min-[900px]:flex"
    >
      <div className="flex h-9 items-center justify-between px-4 mt-[11px]">
        <h1 className="font-bold text-[24px] text-primary leading-7">Groups</h1>
        <Tooltip content="Edit Groups settings">
          <Link
            to="/settings"
            aria-label="Edit Groups settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
          >
            <GearGlyph size={20} />
          </Link>
        </Tooltip>
      </div>
      <RailSearch />
      <div className="mt-4 flex flex-col px-2">
        <RailRow
          to="/groups/feed"
          label="Your feed"
          icon={<FeedGlyph />}
          selected={active === "feed"}
        />
        <RailRow
          to="/groups/discover"
          label="Discover"
          icon={<CompassGlyph />}
          selected={active === "discover"}
        />
        <RailRow
          to="/groups/joins"
          label="Your groups"
          icon={<PeopleGlyph />}
          selected={active === "joins"}
        />
      </div>
      <div className="px-4">
        <Link
          to="/groups/create"
          className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125"
        >
          <PlusGlyph size={16} />
          Create new group
        </Link>
        <div className="mt-4 h-px bg-divider" />
      </div>
      <div className="flex items-center justify-between px-4 pt-[14px] pb-1">
        <h2 className="font-semibold text-[17px] text-primary leading-5">Groups you've joined</h2>
        <Link to="/groups/joins" className="text-[15px] text-link hover:underline">
          See all
        </Link>
      </div>
      <div className="flex flex-col px-2 pb-4">
        {mine === undefined
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-[50px] w-[50px] rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
            ))
          : mine.map((g) => (
              <Link
                key={g._id}
                to="/groups/$groupId"
                params={groupParams(g)}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
              >
                <Avatar src={g.cover} size={50} square />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium text-[15px] text-primary leading-5">
                    {g.name}
                  </span>
                  <span className="block truncate text-[13px] text-secondary leading-4">
                    {lastActive(g.lastActiveAt)}
                  </span>
                </span>
              </Link>
            ))}
      </div>
    </nav>
  );
}

function RailRow({
  to,
  label,
  icon,
  selected,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  selected: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex h-14 items-center gap-3 rounded-lg px-2 transition-colors",
        selected ? "bg-wash" : "hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-accent text-white" : "bg-btn text-icon",
        )}
      >
        {icon}
      </span>
      <span className="font-semibold text-[15px] text-primary leading-5">{label}</span>
    </Link>
  );
}

/** "Search groups" with a typeahead of matching groups. */
function RailSearch() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const results = useQ(api.groups.search, q.trim() ? { q } : "skip");
  const navigate = useNavigate();
  const open = focused && q.trim().length > 0;
  return (
    <div className="relative mt-1.5 px-4">
      <label className="flex h-9 items-center gap-2 rounded-full bg-input pr-3 pl-3">
        <SearchGlyph size={16} className="shrink-0 text-icon-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results?.[0]) {
              void navigate({ to: "/groups/$groupId", params: groupParams(results[0]) });
              setQ("");
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Search groups"
          aria-label="Search groups"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
      </label>
      {open && (
        <div className="absolute inset-x-4 top-10 z-20 rounded-lg bg-popover p-2 shadow-elevated">
          {results === undefined ? (
            <div className="px-2 py-3 text-secondary text-sm">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-2 py-3 text-[15px] text-secondary">No results for "{q.trim()}"</div>
          ) : (
            results.map((g) => (
              <Link
                key={g._id}
                to="/groups/$groupId"
                params={groupParams(g)}
                onClick={() => setQ("")}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-hover"
              >
                <Avatar src={g.cover} size={36} square />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[15px] text-primary">
                    {g.name}
                  </span>
                  <span className="block truncate text-[13px] text-secondary">
                    {g.joined
                      ? "Joined"
                      : g.privacy === "public"
                        ? "Public group"
                        : "Private group"}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

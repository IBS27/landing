import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Avatar, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CaughtUp } from "./GroupsFeedPage";
import { GroupsRail } from "./GroupsRail";
import { LeaveGlyph } from "./icons";
import { relativeAgo } from "./util";

type Joined = FunctionReturnType<typeof api.groups.mine>[number];
type Sort = "recent" | "alpha";

/** /groups/joins: "Groups you manage" and "All groups you've joined". */
export function JoinsPage() {
  const mine = useQ(api.groups.mine, {});
  const [sort, setSort] = useState<Sort>("recent");
  const managed = (mine ?? []).filter((g) => g.role === "admin");
  const sorted = [...(mine ?? [])].sort((a, b) =>
    sort === "alpha"
      ? a.name.localeCompare(b.name)
      : (b.lastVisitedAt ?? b.joinedAt) - (a.lastVisitedAt ?? a.joinedAt),
  );

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <GroupsRail active="joins" />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-10 min-[1200px]:px-16">
        <div className="mx-auto w-full max-w-[952px]">
          {mine === undefined ? (
            <div className="grid grid-cols-1 gap-2 min-[1100px]:grid-cols-3 min-[800px]:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[148px] rounded-xl" />
              ))}
            </div>
          ) : mine.length === 0 ? (
            <div className="mx-auto max-w-[680px]">
              <CaughtUp />
            </div>
          ) : (
            <>
              {managed.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-4 font-bold text-[20px] text-primary">Groups you manage</h2>
                  <Grid groups={managed} />
                </section>
              )}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold text-[20px] text-primary">
                    All groups you've joined ({mine.length})
                  </h2>
                  <Menu modal={false}>
                    <MenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[17px] text-link hover:bg-hover"
                      >
                        Sort
                      </button>
                    </MenuTrigger>
                    <MenuContent width={260}>
                      <MenuItem
                        label={sortLabel("recent", sort)}
                        onSelect={() => setSort("recent")}
                      />
                      <MenuItem
                        label={sortLabel("alpha", sort)}
                        onSelect={() => setSort("alpha")}
                      />
                    </MenuContent>
                  </Menu>
                </div>
                <Grid groups={sorted} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function sortLabel(k: Sort, current: Sort) {
  return (
    <span className="flex items-center justify-between">
      {k === "recent" ? "Recent activity" : "Alphabetical"}
      {k === current && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
    </span>
  );
}

function Grid({ groups }: { groups: Joined[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[1100px]:grid-cols-3 min-[800px]:grid-cols-2">
      {groups.map((g) => (
        <JoinedCard key={g._id} g={g} />
      ))}
    </div>
  );
}

function JoinedCard({ g }: { g: Joined }) {
  const leave = useM(api.groups.leave);
  return (
    <Card className="flex flex-col gap-4 rounded-xl border border-divider p-4">
      <Link to="/groups/$groupId" params={groupParams(g)} className="flex items-center gap-3">
        <Avatar src={g.cover} size={80} square />
        <span className="min-w-0">
          <span className="line-clamp-2 font-semibold text-[17px] text-primary leading-[22px] hover:underline">
            {g.name}
          </span>
          <span className="mt-0.5 block text-[13px] text-secondary">
            {g.lastVisitedAt
              ? `You last visited ${relativeAgo(g.lastVisitedAt)}`
              : `You joined ${relativeAgo(g.joinedAt)}`}
          </span>
        </span>
      </Link>
      <div className="flex gap-2">
        <Link
          to="/groups/$groupId"
          params={groupParams(g)}
          className="flex h-9 flex-1 items-center justify-center rounded-md bg-btn-soft font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125"
        >
          View group
        </Link>
        <Menu modal={false}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="More options"
              className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
                <circle cx="4" cy="10" r="2" />
                <circle cx="10" cy="10" r="2" />
                <circle cx="16" cy="10" r="2" />
              </svg>
            </button>
          </MenuTrigger>
          <MenuContent width={280}>
            <MenuItem
              icon={<LeaveGlyph size={20} />}
              label="Leave group"
              onSelect={() => void leave({ groupId: g._id })}
            />
          </MenuContent>
        </Menu>
      </div>
    </Card>
  );
}

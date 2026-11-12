import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CloseGlyph } from "./icons";
import { membersLabel } from "./util";

export type DiscoverData = FunctionReturnType<typeof api.groups.discover>;
export type GroupCardData = DiscoverData["suggested"][number];

/** Discover card: cover, name, "41K members • 10+ posts a day", friends, Join group. */
export function GroupCard({ group, onHide }: { group: GroupCardData; onHide?: () => void }) {
  const join = useM(api.groups.join);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const to = { to: "/groups/$groupId", params: groupParams(group) } as const;
  // The friends line sits inside the 24px gap above the button, so every card
  // in a row keeps Facebook's plain-card height (2 + 16 + 6 = 24).
  const gap = group.friendCount > 0 ? "mt-1.5" : "mt-6";

  return (
    <div
      onClick={() => void navigate(to)}
      className="relative flex w-[312px] shrink-0 cursor-pointer flex-col self-start overflow-hidden rounded-xl border border-divider bg-card shadow-base"
    >
      <div className="relative h-[175px] w-full shrink-0 border-divider border-b">
        <img src={group.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {onHide && (
          <Tooltip content="Hide this group">
            <button
              type="button"
              aria-label="Hide this group"
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              // A mostly opaque mid-grey: reads like Facebook's 40% black on light
              // covers and still shows as a grey circle on dark ones.
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(96_96_96/0.7)] text-white hover:bg-[rgb(80_80_80/0.8)]"
            >
              <CloseGlyph size={20} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-col px-4 pt-3 pb-4">
        <Link
          {...to}
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-2 font-semibold text-[17px] text-primary leading-[22px] hover:underline"
        >
          {group.name}
        </Link>
        <p className="text-[15px] text-secondary leading-5">
          {membersLabel(group.memberCount)} • {group.activity}
        </p>
        {group.friendCount > 0 && (
          <div className="mt-0.5 flex h-4 items-center gap-1.5">
            <span className="flex shrink-0">
              {group.friends.map((f, i) => (
                <Avatar
                  key={f._id}
                  src={f.avatar}
                  size={16}
                  className={cn("rounded-full ring-2 ring-card", i > 0 && "-ml-1")}
                />
              ))}
            </span>
            <span className="min-w-0 truncate text-[13px] text-secondary leading-4">
              {friendLine(
                group.friends.map((f) => f.firstName),
                group.friendCount,
              )}
            </span>
          </div>
        )}
        {group.viewerJoined ? (
          <Link
            {...to}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-md bg-btn-soft font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125",
              gap,
            )}
          >
            View group
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              setBusy(true);
              void join({ groupId: group._id }).finally(() => setBusy(false));
            }}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 disabled:opacity-60 dark:hover:brightness-125",
              gap,
            )}
          >
            Join group
          </button>
        )}
      </div>
    </div>
  );
}

/** "Priya is a member", "Priya and Derek are members", "Priya and 3 other friends are members". */
export function friendLine(names: string[], count: number) {
  if (count === 0 || names.length === 0) return "";
  if (count === 1) return `${names[0]} is a member`;
  if (count === 2 && names.length >= 2) return `${names[0]} and ${names[1]} are members`;
  const others = count - 1;
  return `${names[0]} and ${others} other ${others === 1 ? "friend is a member" : "friends are members"}`;
}

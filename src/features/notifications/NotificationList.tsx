import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Monitor, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { DotsIcon } from "@/features/posts/icons";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { NotificationRow } from "./NotificationRow";
import type { NotificationView } from "./types";

const PAGE = 15;

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 font-semibold text-[15px] transition-colors",
        active ? "bg-btn-soft text-btn-soft-text" : "text-primary hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

function SectionHeader({ title, seeAll }: { title: string; seeAll?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-0.5">
      <h3 className="font-semibold text-[17px] text-primary leading-5">{title}</h3>
      {seeAll && (
        <Link
          to="/notifications"
          onClick={seeAll}
          className="-mr-2 rounded-md px-2 text-[17px] text-link leading-5 hover:bg-hover"
        >
          See all
        </Link>
      )}
    </div>
  );
}

function EmptyNotifications({ unread }: { unread: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-10 text-center">
      <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden>
        <circle cx="56" cy="56" r="56" fill="var(--secondary-button)" />
        <path
          fill="var(--secondary-icon)"
          d="M56 26c-12 0-21 9.4-21 21.4v12.3l-5.4 9A3.4 3.4 0 0 0 32.5 74h47a3.4 3.4 0 0 0 2.9-5.3l-5.4-9V47.4C77 35.4 68 26 56 26Zm-8.5 52a8.5 8.5 0 0 0 17 0h-17Z"
        />
      </svg>
      <p className="mt-4 font-bold text-[20px] text-secondary leading-6">
        {unread ? "You have no unread notifications" : "You have no notifications"}
      </p>
    </div>
  );
}

/**
 * Notifications panel body, shared by the bell dropdown and /notifications.
 * Like Facebook, opening it clears the red badge; items newer than the
 * previous visit show under "New", the rest under "Earlier".
 */
export function NotificationList({
  variant,
  onNavigate,
}: {
  variant: "dropdown" | "page";
  onNavigate?: () => void;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const live = useQ(api.notifications.list, { unreadOnly, limit });
  // Keep showing the previous page while "See previous notifications" loads.
  const last = useRef<{ unreadOnly: boolean; data: typeof live }>(null);
  if (live) last.current = { unreadOnly, data: live };
  const data = live ?? (last.current?.unreadOnly === unreadOnly ? last.current.data : undefined);
  const markAllSeen = useM(api.notifications.markAllSeen);
  const markAllRead = useM(api.notifications.markAllRead);
  const navigate = useNavigate();

  const items = data?.items;
  const seenAt = data?.seenAt;
  // "New" is relative to the previous visit, frozen when the panel opens, so
  // what arrived since stays under New while it is open.
  const [since, setSince] = useState<number | null>(null);
  if (since === null && seenAt !== undefined) setSince(seenAt);
  useEffect(() => {
    // Clear the badge on open, and again for anything that arrives while open.
    if (items && seenAt !== undefined && items.some((n) => n.createdAt > seenAt))
      void markAllSeen({});
  }, [items, seenAt, markAllSeen]);

  const [newer, earlier] = useMemo(() => {
    const a: NotificationView[] = [];
    const b: NotificationView[] = [];
    for (const n of items ?? []) (since !== null && n.createdAt > since ? a : b).push(n);
    return [a, b];
  }, [items, since]);

  const page = variant === "page";

  return (
    <div className="flex flex-col pb-2">
      {/* Title, actions and filter pills stay put while the dropdown's list scrolls. */}
      <div className={cn(!page && "sticky top-0 z-10 bg-popover pb-0.5")}>
        <div className="flex items-center justify-between px-4 pt-[15px]">
          <h1 className="font-bold text-[24px] text-primary leading-7">Notifications</h1>
          <Menu modal={false}>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="Notification Actions"
                className="flex h-8 w-8 items-center justify-center rounded-full text-icon-secondary transition-colors hover:bg-hover data-[state=open]:bg-hover"
              >
                <DotsIcon size={16} />
              </button>
            </MenuTrigger>
            <MenuContent arrow>
              <MenuItem
                icon={<Check size={20} strokeWidth={2.2} />}
                label="Mark all as read"
                onSelect={() => void markAllRead({})}
              />
              <MenuItem
                icon={<Settings size={20} strokeWidth={2} />}
                label="Notification settings"
                onSelect={() => {
                  onNavigate?.();
                  void navigate({ to: "/settings" });
                }}
              />
              {!page && (
                <MenuItem
                  icon={<Monitor size={20} strokeWidth={2} />}
                  label="Open Notifications"
                  onSelect={() => {
                    onNavigate?.();
                    void navigate({ to: "/notifications" });
                  }}
                />
              )}
            </MenuContent>
          </Menu>
        </div>

        <div className="flex gap-2 px-4 pt-1">
          <Pill active={!unreadOnly} onClick={() => setUnreadOnly(false)}>
            All
          </Pill>
          <Pill active={unreadOnly} onClick={() => setUnreadOnly(true)}>
            Unread
          </Pill>
        </div>
      </div>

      {!items ? (
        <div className="flex flex-col gap-2 px-4 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyNotifications unread={unreadOnly} />
      ) : (
        <>
          {newer.length > 0 && (
            <section>
              <SectionHeader title="New" seeAll={page ? undefined : onNavigate} />
              {newer.map((n) => (
                <NotificationRow key={n._id} n={n} wide={page} onNavigate={onNavigate} />
              ))}
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <SectionHeader
                title="Earlier"
                seeAll={page || newer.length > 0 ? undefined : onNavigate}
              />
              {earlier.map((n) => (
                <NotificationRow key={n._id} n={n} wide={page} onNavigate={onNavigate} />
              ))}
            </section>
          )}
          {data?.hasMore && (
            <div className="px-4 pt-2 pb-2">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="h-9 w-full rounded-md bg-btn font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 dark:hover:brightness-125"
              >
                See previous notifications
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

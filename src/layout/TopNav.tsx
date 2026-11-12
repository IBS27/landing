import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { MessengerDropdown } from "@/features/messenger/MessengerDropdown";
import { NotificationsDropdown } from "@/features/notifications/NotificationsDropdown";
import { SearchBox } from "@/features/search/SearchBox";
import { FacebookLogo, FriendsIcon, GamingIcon, GroupsIcon, HomeIcon, VideoIcon } from "@/icons";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { AccountMenu } from "./AccountMenu";
import { MenuDropdown } from "./MenuDropdown";

type Tab = {
  to: string;
  label: string;
  Icon: ComponentType<{ active?: boolean; size?: number }>;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", Icon: HomeIcon, match: (p) => p === "/" },
  { to: "/friends", label: "Friends", Icon: FriendsIcon, match: (p) => p.startsWith("/friends") },
  {
    to: "/reel",
    label: "Reels",
    Icon: VideoIcon,
    match: (p) => p.startsWith("/watch") || p.startsWith("/reel"),
  },
  { to: "/groups/feed", label: "Groups", Icon: GroupsIcon, match: (p) => p.startsWith("/groups") },
  { to: "/gaming", label: "Gaming", Icon: GamingIcon, match: (p) => p.startsWith("/gaming") },
];

/** Facebook shrinks the header search to an icon on these sections. */
const COLLAPSED_SEARCH = ["/groups", "/gaming", "/messages"];

export function TopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center bg-nav shadow-[0_1px_2px_var(--shadow-1)] dark:shadow-[0_1px_0_var(--divider)]">
      <div className="flex w-[320px] shrink-0 items-center gap-2 pl-4">
        <Link to="/" aria-label="Facebook" className="shrink-0">
          <FacebookLogo size={40} />
        </Link>
        <SearchBox collapsed={COLLAPSED_SEARCH.some((prefix) => path.startsWith(prefix))} />
      </div>

      <nav aria-label="Facebook" className="flex h-full min-w-0 flex-1 justify-center">
        <ul className="flex h-full w-full max-w-[680px] items-stretch">
          {TABS.map(({ to, label, Icon, match }) => {
            const active = match(path);
            return (
              <li key={to} className="relative flex flex-1 px-1 py-1">
                <Tooltip content={label}>
                  <Link
                    to={to}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg transition-colors",
                      active ? "text-fb" : "text-icon-secondary hover:bg-hover",
                    )}
                  >
                    <Icon active={active} size={24} />
                  </Link>
                </Tooltip>
                {active && (
                  <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-t-sm bg-fb" />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex w-[320px] shrink-0 items-center justify-end gap-2 pr-4">
        <MenuDropdown />
        <MessengerDropdown />
        <NotificationsDropdown />
        <AccountMenu />
      </div>
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { MessengerDropdown } from "@/features/messenger/MessengerDropdown";
import { NotificationsDropdown } from "@/features/notifications/NotificationsDropdown";
import { SearchBox } from "@/features/search/SearchBox";
import {
  FacebookLogo,
  FriendsIcon,
  GamingIcon,
  GroupsIcon,
  HomeIcon,
  ReelsIcon,
  VideoIcon,
} from "@/icons";
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

/** Groups' own section pages (a single group page leaves the Groups tab idle). */
const GROUPS_SECTION = /^\/groups(\/(feed|discover|joins|create))?\/?$/;

const TABS: Tab[] = [
  { to: "/", label: "Home", Icon: HomeIcon, match: (p) => p === "/" },
  { to: "/friends", label: "Friends", Icon: FriendsIcon, match: (p) => p.startsWith("/friends") },
  {
    to: "/reel",
    label: "Reels",
    Icon: ReelsIcon,
    // The single-reel viewer (/reel/<id>) leaves every tab idle.
    match: (p) => /^\/reel\/?$/.test(p),
  },
  { to: "/groups/feed", label: "Groups", Icon: GroupsIcon, match: (p) => GROUPS_SECTION.test(p) },
  { to: "/gaming", label: "Gaming", Icon: GamingIcon, match: (p) => p.startsWith("/gaming") },
];

/** On Video (/watch) Facebook's third tab becomes Video instead of Reels. */
const VIDEO_TAB: Tab = {
  to: "/watch",
  label: "Video",
  Icon: VideoIcon,
  match: (p) => p.startsWith("/watch"),
};

const tabsFor = (path: string) =>
  VIDEO_TAB.match(path) ? TABS.map((t) => (t.to === "/reel" ? VIDEO_TAB : t)) : TABS;

/** Facebook shrinks the header search to a round icon on these sections. */
const collapsedSearch = (p: string) =>
  GROUPS_SECTION.test(p) ||
  p.startsWith("/marketplace") ||
  p.startsWith("/gaming") ||
  p.startsWith("/messages");

/** Facebook drops the Messenger button where Messenger (or a listing composer) fills the page. */
const hideMessenger = (p: string) =>
  p.startsWith("/messages") || p.startsWith("/marketplace/create/");

export function TopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center bg-nav shadow-[0_1px_2px_var(--shadow-1)] dark:shadow-[0_1px_0_var(--divider)]">
      <div className="flex w-[320px] shrink-0 items-center gap-2 pl-4">
        <Link to="/" aria-label="Facebook" className="shrink-0">
          <FacebookLogo size={40} />
        </Link>
        <SearchBox collapsed={collapsedSearch(path)} wide={path !== "/"} />
      </div>

      <nav aria-label="Facebook" className="flex h-full min-w-0 flex-1 justify-center">
        <ul className="flex h-full w-full max-w-[680px] items-stretch gap-[7.5px]">
          {tabsFor(path).map(({ to, label, Icon, match }, i) => {
            const active = match(path);
            return (
              <li key={i} className="relative flex flex-1 py-1">
                <Tooltip content={label}>
                  <Link
                    to={to}
                    aria-label={label}
                    // Our `match` decides the active tab, not the router's prefix matching.
                    activeOptions={{ exact: true }}
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
                  <span className="absolute inset-x-0.5 bottom-0 h-[3px] rounded-t-[1px] bg-fb" />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex w-[320px] shrink-0 items-center justify-end gap-2 pr-4">
        <MenuDropdown />
        {!hideMessenger(path) && <MessengerDropdown />}
        <NotificationsDropdown />
        <AccountMenu />
      </div>
    </header>
  );
}

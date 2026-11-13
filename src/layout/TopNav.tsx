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
  MarketplaceIcon,
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

const HOME: Tab = { to: "/", label: "Home", Icon: HomeIcon, match: (p) => p === "/" };
const FRIENDS: Tab = {
  to: "/friends",
  label: "Friends",
  Icon: FriendsIcon,
  match: (p) => p.startsWith("/friends"),
};
const GROUPS: Tab = {
  to: "/groups/feed",
  label: "Groups",
  Icon: GroupsIcon,
  match: (p) => GROUPS_SECTION.test(p),
};

const TABS: Tab[] = [
  HOME,
  FRIENDS,
  {
    to: "/reel",
    label: "Reels",
    Icon: ReelsIcon,
    // The single-reel viewer (/reel/<id>) leaves every tab idle.
    match: (p) => /^\/reel\/?$/.test(p),
  },
  GROUPS,
  { to: "/gaming", label: "Gaming", Icon: GamingIcon, match: (p) => p.startsWith("/gaming") },
];

/** On Video (/watch) Facebook's third tab becomes Video instead of Reels. */
const VIDEO_TAB: Tab = {
  to: "/watch",
  label: "Video",
  Icon: VideoIcon,
  match: (p) => p.startsWith("/watch"),
};

/** On Settings & privacy Facebook swaps in its own set (none of them active there). */
const SETTINGS_TABS: Tab[] = [
  HOME,
  FRIENDS,
  VIDEO_TAB,
  {
    to: "/marketplace",
    label: "Marketplace",
    Icon: MarketplaceIcon,
    match: (p) => p.startsWith("/marketplace"),
  },
  GROUPS,
];

const tabsFor = (path: string) => {
  if (path.startsWith("/settings")) return SETTINGS_TABS;
  if (VIDEO_TAB.match(path)) return TABS.map((t) => (t.to === "/reel" ? VIDEO_TAB : t));
  return TABS;
};

/** Facebook shrinks the header search to a round icon on these sections. */
const collapsedSearch = (p: string) =>
  GROUPS_SECTION.test(p) ||
  p.startsWith("/marketplace") ||
  p.startsWith("/gaming") ||
  p.startsWith("/messages");

/** Facebook drops the Messenger button where Messenger (or a listing composer) fills the page. */
const hideMessenger = (p: string) =>
  p.startsWith("/messages") || p.startsWith("/marketplace/create/");

/**
 * Facebook's header: logo and search, the section tabs, then Menu … Account.
 * From 1024px the side clusters are 320px each; narrower, they shrink to their
 * contents (search becomes the round icon), and below 768px the tabs give way
 * so the right cluster stays on screen.
 */
export function TopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center bg-nav shadow-[0_1px_2px_var(--shadow-1)] dark:shadow-[0_1px_0_var(--divider)]">
      <div className="flex shrink-0 items-center gap-2 pl-4 lg:w-[320px]">
        <Link to="/" aria-label="Facebook" className="shrink-0">
          <FacebookLogo size={40} />
        </Link>
        <SearchBox collapsed={collapsedSearch(path)} wide={path !== "/"} />
      </div>

      <nav aria-label="Facebook" className="hidden h-full min-w-0 flex-1 justify-center md:flex">
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

      <div className="ml-auto flex shrink-0 items-center justify-end gap-2 pr-4 lg:w-[320px]">
        <MenuDropdown />
        {!hideMessenger(path) && <MessengerDropdown />}
        <NotificationsDropdown />
        <AccountMenu />
      </div>
    </header>
  );
}

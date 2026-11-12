import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Settings } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/format";
import {
  FriendRequestsGlyph,
  FriendsHomeGlyph,
  GiftGlyph,
  PersonListGlyph,
  PersonPlusGlyph,
} from "./icons";

type Item = {
  key: string;
  label: string;
  to: string;
  Icon: ComponentType<{ size?: number }>;
  chevron: boolean;
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", to: "/friends", Icon: FriendsHomeGlyph, chevron: false },
  {
    key: "requests",
    label: "Friend requests",
    to: "/friends/requests",
    Icon: FriendRequestsGlyph,
    chevron: true,
  },
  {
    key: "suggestions",
    label: "Suggestions",
    to: "/friends/suggestions",
    Icon: PersonPlusGlyph,
    chevron: true,
  },
  { key: "list", label: "All friends", to: "/friends/list", Icon: PersonListGlyph, chevron: true },
  {
    key: "birthdays",
    label: "Birthdays",
    to: "/events/birthdays",
    Icon: GiftGlyph,
    chevron: false,
  },
  {
    key: "lists",
    label: "Custom lists",
    to: "/friends/lists",
    Icon: PersonListGlyph,
    chevron: true,
  },
];

const RAIL =
  "sticky top-14 flex h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col overflow-y-auto bg-card shadow-[1px_0_0_var(--divider-soft)] max-[899px]:hidden";

/** The Friends home sidebar: title, settings gear and the six nav rows. */
export function FriendsHomeRail() {
  return (
    <nav aria-label="Friends" className={RAIL}>
      <div className="flex items-center justify-between px-4 pt-[11px] pb-[9px]">
        <h1 className="font-bold text-[24px] text-primary leading-7">Friends</h1>
        <Link
          to="/settings"
          aria-label="Edit notification settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          <Settings size={20} strokeWidth={2.2} />
        </Link>
      </div>
      <ul className="flex flex-col px-0 pb-4">
        {ITEMS.map((it) => (
          <li key={it.key} className="px-0">
            <Link
              to={it.to}
              activeOptions={{ exact: true }}
              className="group flex h-14 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-hover data-[status=active]:bg-wash"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isActive ? "bg-accent text-white" : "bg-btn text-icon",
                    )}
                  >
                    <it.Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[17px] text-primary leading-5">
                    {it.label}
                  </span>
                  {it.chevron && (
                    <ChevronRight size={22} strokeWidth={2} className="mr-1 text-secondary" />
                  )}
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Sub-page sidebar: back arrow, "Friends" breadcrumb and the page title above a list. */
export function FriendsSubRail({
  title,
  children,
  header,
}: {
  title: string;
  /** Rendered under the title (search box, section heading…). */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <nav aria-label={title} className={RAIL}>
      <div className="flex items-start gap-3 px-4 pt-3">
        <Link
          to="/friends"
          aria-label="Back"
          className="-ml-2 mt-[11px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-hover"
        >
          <ArrowLeft size={20} strokeWidth={2.2} className="text-secondary" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/friends" className="font-semibold text-[13px] text-secondary hover:underline">
            Friends
          </Link>
          <h1 className="font-bold text-[24px] text-primary leading-7">{title}</h1>
        </div>
      </div>
      {header}
      <div className="flex flex-col px-2 pb-4">{children}</div>
    </nav>
  );
}

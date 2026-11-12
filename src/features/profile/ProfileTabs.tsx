import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@/features/posts/icons";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Avatar } from "@/ui/primitives";
import { columnPad, useProfile } from "./context";

export type SectionKey = "checkins" | "groups" | "likes" | "followers";

type Tab =
  | {
      label: string;
      kind: "route";
      to:
        | "/$username"
        | "/$username/about"
        | "/$username/friends"
        | "/$username/photos"
        | "/$username/reels";
    }
  | { label: string; kind: "section"; section: SectionKey };

const PERSON_TABS: Tab[] = [
  { label: "All", kind: "route", to: "/$username" },
  { label: "About", kind: "route", to: "/$username/about" },
  { label: "Friends", kind: "route", to: "/$username/friends" },
  { label: "Photos", kind: "route", to: "/$username/photos" },
  { label: "Reels", kind: "route", to: "/$username/reels" },
];
const PERSON_MORE: Tab[] = [
  { label: "Check-ins", kind: "section", section: "checkins" },
  { label: "Groups", kind: "section", section: "groups" },
  { label: "Likes", kind: "section", section: "likes" },
];
const PAGE_TABS: Tab[] = [
  { label: "All", kind: "route", to: "/$username" },
  { label: "About", kind: "route", to: "/$username/about" },
  { label: "Reels", kind: "route", to: "/$username/reels" },
  { label: "Photos", kind: "route", to: "/$username/photos" },
  { label: "Followers", kind: "section", section: "followers" },
];
const PAGE_MORE: Tab[] = [{ label: "Check-ins", kind: "section", section: "checkins" }];

function tabPath(username: string, t: Tab) {
  if (t.kind === "section") return `/${username}/${t.section}`;
  return t.to === "/$username" ? `/${username}` : t.to.replace("$username", username);
}

/**
 * The 60px profile tab bar. It sticks under the header; once stuck it swaps
 * the tabs for the person's avatar and name, like Facebook.
 */
export function ProfileTabs() {
  const { profile, embedded } = useProfile();
  const { user, isPage } = profile;
  const path = useRouterState({ select: (s) => decodeURIComponent(s.location.pathname) });
  const tabs = isPage ? PAGE_TABS : PERSON_TABS;
  const more = isPage ? PAGE_MORE : PERSON_MORE;
  const isActive = (t: Tab) => {
    const p = tabPath(user.username, t);
    return path === p || path === `${p}/`;
  };
  const moreActive = more.some(isActive);

  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 56),
      {
        rootMargin: "-56px 0px 0px 0px",
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-0" />
      <div className="sticky top-14 z-20 bg-card shadow-[0_1px_2px_var(--shadow-1)]">
        <div
          className={cn(
            "mx-auto flex h-[60px] w-full max-w-[1186px] items-center justify-between",
            columnPad(embedded),
          )}
        >
          {stuck ? (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-3 rounded-lg px-4 py-1.5 transition-colors hover:bg-hover"
            >
              <Avatar src={user.avatar} size={40} />
              <span className="font-semibold text-[17px] text-primary">{user.name}</span>
            </button>
          ) : (
            <nav aria-label="Profile tabs" className="flex h-full items-stretch">
              {tabs.map((t) => (
                <TabLink key={t.label} tab={t} active={isActive(t)} />
              ))}
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "group relative flex h-full items-center outline-none",
                      moreActive ? "text-link" : "text-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-12 items-center gap-1 rounded-md px-4 font-semibold text-[15px] transition-colors",
                        !moreActive && "group-hover:bg-hover",
                      )}
                    >
                      More
                      <CaretDown size={12} />
                    </span>
                    {moreActive && <ActiveBar />}
                  </button>
                </MenuTrigger>
                <MenuContent width={220} align="start">
                  {more.map((t) => (
                    <Link
                      key={t.label}
                      to="/$username/$section"
                      params={{
                        username: user.username,
                        section: t.kind === "section" ? t.section : "",
                      }}
                    >
                      <MenuItem label={t.label} />
                    </Link>
                  ))}
                </MenuContent>
              </Menu>
            </nav>
          )}
          <ProfileMoreMenu />
        </div>
      </div>
    </>
  );
}

function ActiveBar() {
  return <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-[1px] bg-fb" />;
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const { profile } = useProfile();
  const username = profile.user.username;
  const cls = cn(
    "group relative flex h-full items-center",
    active ? "text-link" : "text-secondary",
  );
  const inner = (
    <>
      <span
        className={cn(
          "flex h-12 items-center rounded-md px-4 font-semibold text-[15px] transition-colors",
          !active && "group-hover:bg-hover",
        )}
      >
        {tab.label}
      </span>
      {active && <ActiveBar />}
    </>
  );
  if (tab.kind === "section")
    return (
      <Link
        to="/$username/$section"
        params={{ username, section: tab.section }}
        className={cls}
        aria-current={active ? "page" : undefined}
      >
        {inner}
      </Link>
    );
  return (
    <Link
      to={tab.to}
      params={{ username }}
      className={cls}
      aria-current={active ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}

/** The "…" button at the right end of the tab bar. */
function ProfileMoreMenu() {
  const { profile } = useProfile();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/${profile.user.username}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Profile settings see more options"
          className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          <MoreHorizontal size={20} strokeWidth={2.4} />
        </button>
      </MenuTrigger>
      <MenuContent width={344}>
        <MenuItem label={copied ? "Link copied" : "Copy link to profile"} onSelect={copy} />
        {profile.isSelf && (
          <>
            <Link to="/settings">
              <MenuItem label="Profile and tagging settings" />
            </Link>
            <Link to="/settings">
              <MenuItem label="Activity log" />
            </Link>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

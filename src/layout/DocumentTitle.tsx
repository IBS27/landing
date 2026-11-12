import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";
import { useQ } from "@/app/viewer";
import { api } from "../../convex/_generated/api";

/* A page can register a specific title (a group's name, a search query). */
let registered: string | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** Set the tab title for the current page, e.g. "UW Housing" → "UW Housing | Facebook". */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    registered = title;
    emit();
    return () => {
      if (registered === title) {
        registered = null;
        emit();
      }
    };
  }, [title]);
}

const SECTIONS: [prefix: string, title: string][] = [
  ["/friends", "Friends"],
  ["/watch", "Video"],
  ["/reel", "Reels"],
  ["/groups", "Groups"],
  ["/gaming", "Gaming"],
  ["/marketplace", "Marketplace"],
  ["/messages", "Messenger"],
  ["/events", "Events"],
  ["/notifications", "Notifications"],
  ["/saved", "Saved"],
  ["/memories", "Memories"],
  ["/settings", "Settings & privacy"],
  ["/pages", "Pages"],
  ["/feeds", "Feeds"],
  ["/bookmarks", "Menu"],
  ["/live", "Live Producer"],
  ["/meta-ai", "Meta AI"],
  ["/ads-manager", "Ads Manager"],
  ["/stories", "Stories"],
];

/** Top-level paths that are not profile usernames. */
const RESERVED = new Set([
  "search",
  "photo",
  "policies",
  "me",
  "climate",
  "fundraisers",
  "ads",
  "call",
  "video",
  "reels",
]);

/**
 * Facebook's tab title: "(N) <Page> | Facebook", where N counts unseen
 * notifications plus unread chats.
 */
export function DocumentTitle() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const page = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => registered,
  );
  const notifications = useQ(api.notifications.unseenCount, {}) ?? 0;
  const chats = useQ(api.messenger.unreadCount, {}) ?? 0;

  const first = path.split("/")[1] ?? "";
  const section = SECTIONS.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1];
  const username = !section && first && !RESERVED.has(first) ? first : null;
  const profile = useQuery(api.users.byUsername, username ? { username } : "skip");

  const base = page ?? section ?? profile?.name ?? null;
  const count = notifications + chats;
  const title = `${count > 0 ? `(${count}) ` : ""}${base ? `${base} | Facebook` : "Facebook"}`;

  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

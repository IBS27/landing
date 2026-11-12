import { useCallback, useEffect, useState } from "react";
import { useViewerContext } from "@/app/viewer";

/**
 * Recent searches, kept per viewer in localStorage (Facebook keeps them in
 * the activity log). A query or a picked entity (person, Page, group, event).
 */
export type RecentSearch =
  | { kind: "query"; q: string }
  | {
      kind: "person" | "page" | "group" | "event";
      id: string;
      key: string;
      title: string;
      image: string;
    };

const MAX = 12;
const EVENT = "fb-clone:recent-searches";

function storageKey(viewerId: string) {
  return `fb-clone:recent-searches:${viewerId}`;
}

function read(viewerId: string | null): RecentSearch[] {
  if (!viewerId) return [];
  try {
    const raw = localStorage.getItem(storageKey(viewerId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

function write(viewerId: string, items: RecentSearch[]) {
  try {
    localStorage.setItem(storageKey(viewerId), JSON.stringify(items.slice(0, MAX)));
  } catch {
    // Storage can be unavailable (private mode); recents just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

const same = (a: RecentSearch, b: RecentSearch) =>
  a.kind === "query" && b.kind === "query"
    ? a.q.toLowerCase() === b.q.toLowerCase()
    : a.kind !== "query" && b.kind !== "query" && a.kind === b.kind && a.id === b.id;

export function useRecentSearches() {
  const { viewerId } = useViewerContext();
  const [items, setItems] = useState<RecentSearch[]>(() => read(viewerId));

  useEffect(() => {
    const sync = () => setItems(read(viewerId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [viewerId]);

  const add = useCallback(
    (item: RecentSearch) => {
      if (!viewerId) return;
      write(viewerId, [item, ...read(viewerId).filter((x) => !same(x, item))]);
    },
    [viewerId],
  );
  const remove = useCallback(
    (item: RecentSearch) => {
      if (!viewerId) return;
      write(
        viewerId,
        read(viewerId).filter((x) => !same(x, item)),
      );
    },
    [viewerId],
  );
  const clear = useCallback(() => {
    if (viewerId) write(viewerId, []);
  }, [viewerId]);

  return { items, add, remove, clear };
}

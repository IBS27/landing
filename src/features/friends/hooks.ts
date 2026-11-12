import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useM, useViewer } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/* ---------------- Removed suggestions (kept on this device, like FB's "Remove") ---------------- */

const KEY = "fb-clone:removedSuggestions";
const listeners = new Set<() => void>();
let cache: Record<string, string[]> | null = null;

function read(): Record<string, string[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string[]>;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, string[]>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the removal still applies for this session.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** People the viewer removed from "People you may know" on this device. */
export function useRemovedSuggestions() {
  const viewer = useViewer();
  const all = useSyncExternalStore(subscribe, read, read);
  const removed = useMemo(() => new Set(all[viewer._id] ?? []), [all, viewer._id]);
  const remove = useCallback(
    (id: Id<"users">) => {
      const cur = read();
      write({ ...cur, [viewer._id]: [...new Set([...(cur[viewer._id] ?? []), id])] });
    },
    [viewer._id],
  );
  return { removed, remove };
}

/* ---------------- Friend mutations ---------------- */

export function useFriendActions() {
  const send = useM(api.friends.sendRequest);
  const cancel = useM(api.friends.cancelRequest);
  const accept = useM(api.friends.acceptRequest);
  const decline = useM(api.friends.declineRequest);
  const unfriend = useM(api.friends.unfriend);
  return useMemo(
    () => ({
      add: (userId: Id<"users">) => send({ userId }),
      cancel: (userId: Id<"users">) => cancel({ userId }),
      confirm: (userId: Id<"users">) => accept({ userId }),
      decline: (userId: Id<"users">) => decline({ userId }),
      unfriend: (userId: Id<"users">) => unfriend({ userId }),
    }),
    [send, cancel, accept, decline, unfriend],
  );
}

/**
 * Cards Facebook keeps on screen after you act on them ("Request sent",
 * "Request accepted") even though the live list no longer includes them.
 */
export type Outcome = "sent" | "accepted" | "deleted" | "cancelled";

export function useOutcomes() {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const set = useCallback(
    (id: string, o: Outcome | null) =>
      setOutcomes((cur) => {
        const next = { ...cur };
        if (o) next[id] = o;
        else delete next[id];
        return next;
      }),
    [],
  );
  return [outcomes, set] as const;
}

/**
 * Keeps items that left the live list (after the viewer acted on them) at
 * their last position, so the card can show its outcome ("Request sent").
 */
export function useSticky<T extends { _id: string }>(live: T[] | undefined, keep: Set<string>) {
  const last = useRef(new Map<string, { item: T; index: number }>());
  return useMemo(() => {
    if (!live) return undefined;
    const liveIds = new Set(live.map((x) => x._id));
    const kept = [...keep]
      .filter((id) => !liveIds.has(id))
      .map((id) => last.current.get(id))
      .filter((x): x is { item: T; index: number } => !!x)
      .sort((a, b) => a.index - b.index);
    const out = [...live];
    for (const k of kept) out.splice(Math.min(k.index, out.length), 0, k.item);
    out.forEach((item, index) => {
      last.current.set(item._id, { item, index });
    });
    return out;
  }, [live, keep]);
}

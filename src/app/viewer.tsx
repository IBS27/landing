import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const STORAGE_KEY = "fb-clone:viewerId";

type ViewerContextValue = {
  viewerId: Id<"users"> | null;
  viewer: Doc<"users"> | null | undefined;
  switchTo: (id: Id<"users">) => void;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

function readStored(): Id<"users"> | null {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Id<"users"> | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * The signed-in identity is one of the seeded demo personas, switchable from
 * the account menu. Swapping in real auth later only touches this provider.
 */
export function ViewerProvider({ children }: { children: ReactNode }) {
  const personas = useQuery(api.users.personas);
  const [stored, setStored] = useState<Id<"users"> | null>(readStored);

  const viewerId = useMemo(() => {
    if (!personas || personas.length === 0) return null;
    if (stored && personas.some((p) => p._id === stored)) return stored;
    return personas[0]._id;
  }, [personas, stored]);

  const viewer = useQuery(api.users.me, viewerId ? { viewerId } : "skip");

  const switchTo = useCallback((id: Id<"users">) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage can be unavailable (private mode); the switch still applies for this tab.
    }
    setStored(id);
  }, []);

  const heartbeat = useMutation(api.users.heartbeat);
  useEffect(() => {
    if (!viewerId) return;
    const beat = () => void heartbeat({ viewerId }).catch(() => {});
    beat();
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
  }, [viewerId, heartbeat]);

  const value = useMemo(
    () => ({
      viewerId,
      viewer: viewerId ? viewer : personas === undefined ? undefined : null,
      switchTo,
    }),
    [viewerId, viewer, personas, switchTo],
  );
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerContext() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewerContext must be used inside ViewerProvider");
  return ctx;
}

/** The current viewer document. Only call below <RequireViewer>, where it is guaranteed. */
export function useViewer(): Doc<"users"> {
  const { viewer } = useViewerContext();
  if (!viewer) throw new Error("useViewer called before the viewer loaded");
  return viewer;
}

type ViewerFn<T extends "query" | "mutation"> = FunctionReference<
  T,
  "public",
  { viewerId: Id<"users"> },
  unknown
>;
type ArgsWithoutViewer<F extends FunctionReference<"query" | "mutation">> = Omit<
  FunctionArgs<F>,
  "viewerId"
>;

/** `useQuery` for viewer-scoped functions; injects `viewerId`. Pass "skip" to skip. */
export function useQ<F extends ViewerFn<"query">>(
  fn: F,
  args: ArgsWithoutViewer<F> | "skip",
): FunctionReturnType<F> | undefined {
  const { viewerId } = useViewerContext();
  const full = args === "skip" || !viewerId ? "skip" : ({ ...args, viewerId } as FunctionArgs<F>);
  return useQuery(fn as FunctionReference<"query">, full) as FunctionReturnType<F> | undefined;
}

/** `useMutation` for viewer-scoped functions; injects `viewerId`. */
export function useM<F extends ViewerFn<"mutation">>(fn: F) {
  const { viewerId } = useViewerContext();
  const mutate = useMutation(fn as FunctionReference<"mutation">);
  return useCallback(
    (args: ArgsWithoutViewer<F>): Promise<FunctionReturnType<F>> => {
      if (!viewerId) return Promise.reject(new Error("No viewer"));
      return mutate({ ...args, viewerId } as FunctionArgs<F>) as Promise<FunctionReturnType<F>>;
    },
    [mutate, viewerId],
  );
}

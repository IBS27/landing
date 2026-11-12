import { type PaginatedQueryArgs, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, PaginationOptions } from "convex/server";
import { useViewerContext } from "@/app/viewer";
import type { Id } from "../../../convex/_generated/dataModel";

type PaginatedViewerFn = FunctionReference<
  "query",
  "public",
  { viewerId: Id<"users">; paginationOpts: PaginationOptions }
>;

type Args<F extends PaginatedViewerFn> = Omit<FunctionArgs<F>, "viewerId" | "paginationOpts">;

/** `usePaginatedQuery` for viewer-scoped functions; injects `viewerId`. */
export function useViewerPaginated<F extends PaginatedViewerFn>(
  fn: F,
  args: Args<F> | "skip",
  initialNumItems = 5,
) {
  const { viewerId } = useViewerContext();
  const full =
    args === "skip" || !viewerId
      ? "skip"
      : ({ ...args, viewerId } as unknown as PaginatedQueryArgs<F>);
  return usePaginatedQuery(fn, full, { initialNumItems });
}

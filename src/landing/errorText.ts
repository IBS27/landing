import { ConvexError } from "convex/values";

/**
 * What to tell the person when a Convex call fails: the message the server
 * threw with `ConvexError("…")`, else a generic line. The error's own
 * `message` is never shown: it carries the request id, "Uncaught ConvexError"
 * and a stack trace across several lines.
 */
export function errorText(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof ConvexError && typeof e.data === "string" && e.data ? e.data : fallback;
}

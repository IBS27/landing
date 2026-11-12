import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { snippet } from "./lib/citations";

const EXTERNAL_SNIPPET_MAX = 280;

/** True for absolute http(s) URLs, the only external links a citation may open. */
export function isWebUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Store a snapshot of an external page that was just fetched (DataSF, SFMTA...)
 * and return its id for a `{ kind: "external" }` source. Snapshots are never
 * updated: a refetch records a new one.
 */
export const recordExternalSource = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    publisher: v.string(),
    snippet: v.string(),
    fetchedAt: v.number(),
  },
  handler: async (ctx, a) => {
    const url = a.url.trim();
    if (!isWebUrl(url)) throw new ConvexError("External sources need an http(s) URL");
    const title = a.title.trim();
    const publisher = a.publisher.trim();
    const text = snippet(a.snippet, EXTERNAL_SNIPPET_MAX);
    if (!title || !publisher || !text)
      throw new ConvexError("External sources need a title, publisher and snippet");
    return ctx.db.insert("externalSources", {
      url,
      title,
      publisher,
      snippet: text,
      fetchedAt: a.fetchedAt,
    });
  },
});

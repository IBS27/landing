import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { snippet } from "./lib/citations";

const EXTERNAL_SNIPPET_MAX = 280;

/**
 * The canonical form of an absolute http(s) URL ("https://..."), the only
 * external links a citation may open, or null for anything else.
 */
export function webUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
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
    const url = webUrl(a.url);
    if (!url) throw new ConvexError("External sources need an http(s) URL");
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

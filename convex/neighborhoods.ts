import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { type CitedSource, type NonEmpty, resolveCitations } from "./lib/citations";
import { viewerQuery } from "./lib/functions";
import { neighborhoodSlugAt } from "./lib/neighborhoods";
import { loadAudience } from "./lib/posts";
import type { NeighborhoodFact } from "./validators";

/**
 * San Francisco neighborhoods (#15): DataSF boundaries plus cited transit,
 * nightlife and campus facts. Listings, Events and Groups point at them with
 * `neighborhoodId` (see the `by_neighborhood` indexes); helpers for server code
 * live in `convex/lib/neighborhoods.ts`.
 */

function summary(n: Doc<"neighborhoods">) {
  return {
    _id: n._id,
    slug: n.slug,
    name: n.name,
    /** What people call it ("SoMa"), else the DataSF name. */
    label: n.shortName ?? n.name,
    park: n.park ?? false,
    center: n.center,
    bbox: n.bbox,
  };
}
export type NeighborhoodSummary = ReturnType<typeof summary>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A fact as the client sees it: its sources resolved for the viewer, never raw ids. */
export type NeighborhoodFactView = DistributiveOmit<
  NeighborhoodFact,
  "citations" | "neighborhoodId"
> & { _id: Doc<"neighborhoodFacts">["_id"]; sources: NonEmpty<CitedSource> };

const KIND_ORDER: Record<NeighborhoodFact["kind"], number> = {
  transit_station: 0,
  transit_line: 1,
  transit_service: 2,
  nightlife_corridor: 3,
  campus: 4,
  streetlight_requests: 5,
};

async function bySlug(ctx: QueryCtx, slug: string) {
  return ctx.db
    .query("neighborhoods")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/** Every neighborhood, A–Z by label, without polygons. */
export const list = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("neighborhoods").collect();
    return rows.map(summary).sort((a, b) => a.label.localeCompare(b.label));
  },
});

/** Boundaries for a map's neighborhood layer (#56): `[lng, lat]` MultiPolygons, ~5 m precision. */
export const boundaries = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("neighborhoods").collect();
    return rows.map((n) => ({
      _id: n._id,
      slug: n.slug,
      label: n.shortName ?? n.name,
      park: n.park ?? false,
      center: n.center,
      polygon: n.polygon,
    }));
  },
});

/** The neighborhood a point falls in, or null outside San Francisco. */
export const at = viewerQuery({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, p) => {
    const slug = neighborhoodSlugAt(p);
    const n = slug ? await bySlug(ctx, slug) : null;
    return n ? summary(n) : null;
  },
});

/**
 * One neighborhood by slug with its facts, each with sources resolved for the
 * viewer (render with `SourcesChip`). Null for an unknown slug.
 */
export const get = viewerQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const n = await bySlug(ctx, slug);
    if (!n) return null;
    const audience = await loadAudience(ctx, ctx.viewer._id);
    const rows = await ctx.db
      .query("neighborhoodFacts")
      .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", n._id))
      .collect();
    const facts: NeighborhoodFactView[] = [];
    for (const f of rows) {
      const sources = await resolveCitations(ctx, f.citations, audience);
      if (!sources) continue;
      const { citations: _c, neighborhoodId: _n, _creationTime: _t, ...fact } = f;
      facts.push({ ...fact, sources });
    }
    facts.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
    return {
      ...summary(n),
      /** The DataSF boundary source. */
      boundarySources: await resolveCitations(ctx, n.citations, audience),
      facts,
    };
  },
});

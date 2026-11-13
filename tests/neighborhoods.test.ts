import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { MutationCtx } from "../convex/_generated/server";
import * as events from "../convex/events";
import * as groups from "../convex/groups";
import { snippet } from "../convex/lib/citations";
import {
  decodePolyline,
  distanceMeters,
  edgeDistanceMeters,
  encodePolyline,
  labelPoint,
  type MultiPolygon,
  pointInMultiPolygon,
  type Ring,
  simplifyRing,
} from "../convex/lib/geo";
import { BOUNDARIES, BOUNDARY_SOURCE } from "../convex/lib/neighborhoodBoundaries";
import {
  isNeighborhoodSlug,
  neighborhoodIdAt,
  neighborhoodShape,
  neighborhoodShapes,
  neighborhoodSlugAt,
  neighborhoodsNear,
  SF_NEIGHBORHOODS,
} from "../convex/lib/neighborhoods";
import { neighborhoods as places } from "../convex/seed/lib/places";
import { buildPlan } from "../convex/seed/plan";
import type { CommentSeed, ReplySeed } from "../convex/seed/types";
import { neighborhoodGroups } from "../convex/seed/world/neighborhoods/groups";
import { NEIGHBORHOOD_PLACES } from "../convex/seed/world/neighborhoods/places";
import { people } from "../convex/seed/world/people";
import { neighborhoodPosts } from "../convex/seed/world/posts/neighborhoods";
import { fakeCtx, type Row } from "./fakeDb";

const NOW = Date.UTC(2026, 10, 12, 20, 0, 0);
const plan = buildPlan(NOW);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ---------- Geometry ---------- */

describe("geo", () => {
  const square: Ring = [
    [-122.42, 37.76],
    [-122.41, 37.76],
    [-122.41, 37.77],
    [-122.42, 37.77],
    [-122.42, 37.76],
  ];
  const hole: Ring = [
    [-122.416, 37.764],
    [-122.414, 37.764],
    [-122.414, 37.766],
    [-122.416, 37.766],
    [-122.416, 37.764],
  ];
  const shape: MultiPolygon = [[square, hole]];

  test("point in polygon respects holes", () => {
    expect(pointInMultiPolygon({ lat: 37.762, lng: -122.418 }, shape)).toBe(true);
    expect(pointInMultiPolygon({ lat: 37.765, lng: -122.415 }, shape)).toBe(false);
    expect(pointInMultiPolygon({ lat: 37.78, lng: -122.415 }, shape)).toBe(false);
  });

  test("edge distance and great-circle distance are in meters", () => {
    // 0.001° of latitude ≈ 110.5 m.
    expect(edgeDistanceMeters({ lat: 37.771, lng: -122.415 }, shape)).toBeCloseTo(110.5, 0);
    expect(distanceMeters({ lat: 37.76, lng: -122.42 }, { lat: 37.77, lng: -122.42 })).toBeCloseTo(
      1112,
      -1,
    );
  });

  test("encoded polylines round-trip at 1e-5", () => {
    const ring: Ring = [
      [-122.51012, 37.76409],
      [-122.4153, 37.7599],
      [-122.39363, 37.79554],
      [-122.51012, 37.76409],
    ];
    expect(decodePolyline(encodePolyline(ring))).toEqual(ring);
  });

  test("simplification keeps the ring closed and drops collinear points", () => {
    const wiggly: Ring = [];
    for (let i = 0; i <= 100; i++) wiggly.push([-122.42 + i * 0.0001, 37.76]);
    wiggly.push([-122.41, 37.77], [-122.42, 37.77], [-122.42, 37.76]);
    const out = simplifyRing(wiggly, 5);
    expect(out[0]).toEqual(out[out.length - 1]);
    expect(out.length).toBeLessThan(8);
  });

  test("label points sit inside even a concave shape", () => {
    const ell: MultiPolygon = [
      [
        [
          [-122.42, 37.76],
          [-122.41, 37.76],
          [-122.41, 37.762],
          [-122.418, 37.762],
          [-122.418, 37.77],
          [-122.42, 37.77],
          [-122.42, 37.76],
        ],
      ],
    ];
    expect(pointInMultiPolygon(labelPoint(ell), ell)).toBe(true);
  });
});

/* ---------- Boundaries and lookup ---------- */

describe("neighborhood boundaries", () => {
  test("41 DataSF neighborhoods with City Profile slugs (#3)", () => {
    expect(SF_NEIGHBORHOODS).toHaveLength(41);
    expect(new Set(SF_NEIGHBORHOODS.map((n) => n.slug)).size).toBe(41);
    for (const n of SF_NEIGHBORHOODS) {
      expect(n.slug).toBe(slugify(n.name));
      expect(BOUNDARIES[n.slug]?.name).toBe(n.name);
    }
    expect(Object.keys(BOUNDARIES).sort()).toEqual(SF_NEIGHBORHOODS.map((n) => n.slug).sort());
    expect(isNeighborhoodSlug("mission")).toBe(true);
    expect(isNeighborhoodSlug("dogpatch")).toBe(false);
  });

  test("shapes fit Convex limits and centers sit inside", () => {
    for (const s of neighborhoodShapes()) {
      expect(pointInMultiPolygon(s.center, s.polygon)).toBe(true);
      for (const ring of s.polygon.flat()) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring.length).toBeLessThan(8192);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      }
      expect(JSON.stringify(s.polygon).length).toBeLessThan(512 * 1024);
    }
  });

  test("the boundary source is a real DataSF snapshot", () => {
    expect(BOUNDARY_SOURCE.url).toMatch(/^https:\/\/data\.sf\.gov\//);
    expect(BOUNDARY_SOURCE.publisher).toBe("DataSF");
    expect(BOUNDARY_SOURCE.snippet.length).toBeLessThanOrEqual(280);
    expect(BOUNDARY_SOURCE.fetchedAt).toBeGreaterThan(Date.UTC(2025, 0, 1));
  });

  test("known points land in the right neighborhood", () => {
    const cases: [string, number, number, string | null][] = [
      ["Valencia & 18th", 37.7617, -122.4216, "mission"],
      ["9th Ave & Irving", 37.76405, -122.46633, "inner-sunset"],
      ["22nd & Tennessee (Dogpatch)", 37.75788, -122.38927, "potrero-hill"],
      ["Mission Dolores Park", 37.75972, -122.42713, "castro-upper-market"],
      ["4th & King Caltrain", 37.7764, -122.39491, "mission-bay"],
      ["Polk & Broadway", 37.79595, -122.42179, "russian-hill"],
      ["Ferry Building (shoreline)", 37.79554, -122.39363, "financial-district-south-beach"],
      ["Pacific Ocean off Ocean Beach", 37.76, -122.53, null],
      ["The Bay off Pier 39", 37.815, -122.41, null],
      ["UC Berkeley", 37.8719, -122.2585, null],
      ["Daly City BART", 37.70618, -122.46905, null],
    ];
    for (const [name, lat, lng, want] of cases) {
      expect([name, neighborhoodSlugAt({ lat, lng })]).toEqual([name, want]);
    }
  });

  test("every composer place in SF maps to one neighborhood", () => {
    const want: Record<string, string | null> = {
      Mission: "mission",
      Dogpatch: "potrero-hill",
      SoMa: "south-of-market",
      "Outer Sunset": "sunset-parkside",
      Castro: "castro-upper-market",
      Berkeley: null,
      "Daly City": null,
    };
    for (const [name, slug] of Object.entries(want)) {
      expect([name, neighborhoodSlugAt(places[name as keyof typeof places])]).toEqual([name, slug]);
    }
  });

  test("garbage coordinates don't match", () => {
    expect(neighborhoodSlugAt({ lat: Number.NaN, lng: -122.4 })).toBeNull();
    expect(neighborhoodSlugAt({ lat: 0, lng: 0 })).toBeNull();
  });
});

/* ---------- Assignment ---------- */

describe("neighborhoodId assignment", () => {
  const VALENCIA = { lat: 37.7617, lng: -122.4216 };
  const IRVING = { lat: 37.76405, lng: -122.46633 };
  const BERKELEY = { lat: 37.8719, lng: -122.2585 };
  type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
  const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown>) =>
    (fn as { _handler: Handler })._handler(ctx, { viewerId: "users:v", ...args });
  const world = () => {
    const tables: Record<string, Row[]> = {
      users: [{ _id: "users:v", city: "San Francisco, CA" }],
      neighborhoods: SF_NEIGHBORHOODS.map((n) => ({
        _id: `neighborhoods:${n.slug}`,
        slug: n.slug,
      })),
      events: [],
      eventResponses: [],
      groups: [],
      groupMembers: [],
    };
    return { tables, ctx: fakeCtx(tables) };
  };
  const event = {
    title: "Trivia",
    description: "",
    category: "Games",
    startAt: 1,
    privacy: "public",
  };

  test("neighborhoodIdAt looks up the row for the point's neighborhood", async () => {
    const { ctx } = world();
    expect(await neighborhoodIdAt(ctx, VALENCIA)).toBe("neighborhoods:mission" as never);
    expect(await neighborhoodIdAt(ctx, BERKELEY)).toBeUndefined();
    expect(await neighborhoodIdAt(ctx, undefined)).toBeUndefined();
  });

  test("events: set on create, kept, moved or cleared on update", async () => {
    const { tables, ctx } = world();
    const id = await call(events.create, ctx, {
      ...event,
      online: false,
      venue: "Zeitgeist",
      point: VALENCIA,
    });
    const row = () => tables.events.find((e) => e._id === id);
    expect(row()?.neighborhoodId).toBe("neighborhoods:mission");
    const update = (a: Record<string, unknown>) =>
      call(events.update, ctx, { ...event, eventId: id, online: false, venue: "Zeitgeist", ...a });
    await update({});
    expect(row()?.neighborhoodId).toBe("neighborhoods:mission");
    await update({ point: IRVING });
    expect(row()?.neighborhoodId).toBe("neighborhoods:inner-sunset");
    await update({ venue: "Somewhere else" });
    expect([row()?.point, row()?.neighborhoodId]).toEqual([undefined, undefined]);
    await update({ point: VALENCIA });
    await update({ point: null });
    expect([row()?.point, row()?.neighborhoodId]).toEqual([undefined, undefined]);
    await update({ point: VALENCIA, online: true });
    expect([row()?.point, row()?.neighborhoodId]).toEqual([undefined, undefined]);
    const online = await call(events.create, ctx, { ...event, online: true, point: VALENCIA });
    expect(tables.events.find((e) => e._id === online)?.neighborhoodId).toBeUndefined();
  });

  test("groups: set from the point on create", async () => {
    const { tables, ctx } = world();
    const based = await call(groups.create, ctx, {
      name: "Irving St",
      privacy: "public",
      point: IRVING,
    });
    const none = await call(groups.create, ctx, { name: "Anywhere", privacy: "public" });
    const nb = (r: unknown) =>
      tables.groups.find((g) => g._id === (r as { groupId: string }).groupId)?.neighborhoodId;
    expect([nb(based), nb(none)]).toEqual(["neighborhoods:inner-sunset", undefined]);
  });
});

/* ---------- Seed plan ---------- */

describe("seed plan: coordinates and neighborhoods", () => {
  test("the plan is deterministic", () => {
    expect(JSON.stringify(buildPlan(NOW))).toBe(JSON.stringify(plan));
  });

  test("every SF listing sits in its place's neighborhood", () => {
    for (const l of plan.listings) {
      const place = places[l.row.location.neighborhood as keyof typeof places];
      const want = neighborhoodSlugAt(place) ?? undefined;
      expect([l.key, l.neighborhood]).toEqual([l.key, want]);
      const p = { lat: l.row.location.lat ?? Number.NaN, lng: l.row.location.lng ?? Number.NaN };
      expect([l.key, neighborhoodSlugAt(p) ?? undefined]).toEqual([l.key, l.neighborhood]);
    }
  });

  test("rentals in SF sit at their cross streets", () => {
    for (const l of plan.listings) {
      if (!l.row.rental?.address || !l.neighborhood) continue;
      const place = places[l.row.location.neighborhood as keyof typeof places];
      const p = { lat: l.row.location.lat ?? 0, lng: l.row.location.lng ?? 0 };
      // A geocoded corner, not the jittered default around the place's center.
      expect([l.key, distanceMeters(p, place) < 3000]).toEqual([l.key, true]);
    }
  });

  test("in-person events have venue points; online events don't", () => {
    for (const e of plan.events) {
      expect([e.key, e.row.point === undefined]).toEqual([e.key, e.row.online]);
      if (e.row.point) {
        expect([e.key, e.neighborhood]).toEqual([
          e.key,
          neighborhoodSlugAt(e.row.point) ?? undefined,
        ]);
      }
    }
  });

  test("group points and neighborhoods agree", () => {
    for (const g of plan.groups) {
      const want = g.row.point ? (neighborhoodSlugAt(g.row.point) ?? undefined) : undefined;
      expect([g.slug, g.neighborhood]).toEqual([g.slug, want]);
    }
    for (const g of neighborhoodGroups) {
      expect([g.slug, plan.groups.find((x) => x.slug === g.slug)?.neighborhood]).toEqual([
        g.slug,
        g.neighborhood,
      ]);
    }
  });

  test("every neighborhood row cites DataSF", () => {
    expect(plan.neighborhoods).toHaveLength(41);
    for (const n of plan.neighborhoods) expect(n.sources.length).toBeGreaterThan(0);
  });
});

describe("seed plan: facts", () => {
  const sourceKeys = new Set(plan.externalSources.map((s) => s.key));

  test("every fact cites real external snapshots", () => {
    expect(plan.neighborhoodFacts.length).toBeGreaterThan(0);
    for (const f of plan.neighborhoodFacts) {
      expect([f.row.key, f.sources.length > 0]).toEqual([f.row.key, true]);
      for (const k of f.sources) expect([f.row.key, sourceKeys.has(k)]).toEqual([f.row.key, true]);
    }
    for (const { key, row } of plan.externalSources) {
      expect([key, /^https?:\/\//.test(row.url)]).toEqual([key, true]);
      expect([key, row.title.length > 0 && row.publisher.length > 0]).toEqual([key, true]);
      expect([key, row.snippet.length > 0 && row.snippet.length <= 280]).toEqual([key, true]);
      expect([key, row.fetchedAt > Date.UTC(2025, 0, 1)]).toEqual([key, true]);
    }
  });

  test("facts sit inside (or, for stations, beside) the neighborhood they're filed under", () => {
    for (const f of plan.neighborhoodFacts) {
      const where = `${f.row.key} in ${f.neighborhood}`;
      const r = f.row;
      if (r.kind === "campus") {
        expect([where, neighborhoodSlugAt(r.point)]).toEqual([where, f.neighborhood]);
      } else if (r.kind === "transit_station") {
        expect([where, neighborhoodsNear(r.point, 40).includes(f.neighborhood)]).toEqual([
          where,
          true,
        ]);
      } else if (r.kind === "transit_line") {
        expect(r.stops.length).toBeGreaterThan(0);
        for (const s of r.stops) {
          expect([where, neighborhoodsNear(s.point, 40).includes(f.neighborhood)]).toEqual([
            where,
            true,
          ]);
        }
      } else {
        const shape = neighborhoodShape(f.neighborhood);
        const near = r.path.some(
          (p) =>
            pointInMultiPolygon(p, shape.polygon) || edgeDistanceMeters(p, shape.polygon) < 400,
        );
        expect([where, near]).toEqual([where, true]);
      }
    }
  });

  test("a station and the line stops at it are filed under the same neighborhoods", () => {
    const filed = new Map<string, Set<string>>();
    for (const f of plan.neighborhoodFacts) {
      const names =
        f.row.kind === "transit_station"
          ? [`station:${f.row.system}:${f.row.name}`]
          : f.row.kind === "transit_line"
            ? f.row.stops.map((s) => `stop:${f.row.key}:${s.name}`)
            : [];
      for (const n of names) filed.set(n, new Set([...(filed.get(n) ?? []), f.neighborhood]));
    }
    for (const f of plan.neighborhoodFacts) {
      if (f.row.kind !== "transit_line") continue;
      for (const s of f.row.stops) {
        const station = filed.get(`station:${f.row.system}:${s.name}`);
        if (!station) continue;
        const stops = filed.get(`stop:${f.row.key}:${s.name}`);
        expect([f.row.key, s.name, [...(stops ?? [])].sort()]).toEqual([
          f.row.key,
          s.name,
          [...station].sort(),
        ]);
      }
    }
    // Glen Park BART sits just outside DataSF's Glen Park polygon (Bosworth St is the line).
    const glen = plan.neighborhoodFacts
      .filter((f) => f.row.key === "bart:glen")
      .map((f) => f.neighborhood);
    expect(glen).toContain("glen-park");
  });

  test("a line's stops in one neighborhood are distinct stops", () => {
    for (const f of plan.neighborhoodFacts) {
      if (f.row.kind !== "transit_line") continue;
      const stops = f.row.stops;
      for (let i = 0; i < stops.length; i++) {
        for (let j = i + 1; j < stops.length; j++) {
          const close = distanceMeters(stops[i].point, stops[j].point) < 40;
          expect([f.row.key, stops[i].name, stops[j].name, close]).toEqual([
            f.row.key,
            stops[i].name,
            stops[j].name,
            false,
          ]);
        }
      }
    }
  });

  test("snippets fit the citation chip, so the supporting words show", () => {
    for (const { key, row } of plan.externalSources) {
      expect([key, snippet(row.snippet)]).toEqual([key, row.snippet]);
    }
  });

  test("keys are unique per neighborhood", () => {
    const seen = new Set<string>();
    for (const f of plan.neighborhoodFacts) {
      const k = `${f.neighborhood}|${f.row.key}`;
      expect([k, seen.has(k)]).toEqual([k, false]);
      seen.add(k);
    }
  });

  test("BART and Caltrain stations in the city are all there", () => {
    const stations = plan.neighborhoodFacts.filter((f) => f.row.kind === "transit_station");
    const has = (key: string) => stations.some((f) => f.row.key === key);
    for (const k of ["bart:16th", "bart:24th", "bart:embr", "bart:glen", "bart:balb"]) {
      expect([k, has(k)]).toEqual([k, true]);
    }
    expect(stations.filter((f) => f.row.key.startsWith("caltrain:")).length).toBe(2);
  });
});

/* ---------- Neighborhood Group threads ---------- */

describe("neighborhood Group threads", () => {
  const groupSlugs = new Set<string>(neighborhoodGroups.map((g) => g.slug));
  const membersOf = new Map<string, Set<string>>(
    neighborhoodGroups.map((g) => [
      g.slug,
      new Set<string>([...g.admins, ...("moderators" in g ? g.moderators : []), ...g.members]),
    ]),
  );
  const allText = (comments: readonly (CommentSeed | ReplySeed)[] | undefined): string[] =>
    (comments ?? []).flatMap((c) => [c.text, ...allText(c.replies)]);
  const authors = (comments: readonly (CommentSeed | ReplySeed)[] | undefined): string[] =>
    (comments ?? []).flatMap((c) => [c.by, ...authors(c.replies)]);

  test("Groups are public, new, and don't shadow /groups routes", () => {
    const routes = new Set(
      readdirSync(join(import.meta.dir, "../src/routes/groups")).map((f) =>
        f.replace(/\.tsx$/, ""),
      ),
    );
    for (const g of neighborhoodGroups) {
      expect([g.slug, g.privacy]).toEqual([g.slug, "public"]);
      expect([g.slug, routes.has(g.slug)]).toEqual([g.slug, false]);
      expect([g.slug, isNeighborhoodSlug(g.neighborhood)]).toEqual([g.slug, true]);
    }
    expect(new Set(neighborhoodGroups.map((g) => g.neighborhood)).size).toBe(
      neighborhoodGroups.length,
    );
  });

  test("every thread is in a neighborhood Group, by members, with explicit keys", () => {
    for (const p of neighborhoodPosts) {
      expect([p.key, p.in !== undefined && groupSlugs.has(p.in)]).toEqual([p.key, true]);
      const members = membersOf.get(p.in ?? "") ?? new Set<string>();
      for (const by of [p.by, ...authors(p.comments)]) {
        expect([p.key, by, members.has(by)]).toEqual([p.key, by, true]);
      }
      expect([p.key, (p.photos ?? []).length]).toEqual([p.key, 0]);
    }
  });

  test("threads never use a seeded person's full name", () => {
    const names = people.map((p) => p.name);
    for (const p of neighborhoodPosts) {
      for (const text of [p.text ?? "", ...allText(p.comments)]) {
        for (const name of names) expect([p.key, text.includes(name)]).toEqual([p.key, false]);
      }
    }
  });

  test("every registered place is named in its neighborhood's threads and located", () => {
    const threadText = new Map<string, string>();
    for (const g of neighborhoodGroups) {
      const text = neighborhoodPosts
        .filter((p) => p.in === g.slug)
        .flatMap((p) => [p.text ?? "", ...allText(p.comments)])
        .join("\n")
        .toLowerCase();
      threadText.set(g.neighborhood, text);
    }
    const keys = new Set<string>();
    for (const place of NEIGHBORHOOD_PLACES) {
      expect([place.key, keys.has(place.key)]).toEqual([place.key, false]);
      keys.add(place.key);
      const text = threadText.get(place.neighborhood) ?? "";
      expect([place.key, text.includes(place.name.toLowerCase())]).toEqual([place.key, true]);
      const at = neighborhoodSlugAt(place.point);
      if (at !== place.neighborhood) {
        // Fictional businesses sit in the neighborhood whose locals recommend them, or just across
        // a boundary street (a seeded venue); real landmarks may be next door (Dolores Park for
        // the Mission), but nothing is across town.
        const edge = edgeDistanceMeters(place.point, neighborhoodShape(place.neighborhood).polygon);
        expect([place.key, edge < (place.real ? 1500 : 400)]).toEqual([place.key, true]);
      }
    }
  });
});

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import type { MutationCtx } from "../convex/_generated/server";
import { rentalSources } from "../convex/lib/rentalMedia";
import { layoutMedia } from "../convex/lib/unitSceneTask";
import { update, validate } from "../convex/listings";
import { buildPlan } from "../convex/seed/plan";
import units from "../convex/seed/rentalMedia.json";
import { rentals } from "../convex/seed/world/rentals";
import { create, publicMediaUrl } from "../convex/unitScenes";
import { fakeCtx, type Row } from "./fakeDb";

const plan = buildPlan(Date.UTC(2026, 10, 13));

describe("same-unit rental evidence", () => {
  test("every rental uses its own complete gallery, plan, room counts and exact source point", () => {
    expect(rentals).toHaveLength(30);
    expect(rentals.filter((r) => r.rental?.propertyType === "room")).toHaveLength(13);
    expect(rentals.some((r) => r.rental?.listingType === "sublet")).toBe(true);
    expect(new Set(rentals.map((r) => r.rentalMedia?.sourceUrl)).size).toBe(30);
    const images = new Set<string>();
    for (const rental of rentals) {
      const unit = units.find((u) => u.media.sourceUrl === rental.rentalMedia?.sourceUrl)!;
      const row = plan.listings.find((r) => r.key === rental.key)!.row;
      expect(row.rentalMedia).toEqual(unit.media);
      expect(row.photos).toEqual(unit.media.photos.map((p) => p.url));
      expect(row.location.lat).toBe(unit.point.lat);
      expect(row.location.lng).toBe(unit.point.lng);
      expect(row.rental?.bedrooms).toBe(row.rental?.propertyType === "room" ? 1 : unit.bedrooms);
      expect(row.rental?.sqft).toBe(row.rental?.propertyType === "room" ? undefined : unit.sqft);
      expect(row.rental?.bathrooms).toBe(unit.bathrooms);
      const labeled = unit.media.photos.filter((p) => !p.label.includes("view"));
      expect(
        labeled.filter((p) => /bedroom/i.test(p.label) && !/living/i.test(p.label)).length,
      ).toBe(unit.bedrooms);
      expect(
        labeled.reduce(
          (n, p) => n + (/powder/i.test(p.label) ? 0.5 : /bathroom|ensuite/i.test(p.label) ? 1 : 0),
          0,
        ),
      ).toBe(unit.bathrooms);
      expect(labeled.some((p) => /kitchen/i.test(p.label))).toBe(true);
      for (const photo of [...unit.media.photos, unit.media.floorPlan]) {
        expect(existsSync(`public${photo.url}`)).toBe(true);
        expect(publicMediaUrl(photo.sourceUrl)).toBe(true);
        expect(images.has(photo.url)).toBe(false);
        images.add(photo.url);
      }
    }
  });

  test("shared parking and sports photos never enter a unit's 3D inputs", () => {
    const unit = units.find((u) => u.slug === "208-north-lake-merced-hills-3a")!;
    const sources = rentalSources(unit.media);
    expect(sources.some((s) => /charger|tennis/i.test(s.label))).toBe(false);
    expect(sources.some((s) => /kp2d93Lopb4|dQzkk1qutAj/.test(s.url ?? ""))).toBe(false);
  });

  test("creating a listing scene imports the plan as topology and every labeled public photo", async () => {
    const rental = rentals.find((r) => r.rental?.bedrooms === 3)!;
    const media = rental.rentalMedia!;
    const tables: Record<string, Row[]> = {
      users: [{ _id: "viewer" }, { _id: "seller" }],
      listings: [
        {
          ...plan.listings.find((r) => r.key === rental.key)!.row,
          _id: "listing",
          sellerId: "seller",
          title: rental.title,
          description: rental.description,
          photos: media.photos.map((p) => p.url),
          rentalMedia: media,
        },
      ],
      unitScenes: [],
    };
    const ctx = fakeCtx(tables);
    const handler = (
      create as unknown as {
        _handler: (
          ctx: MutationCtx,
          args: { viewerId: string; listingId: string },
        ) => Promise<string>;
      }
    )._handler;
    const id = await handler(ctx, { viewerId: "viewer", listingId: "listing" });
    const scene = tables.unitScenes.find((s) => s._id === id)!;
    expect(scene.sources).toEqual(rentalSources(media));
    const sources = rentalSources(media);
    expect(sources.length).toBeLessThanOrEqual(20);
    const inputs = sources.map((s) => ({ key: s.key, kind: "image" as const, url: s.url! }));
    expect(layoutMedia(inputs, sources)).toEqual([inputs[0]]);
    expect(inputs.every((s) => s.url.startsWith("https://"))).toBe(true);
  });

  test("price edits preserve reference evidence; replacing a photo removes the old plan and originals", async () => {
    const row = plan.listings.find((r) => r.row.rentalMedia)!.row;
    const tables: Record<string, Row[]> = {
      users: [{ _id: "seller" }],
      listings: [{ ...row, _id: "listing", sellerId: "seller" }],
    };
    const ctx = fakeCtx(tables);
    const handler = (
      update as unknown as {
        _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<string>;
      }
    )._handler;
    const args = {
      viewerId: "seller",
      listingId: "listing",
      title: row.title,
      price: row.price + 100,
      description: row.description,
      category: row.category,
      neighborhood: row.location.neighborhood,
      rental: row.rental,
      photos: row.photos.map((url) => ({ url })),
    };
    await handler(ctx, args);
    expect(tables.listings[0].rentalMedia).toEqual(row.rentalMedia);
    await handler(ctx, { ...args, photos: [{ url: "https://example.com/another-unit.jpg" }] });
    expect(tables.listings[0].rentalMedia).toBeUndefined();
  });

  test("a full property gallery remains editable while ordinary items keep their limit", () => {
    expect(() =>
      validate(
        { title: "Apartment", price: 3000, description: "", category: "propertyrentals" },
        18,
      ),
    ).not.toThrow();
    expect(() =>
      validate(
        { title: "Apartment", price: 3000, description: "", category: "propertyrentals" },
        19,
      ),
    ).toThrow("18 photos");
    expect(() =>
      validate({ title: "Chair", price: 30, description: "", category: "furniture" }, 11),
    ).toThrow("10 photos");
  });
});

import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import { withinRadius } from "../convex/lib/listings";
import { thumbSource } from "../convex/lib/thumb";
import { MAX_SCAN, relatedListings } from "../convex/listings";
import { storyReplyAttachment } from "../convex/stories";
import { sectionFor } from "../src/landing/shell/sections";
import { fakeCtx, type ReadStats, type Row } from "./fakeDb";

const id = (s: string) => s as never;

/* Marketplace "Today's picks" */

const BERKELEY = { lat: 37.8716, lng: -122.2727 };
const SF = { lat: 37.7749, lng: -122.4194 };
const MOUNTAIN_VIEW = { lat: 37.3894, lng: -122.0832 };

let created = 0;
const listing = (
  _id: string,
  at: { lat: number; lng: number } | null,
  extra: Partial<Doc<"listings">> = {},
): Row => ({
  _id,
  title: _id,
  category: "furniture",
  status: "active",
  location: at ? { city: "x", ...at } : { city: "x" },
  createdAt: ++created,
  ...extra,
});

describe("withinRadius", () => {
  const near = { ...BERKELEY, radiusMi: 5 };
  test("keeps listings inside the radius and drops ones outside", () => {
    expect(withinRadius({ location: { city: "Berkeley", ...BERKELEY } }, near)).toBe(true);
    expect(withinRadius({ location: { city: "San Francisco", ...SF } }, near)).toBe(false);
    expect(withinRadius({ location: { city: "Mountain View", ...MOUNTAIN_VIEW } }, near)).toBe(
      false,
    );
  });
  test("a wider radius takes in San Francisco", () => {
    expect(withinRadius({ location: { city: "SF", ...SF } }, { ...BERKELEY, radiusMi: 20 })).toBe(
      true,
    );
  });
  test("no radius, or no coordinates, always matches", () => {
    expect(withinRadius({ location: { city: "SF", ...SF } }, undefined)).toBe(true);
    expect(withinRadius({ location: { city: "Somewhere" } }, near)).toBe(true);
  });
});

describe("relatedListings", () => {
  const rows = () => [
    listing("item", BERKELEY),
    listing("berkeley-chair", BERKELEY),
    listing("sf-chair", SF),
    listing("mv-chair", MOUNTAIN_VIEW),
    listing("berkeley-lamp", BERKELEY, { category: "household" }),
    listing("sf-lamp", SF, { category: "household" }),
    listing("berkeley-sold", BERKELEY, { status: "sold" }),
  ];
  const ids = (out: { _id: string }[]) => out.map((l) => l._id);

  test("Berkeley within 5 miles: only Berkeley picks, same category first", async () => {
    const ctx = fakeCtx({ listings: rows() });
    const out = await relatedListings(ctx, id("item"), 24, { ...BERKELEY, radiusMi: 5 });
    expect(ids(out)).toEqual(["berkeley-chair", "berkeley-lamp"]);
  });

  test("without a location, every active listing is a pick, newest first", async () => {
    const ctx = fakeCtx({ listings: rows() });
    const out = await relatedListings(ctx, id("item"), 24, undefined);
    expect(ids(out)).toEqual([
      "mv-chair",
      "sf-chair",
      "berkeley-chair",
      "sf-lamp",
      "berkeley-lamp",
    ]);
  });

  test("stops at the limit without reading further", async () => {
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const ctx = fakeCtx({ listings: rows() }, stats);
    const out = await relatedListings(ctx, id("item"), 1, { ...BERKELEY, radiusMi: 5 });
    expect(ids(out)).toEqual(["berkeley-chair"]);
    // The listing, then newest first: the sold chair, the Mountain View and SF chairs
    // (outside the radius) and the Berkeley chair. Nothing after the page fills.
    expect(stats.docs).toBe(5);
  });

  test("both scans share one read budget", async () => {
    const far = Array.from({ length: MAX_SCAN + 1000 }, (_, i) => listing(`sf-${i}`, SF));
    const stats: ReadStats = { docs: 0, ranges: 0 };
    const ctx = fakeCtx({ listings: [listing("item", BERKELEY), ...far] }, stats);
    const out = await relatedListings(ctx, id("item"), 24, { ...BERKELEY, radiusMi: 5 });
    expect(out).toEqual([]);
    expect(stats.docs).toBe(1 + MAX_SCAN);
  });
});

/* Video thumbnails */

describe("thumbSource", () => {
  test("images draw as images", () => {
    expect(thumbSource({ kind: "image", url: "/seed/posts/a.jpg" })).toEqual({
      kind: "image",
      src: "/seed/posts/a.jpg",
    });
  });
  test("a video draws its poster as an image", () => {
    expect(
      thumbSource({
        kind: "video",
        url: "/seed/videos/salmon-wide.mp4",
        poster: "/seed/videos/salmon-wide.jpg",
      }),
    ).toEqual({ kind: "image", src: "/seed/videos/salmon-wide.jpg" });
  });
  test("a video without a poster draws as a video, never an image", () => {
    expect(thumbSource({ kind: "video", url: "/seed/videos/ridge-hike-tall.mp4" })).toEqual({
      kind: "video",
      src: "/seed/videos/ridge-hike-tall.mp4",
    });
  });
});

describe("storyReplyAttachment", () => {
  const story = (media: { url: string; kind: "image" | "video"; poster?: string }) => ({
    _id: id("story1"),
    media,
    background: undefined,
    text: undefined,
  });
  test("a video story saves its poster", () => {
    const a = storyReplyAttachment(
      story({ kind: "video", url: "/v/clip.mp4", poster: "/v/clip.jpg" }),
    );
    expect(a.url).toBe("/v/clip.jpg");
  });
  test("a video story without a poster keeps its video", () => {
    expect(storyReplyAttachment(story({ kind: "video", url: "/v/clip.mp4" })).url).toBe(
      "/v/clip.mp4",
    );
  });
  test("a text story saves no media", () => {
    expect(storyReplyAttachment(story({ kind: "image", url: "" })).url).toBeUndefined();
  });
});

/* Landing sidebar */

describe("sectionFor", () => {
  test("the Landing root is Home", () => {
    expect(sectionFor("/landing")?.label).toBe("Home");
  });
  test("a section route selects that section, not Home", () => {
    expect(sectionFor("/landing/find")?.label).toBe("Find");
    expect(sectionFor("/landing/find/listing-1")?.label).toBe("Find");
    expect(sectionFor("/landing/inbox")?.label).toBe("Inbox");
  });
  test("onboarding selects City Profile, not Home", () => {
    expect(sectionFor("/landing/welcome")?.label).toBe("City Profile");
    expect(sectionFor("/landing/welcome/")?.label).toBe("City Profile");
  });
  test("a lookalike prefix doesn't match", () => {
    expect(sectionFor("/landing/findings")?.label).toBe("Home");
    expect(sectionFor("/landingpage")).toBeUndefined();
  });
});

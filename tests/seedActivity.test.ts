import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { isNeighborhoodSlug, neighborhoodSlugAt } from "../convex/lib/neighborhoods";
import { hasProtected } from "../convex/lib/protectedText";
import { Clock, DAY } from "../convex/seed/lib/time";
import { buildPlan } from "../convex/seed/plan";
import { events } from "../convex/seed/world/events";
import { activityPosts } from "../convex/seed/world/posts/activity";

// Thursday, Nov 12 at noon in San Francisco: the authored demo calendar.
const NOW = Date.UTC(2026, 10, 12, 20);
const plan = buildPlan(NOW);
const added = events.filter((e) => e.key.startsWith("activity-"));
const demoNeighborhoods = [
  "mission",
  "noe-valley",
  "bernal-heights",
  "potrero-hill",
  "south-of-market",
  "hayes-valley",
  "inner-richmond",
  "outer-richmond",
  "inner-sunset",
  "sunset-parkside",
  "marina",
  "castro-upper-market",
  "haight-ashbury",
  "north-beach",
  "western-addition",
];

test("the resolved plan has 100+ upcoming Events with valid hosts and neighborhoods", () => {
  const upcoming = plan.events.filter((e) => e.row.startAt > NOW);
  expect(upcoming.length).toBeGreaterThanOrEqual(100);
  for (const e of plan.events) {
    expect(plan.users.some((u) => u.row.username === e.host)).toBe(true);
    if (e.group) expect(plan.groups.some((g) => g.slug === e.group)).toBe(true);
  }
  for (const e of upcoming) {
    expect([e.key, isNeighborhoodSlug(e.neighborhood ?? "")]).toEqual([e.key, true]);
    expect(e.row.point).toBeDefined();
    expect(neighborhoodSlugAt(e.row.point!)).toBe(e.neighborhood!);
    expect(e.row.startAt).toBeGreaterThan(NOW);
  }
  for (const neighborhood of demoNeighborhoods) {
    expect(upcoming.filter((e) => e.neighborhood === neighborhood).length).toBeGreaterThanOrEqual(
      3,
    );
  }
});

test("90 new Group Events stay in the next six weeks when the seed date rolls", () => {
  expect(added).toHaveLength(90);
  for (const now of [NOW, NOW + DAY, NOW + 5 * DAY, Date.UTC(2027, 2, 13, 20)]) {
    const clock = new Clock(now);
    for (const e of added) {
      expect(e.in).toBeDefined();
      expect(clock.at(e.start)).toBeGreaterThan(now);
      expect(clock.at(e.start)).toBeLessThan(now + 43 * DAY);
      expect(e.hours).toBeGreaterThan(0);
      expect(e.hours).toBeLessThanOrEqual(4);
    }
  }
  const clock = new Clock(NOW);
  const thisWeek = added.filter((e) => clock.at(e.start) <= NOW + 7 * DAY);
  expect(thisWeek.length).toBeGreaterThanOrEqual(15);
  expect(thisWeek.length).toBeLessThanOrEqual(20);
});

test("new activity copy is safe, recent, resolves references and uses existing cover files", () => {
  expect(activityPosts).toHaveLength(45);
  for (const e of added) {
    expect(hasProtected(`${e.title} ${e.description} ${e.venue} ${e.address}`)).toBe(false);
    expect(existsSync(`public/seed/${e.cover}`)).toBe(true);
    const resolved = plan.events.find((p) => p.key === e.key)!;
    expect(existsSync(`public${resolved.row.cover}`)).toBe(true);
    const members = plan.groupMembers.filter((m) => m.slug === e.in).map((m) => m.user);
    expect(members).toContain(e.host);
    if (e.privacy === "group") {
      for (const user of [...(e.going ?? []), ...(e.interested ?? [])]) {
        expect(members).toContain(user);
      }
    }
  }
  for (const p of activityPosts) {
    expect(hasProtected(p.text ?? "")).toBe(false);
    const resolved = plan.posts.find((post) => post.key === p.key)!;
    expect(resolved.row.createdAt).toBeLessThan(NOW);
    expect(resolved.row.createdAt).toBeGreaterThan(NOW - 7 * DAY);
    expect(resolved.group).toBe(p.in!);
    for (const c of resolved.comments) expect(hasProtected(c.row.text ?? "")).toBe(false);
    expect(resolved.reactions.length).toBeGreaterThan(0);
  }
});

test("Maya's original story counts remain explicit and new address data survives regeneration", () => {
  const responses = plan.eventResponses.filter((r) => r.user === "maya.chen");
  expect(responses.filter((r) => r.status === "going")).toHaveLength(7);
  expect(responses.filter((r) => r.status === "interested")).toHaveLength(14);
  expect(responses.filter((r) => r.status === "invited")).toHaveLength(3);
  const mapSource = readFileSync("scripts/maps/build.py", "utf8");
  const venueBlock = /VENUES = \{([\s\S]*?)\n\}/.exec(mapSource)?.[1] ?? "";
  for (const e of added) expect(venueBlock).toContain(JSON.stringify(e.address));
});

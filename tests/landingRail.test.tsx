import { describe, expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { LandingLayout } from "../src/landing/shell/LandingLayout";

/** Renders Landing's sidebar at `path` and returns the labels marked `aria-current="page"`. */
async function currentRows(path: string) {
  const root = createRootRoute();
  const landing = createRoute({
    getParentRoute: () => root,
    path: "/landing",
    component: LandingLayout,
  });
  const home = createRoute({ getParentRoute: () => landing, path: "/" });
  const page = createRoute({ getParentRoute: () => landing, path: "$" });
  const router = createRouter({
    routeTree: root.addChildren([landing.addChildren([home, page])]),
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });
  await router.load();
  const html = renderToString(<RouterProvider router={router} />);
  return [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
    (m[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .trim(),
  );
}

describe("Landing sidebar aria-current", () => {
  test("Home is the only current row on /landing", async () => {
    expect(await currentRows("/landing")).toEqual(["Home"]);
  });
  test.each([
    ["/landing/find", "Find"],
    ["/landing/find/some-listing", "Find"],
    ["/landing/place", "My Place"],
    ["/landing/crew", "Crew & Journeys"],
    ["/landing/move-out", "Move out"],
    ["/landing/profile", "City Profile"],
    ["/landing/inbox", "Inbox"],
  ])("%s marks only %s, not Home", async (path, label) => {
    expect(await currentRows(path)).toEqual([label]);
  });
});

import { describe, expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import type { Id } from "../convex/_generated/dataModel";
import type { CitedSource } from "../convex/lib/citations";
import type { UserSummary } from "../convex/lib/users";
import { findComment } from "../src/features/posts/commentPath";
import { SourceLink } from "../src/ui/Citations";

/* ---------- Locating a linked comment ---------- */

const id = (s: string) => s as Id<"comments">;
const leaf = (s: string) => ({ _id: id(s) });
const tree = [
  { _id: id("a"), replies: [] },
  {
    _id: id("b"),
    replies: [
      { _id: id("b1"), replies: [] },
      { _id: id("b2"), replies: [leaf("b2x"), leaf("b2y")] },
    ],
  },
];

describe("findComment", () => {
  test("a top-level comment is its own thread", () => {
    expect(findComment(tree, id("a"))).toEqual({ target: id("a"), thread: id("a") });
  });
  test("a reply names its thread and itself as the reply", () => {
    expect(findComment(tree, id("b1"))).toEqual({
      target: id("b1"),
      thread: id("b"),
      reply: id("b1"),
    });
  });
  test("a reply to a reply names the depth-2 reply above it", () => {
    expect(findComment(tree, id("b2y"))).toEqual({
      target: id("b2y"),
      thread: id("b"),
      reply: id("b2"),
    });
  });
  test("a comment the viewer can't see (or from another post) falls back to the permalink", () => {
    // comments.list leaves out deleted comments and blocked threads, so they're simply absent.
    expect(findComment(tree, id("gone"))).toBeNull();
    expect(findComment(tree, undefined)).toBeNull();
    expect(findComment([], id("a"))).toBeNull();
  });
});

/* ---------- The citation chip's links ---------- */

const author: UserSummary = {
  _id: "users:u" as Id<"users">,
  name: "Grace Liu",
  firstName: "Grace",
  username: "grace.liu",
  avatar: "/a.jpg",
  verified: false,
  kind: "person",
  online: false,
  lastActiveAt: 0,
};

const comment: CitedSource = {
  kind: "comment",
  key: "comment:c1",
  snippet: "La Sportiva Tarantulace",
  commentId: "c1" as Id<"comments">,
  postId: "p1" as Id<"posts">,
  postAuthorUsername: "leo.novak",
  author,
  group: null,
  createdAt: 0,
  replyCount: 0,
  reactionCount: 0,
};

/** The href `SourceLink` renders for a source, inside a minimal router. */
async function hrefOf(source: CitedSource) {
  const root = createRootRoute({
    component: () => (
      <SourceLink source={source} onNavigate={() => {}}>
        x
      </SourceLink>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/$username/posts/$postId" }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    isServer: true,
  });
  await router.load();
  const html = renderToString(<RouterProvider router={router} />);
  return /<a [^>]*href="([^"]*)"/.exec(html)?.[1]?.replace(/&amp;/g, "&");
}

describe("SourcesChip links", () => {
  test("a comment source opens the post at that comment", async () => {
    expect(await hrefOf(comment)).toBe("/leo.novak/posts/p1?comment_id=c1");
  });
  test("a post source opens the plain permalink", async () => {
    const post: CitedSource = {
      kind: "post",
      key: "post:p1",
      snippet: "what shoes should a total beginner buy?",
      postId: "p1" as Id<"posts">,
      author: { ...author, username: "leo.novak" },
      group: null,
      createdAt: 0,
      commentCount: 0,
      reactionCount: 0,
    };
    expect(await hrefOf(post)).toBe("/leo.novak/posts/p1");
  });
});

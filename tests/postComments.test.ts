import { describe, expect, test } from "bun:test";
import type { MutationCtx } from "../convex/_generated/server";
import * as comments from "../convex/comments";
import * as posts from "../convex/posts";
import { fakeCtx, type Row } from "./fakeDb";

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, viewer: string, args: Record<string, unknown>) =>
  (fn as { _handler: Handler })._handler(ctx, { viewerId: `users:${viewer}`, ...args });

const user = (name: string): Row => ({
  _id: `users:${name}`,
  name,
  firstName: name,
  username: name,
});

/** Owner's post that `friend` can see and comment on; `extra` overrides post fields. */
function world(extra: Partial<Row> = {}) {
  const tables: Record<string, Row[]> = {
    users: [user("owner"), user("friend")],
    friendships: [
      { _id: "friendships:1", userId: "users:owner", friendId: "users:friend" },
      { _id: "friendships:2", userId: "users:friend", friendId: "users:owner" },
    ],
    posts: [
      {
        _id: "posts:p",
        authorId: "users:owner",
        text: "Moving to SF",
        media: [],
        attachments: [],
        privacy: "friends",
        createdAt: 1,
        reactionCount: 0,
        commentCount: 0,
        shareCount: 0,
        ...extra,
      },
    ],
    comments: [],
    notifications: [],
    groupMembers: [],
    blocks: [],
    userSettings: [],
    postSubscriptions: [],
    reactions: [],
  };
  return { tables, ctx: fakeCtx(tables) };
}

describe("comment notifications", () => {
  test("a reply to the post owner's own comment notifies them once", async () => {
    const { tables, ctx } = world();
    const mine = await call(comments.add, ctx, "owner", { postId: "posts:p", text: "Any tips?" });
    await call(comments.add, ctx, "friend", {
      postId: "posts:p",
      text: "Try the Mission",
      parentId: mine,
    });
    const toOwner = tables.notifications.filter((n) => n.userId === "users:owner");
    expect(toOwner.map((n) => n.kind)).toEqual(["reply"]);
  });

  test("a top-level comment still notifies the post owner", async () => {
    const { tables, ctx } = world();
    await call(comments.add, ctx, "friend", { postId: "posts:p", text: "Welcome!" });
    expect(tables.notifications.map((n) => [n.userId, n.kind])).toEqual([
      ["users:owner", "comment"],
    ]);
  });

  test("deleting a comment removes the notifications quoting it and its replies", async () => {
    const { tables, ctx } = world();
    const top = await call(comments.add, ctx, "friend", { postId: "posts:p", text: "Secret" });
    const reply = await call(comments.add, ctx, "owner", {
      postId: "posts:p",
      text: "Reply",
      parentId: top,
    });
    const other = await call(comments.add, ctx, "friend", { postId: "posts:p", text: "Keep me" });
    expect(tables.notifications.map((n) => n.commentId)).toEqual([top, reply, other]);

    await call(comments.remove, ctx, "friend", { commentId: top });
    expect(tables.notifications.map((n) => n.commentId)).toEqual([other]);
    expect(tables.notifications.some((n) => String(n.text).includes("Secret"))).toBe(false);
  });
});

describe("posts.update", () => {
  test("clearing the text of a text-only post is refused", async () => {
    const { tables, ctx } = world();
    await expect(
      call(posts.update, ctx, "owner", { postId: "posts:p", text: "   " }),
    ).rejects.toThrow("A post needs some content");
    expect(tables.posts[0].text).toBe("Moving to SF");
  });

  test("a post with photos can drop its text", async () => {
    const { tables, ctx } = world({ media: [{ url: "https://x/p.jpg", kind: "image" }] });
    await call(posts.update, ctx, "owner", { postId: "posts:p", text: "" });
    expect(tables.posts[0].text).toBeUndefined();
  });

  test("other edits to a text-only post still save", async () => {
    const { tables, ctx } = world();
    await call(posts.update, ctx, "owner", { postId: "posts:p", privacy: "only_me" });
    expect(tables.posts[0].privacy).toBe("only_me");
  });
});

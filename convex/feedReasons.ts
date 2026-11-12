import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { viewerQuery } from "./lib/functions";
import { canView, loadAudience } from "./lib/posts";

type Reason = {
  kind: "follow" | "friend" | "group" | "reacted" | "commented" | "tagged" | "popular" | "ad";
  text: string;
};

/** End a sentence with a period, without doubling one ("Moonrise Coffee Co."). */
function sentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function names(list: string[], total: number, noun: string) {
  const extra = total - list.length;
  if (extra > 0) return `${list.join(", ")} and ${extra} other ${noun}${extra === 1 ? "" : "s"}`;
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * "Why am I seeing this post?": the real connections that put a post in the
 * viewer's Feed (follows, friendships, group membership, friends' activity).
 */
export const whySeeing = viewerQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const viewerId = ctx.viewer._id;
    const post = await ctx.db.get(postId);
    if (!post) return null;
    const a = await loadAudience(ctx, viewerId);
    if (!(await canView(ctx, post, a))) return null;
    const author = await ctx.db.get(post.authorId);
    if (!author) return null;
    const isPage = author.kind === "page";
    const reasons: Reason[] = [];

    if (post.sponsored) {
      reasons.push({
        kind: "ad",
        text: `${author.name} wants to reach people like you, based on your location and activity on Facebook.`,
      });
    }

    const [follow, friendship, member, reactions, comments] = await Promise.all([
      ctx.db
        .query("follows")
        .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("targetId", author._id))
        .first(),
      ctx.db
        .query("friendships")
        .withIndex("by_pair", (q) => q.eq("userId", viewerId).eq("friendId", author._id))
        .first(),
      post.groupId
        ? ctx.db
            .query("groupMembers")
            .withIndex("by_group_user", (q) =>
              q.eq("groupId", post.groupId as Id<"groups">).eq("userId", viewerId),
            )
            .first()
        : null,
      ctx.db
        .query("reactions")
        .withIndex("by_target", (q) => q.eq("targetType", "post").eq("targetId", postId))
        .take(500),
      ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", postId))
        .take(300),
    ]);

    if (member && post.groupId) {
      const group = await ctx.db.get(post.groupId);
      if (group)
        reasons.push({ kind: "group", text: sentence(`You're a member of ${group.name}`) });
    }
    if (friendship) {
      const since = new Date(friendship.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      reasons.push({
        kind: "friend",
        text: `You've been friends with ${author.name} since ${since}.`,
      });
    } else if (follow) {
      reasons.push({
        kind: "follow",
        text: sentence(`You follow ${isPage ? author.name : author.firstName}`),
      });
    }

    const friendName = async (ids: Id<"users">[]) => {
      const out: string[] = [];
      for (const id of ids) {
        const u = await ctx.db.get(id);
        if (u) out.push(u.name);
      }
      return out;
    };
    const reactors = [...new Set(reactions.map((r) => r.userId).filter((id) => a.friends.has(id)))];
    if (reactors.length > 0) {
      const shown = await friendName(reactors.slice(0, 2));
      reasons.push({
        kind: "reacted",
        text: `${names(shown, reactors.length, "friend")} reacted to this post.`,
      });
    }
    const commenters = [
      ...new Set(
        comments
          .map((c) => c.authorId)
          .filter((id) => a.friends.has(id) && !reactors.slice(0, 2).includes(id)),
      ),
    ];
    if (commenters.length > 0) {
      const shown = await friendName(commenters.slice(0, 2));
      reasons.push({
        kind: "commented",
        text: `${names(shown, commenters.length, "friend")} commented on this post.`,
      });
    }
    const taggedFriends = (post.taggedIds ?? []).filter((id) => a.friends.has(id));
    if (taggedFriends.length > 0 && !friendship) {
      const shown = await friendName(taggedFriends.slice(0, 2));
      reasons.push({
        kind: "tagged",
        text: `${names(shown, taggedFriends.length, "friend")} ${taggedFriends.length === 1 ? "is" : "are"} tagged in this post.`,
      });
    }
    if (reactions.length >= 40 || post.commentCount >= 15 || post.shareCount >= 10) {
      reasons.push({
        kind: "popular",
        text: "This post has more reactions, comments and shares than other posts you've seen.",
      });
    }
    if (reasons.length === 0) {
      reasons.push({
        kind: "popular",
        text: `This post is public and similar to posts you've engaged with recently.`,
      });
    }

    return {
      author: {
        name: author.name,
        firstName: author.firstName,
        avatar: author.avatar,
        isPage,
      },
      reasons,
    };
  },
});

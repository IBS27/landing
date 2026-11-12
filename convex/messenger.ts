import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { dmBlockNotice } from "./lib/blocks";
import { formatCallDuration } from "./lib/callFormat";
import { viewerMutation, viewerQuery } from "./lib/functions";
import { friendIds, getSummaries, type UserSummary, userSummary } from "./lib/users";
import type { ReactionType } from "./validators";

/**
 * Messenger: inbox, threads, sending, read state and typing indicators.
 * Unread means the member's `lastReadAt` is older than the conversation's last
 * message; sending a message marks the thread read for the sender.
 */

const TYPING_MS = 6_000;

type Ctx = QueryCtx | MutationCtx;

async function membership(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"users">) {
  return ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
}

async function requireMember(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"users">) {
  const [conv, member] = await Promise.all([
    ctx.db.get(conversationId),
    membership(ctx, conversationId, userId),
  ]);
  if (!conv || !member) throw new ConvexError("Not a member of this conversation");
  return { conv, member };
}

/* ---------------- Summaries ---------------- */

function attachmentPreview(
  m: Doc<"messages">,
  who: string,
  fromViewer: boolean,
  isGroup: boolean,
  otherFirst: string,
) {
  const a = m.attachments[0];
  const subject = fromViewer ? "You" : who;
  if (!a) return null;
  if (a.kind === "call") {
    const video = a.media === "video";
    if (a.outcome === "answered")
      return `${video ? "Video" : "Audio"} call · ${formatCallDuration(a.durationMs ?? 0)}`;
    if (isGroup) return `${subject} started a ${video ? "video chat" : "call"}.`;
    if (fromViewer) return `You ${video ? "video " : ""}called ${otherFirst}.`;
    return `You missed a ${video ? "video " : ""}call from ${who}.`;
  }
  if (a.kind === "image") {
    const n = m.attachments.filter((x) => x.kind === "image").length;
    return `${subject} sent ${n > 1 ? `${n} photos` : "a photo"}.`;
  }
  if (a.kind === "sticker") return null;
  return `${subject} sent an attachment.`;
}

/** "You: ok see you then", "Sofia: lol", "Ethan sent a photo.", "You unsent a message". */
function previewText(
  m: Doc<"messages">,
  viewerId: Id<"users">,
  sender: UserSummary | undefined,
  isGroup: boolean,
  otherFirst: string,
) {
  const fromViewer = m.senderId === viewerId;
  const first = sender?.firstName ?? "Someone";
  if (m.unsent) return `${fromViewer ? "You" : first} unsent a message`;
  const prefix = fromViewer ? "You: " : isGroup ? `${first}: ` : "";
  if (m.text) return `${prefix}${m.text}`;
  const att = attachmentPreview(m, first, fromViewer, isGroup, otherFirst);
  if (att) return att;
  const sticker = m.attachments.find((a) => a.kind === "sticker");
  return `${prefix}${sticker?.emoji ?? ""}`;
}

async function summarize(
  ctx: QueryCtx,
  conv: Doc<"conversations">,
  member: Doc<"conversationMembers">,
  viewerId: Id<"users">,
) {
  const [users, listing, last] = await Promise.all([
    getSummaries(ctx, conv.memberIds),
    conv.listingId ? ctx.db.get(conv.listingId) : null,
    conv.lastMessageId ? ctx.db.get(conv.lastMessageId) : null,
  ]);
  const others = conv.memberIds
    .filter((id) => id !== viewerId)
    .map((id) => users.get(id))
    .filter((u): u is UserSummary => u !== undefined);
  const other = others[0] ?? null;

  let name: string;
  let photo: string | null;
  if (conv.kind === "group") {
    name = conv.title ?? (others.map((o) => o.firstName).join(", ") || "Group chat");
    photo = conv.photo ?? null;
  } else if (conv.kind === "marketplace") {
    name = `${other?.firstName ?? "Seller"} · ${listing?.title ?? "Marketplace"}`;
    photo = listing?.photos[0] ?? other?.avatar ?? null;
  } else {
    name = other?.name ?? "Facebook user";
    photo = other?.avatar ?? null;
  }

  return {
    _id: conv._id,
    kind: conv.kind,
    name,
    photo,
    emoji: conv.emoji ?? "👍",
    others,
    memberCount: conv.memberIds.length,
    listing: listing
      ? {
          _id: listing._id,
          title: listing.title,
          price: listing.price,
          photo: listing.photos[0] ?? null,
          status: listing.status,
          sellerId: listing.sellerId,
          city: listing.location.city,
        }
      : null,
    online: others.some((o) => o.online),
    lastActiveAt: Math.max(0, ...others.map((o) => o.lastActiveAt)),
    preview: last
      ? {
          text: previewText(
            last,
            viewerId,
            users.get(last.senderId),
            conv.kind === "group",
            other?.firstName ?? "them",
          ),
          fromViewer: last.senderId === viewerId,
          at: last.createdAt,
        }
      : null,
    lastMessageAt: conv.lastMessageAt,
    unread: member.lastReadAt < conv.lastMessageAt,
    muted: member.muted ?? false,
  };
}
export type ConversationSummary = Awaited<ReturnType<typeof summarize>>;

/* ---------------- Inbox ---------------- */

/** The viewer's conversations, most recent first. */
export const list = viewerQuery({
  args: { limit: v.optional(v.number()), archived: v.optional(v.boolean()) },
  handler: async (ctx, { limit, archived }) => {
    const viewerId = ctx.viewer._id;
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(limit ?? 60);
    const out: ConversationSummary[] = [];
    for (const row of rows) {
      if (Boolean(row.archived) !== Boolean(archived)) continue;
      const conv = await ctx.db.get(row.conversationId);
      // Empty threads (opened but never written in) stay out of the inbox.
      if (!conv?.lastMessageId) continue;
      out.push(await summarize(ctx, conv, row, viewerId));
    }
    return out;
  },
});

/** Header badge: how many conversations have unread messages (muted ones excluded). */
export const unreadCount = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .order("desc")
      .take(100);
    return rows.filter((r) => !r.muted && !r.archived && r.lastReadAt < r.lastMessageAt).length;
  },
});

/** One conversation's header data plus each member's read position (for "Seen"). */
export const get = viewerQuery({
  // A string so a malformed /messages/t/<id> URL renders "not available" instead of throwing.
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const viewerId = ctx.viewer._id;
    const conversationId = ctx.db.normalizeId("conversations", args.conversationId);
    if (!conversationId) return null;
    const [conv, member] = await Promise.all([
      ctx.db.get(conversationId),
      membership(ctx, conversationId, viewerId),
    ]);
    if (!conv || !member) return null;
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const users = await getSummaries(
      ctx,
      rows.map((r) => r.userId),
    );
    const members = rows
      .map((r) => {
        const u = users.get(r.userId);
        return u ? { ...u, lastReadAt: r.lastReadAt } : null;
      })
      .filter((m) => m !== null);
    return { ...(await summarize(ctx, conv, member, viewerId)), members };
  },
});

/* ---------------- Messages ---------------- */

async function enrichAttachments(ctx: QueryCtx, m: Doc<"messages">) {
  return Promise.all(
    m.attachments.map(async (a) => {
      if (a.kind === "listing") {
        const l = await ctx.db.get(a.listingId);
        return {
          kind: "listing" as const,
          listingId: a.listingId,
          title: l?.title ?? "Listing unavailable",
          price: l?.price ?? 0,
          photo: l?.photos[0] ?? null,
          city: l?.location.city ?? "",
          status: l?.status ?? "sold",
        };
      }
      if (a.kind === "post") {
        const p = await ctx.db.get(a.postId);
        const author = p ? await ctx.db.get(p.authorId) : null;
        return {
          kind: "post" as const,
          postId: a.postId,
          text: p?.text ?? "",
          image: p?.media.find((x) => x.kind === "image")?.url ?? null,
          author: author ? userSummary(author) : null,
        };
      }
      return a;
    }),
  );
}

async function messageView(ctx: QueryCtx, m: Doc<"messages">) {
  const [attachments, reactionRows, reply] = await Promise.all([
    m.unsent ? Promise.resolve([]) : enrichAttachments(ctx, m),
    ctx.db
      .query("reactions")
      .withIndex("by_target", (q) => q.eq("targetType", "message").eq("targetId", m._id))
      .collect(),
    m.replyToId ? ctx.db.get(m.replyToId) : null,
  ]);
  return {
    _id: m._id,
    senderId: m.senderId,
    createdAt: m.createdAt,
    status: m.status,
    author: m.author,
    text: m.unsent ? undefined : m.text,
    unsent: m.unsent ?? false,
    attachments,
    reactions: reactionRows.map((r) => ({ userId: r.userId, type: r.type as ReactionType })),
    replyTo: reply
      ? {
          _id: reply._id,
          senderId: reply.senderId,
          text: reply.unsent ? undefined : reply.text,
          unsent: reply.unsent ?? false,
          image: reply.unsent
            ? null
            : (reply.attachments.find((a) => a.kind === "image")?.url ?? null),
          sticker: reply.attachments.find((a) => a.kind === "sticker")?.emoji ?? null,
          attachment: reply.attachments.some((a) => a.kind === "listing" || a.kind === "post"),
        }
      : null,
  };
}
export type MessageView = Awaited<ReturnType<typeof messageView>>;

/**
 * Messages newest first. Only sent messages are shared; drafts and pending
 * agent messages are visible to their sender alone.
 */
export const messages = viewerQuery({
  args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { conversationId, paginationOpts }) => {
    const viewerId = ctx.viewer._id;
    const member = await membership(ctx, conversationId, viewerId);
    if (!member) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .filter((q) => q.or(q.eq(q.field("status"), "sent"), q.eq(q.field("senderId"), viewerId)))
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((m) => messageView(ctx, m))) };
  },
});

/** Photos shared in a conversation, newest first (info panel "Media"). */
export const media = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const member = await membership(ctx, conversationId, ctx.viewer._id);
    if (!member) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(500);
    const out: { messageId: Id<"messages">; url: string }[] = [];
    for (const m of rows) {
      if (m.unsent || m.status !== "sent") continue;
      for (const a of m.attachments)
        if (a.kind === "image") out.push({ messageId: m._id, url: a.url });
    }
    return out;
  },
});

/** Text search inside one conversation (info panel "Search"). */
export const search = viewerQuery({
  args: { conversationId: v.id("conversations"), q: v.string() },
  handler: async (ctx, { conversationId, q }) => {
    const term = q.trim().toLowerCase();
    const member = await membership(ctx, conversationId, ctx.viewer._id);
    if (!member || term.length === 0) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (x) => x.eq("conversationId", conversationId))
      .order("desc")
      .take(1000);
    const hits = rows.filter(
      (m) => !m.unsent && m.status === "sent" && m.text?.toLowerCase().includes(term),
    );
    const users = await getSummaries(
      ctx,
      hits.map((m) => m.senderId),
    );
    return hits.slice(0, 50).map((m) => ({
      _id: m._id,
      text: m.text ?? "",
      createdAt: m.createdAt,
      sender: users.get(m.senderId) ?? null,
    }));
  },
});

/** Users currently typing in a conversation (the client hides rows past `until`). */
export const typing = viewerQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const others = rows.filter((r) => r.userId !== ctx.viewer._id);
    const users = await getSummaries(
      ctx,
      others.map((r) => r.userId),
    );
    return others
      .map((r) => ({ user: users.get(r.userId), until: r.until }))
      .filter((r): r is { user: UserSummary; until: number } => r.user !== undefined);
  },
});

/** People and group chats for the "To:" field and Messenger search. */
export const searchPeople = viewerQuery({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const viewerId = ctx.viewer._id;
    const term = q.trim().toLowerCase();
    const ids = await friendIds(ctx, viewerId);
    const users = [...(await getSummaries(ctx, ids)).values()].filter((u) => u.kind === "person");
    const recent = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (x) => x.eq("userId", viewerId))
      .order("desc")
      .take(40);
    const rank = new Map<Id<"users">, number>();
    const groups: {
      _id: Id<"conversations">;
      name: string;
      photo: string | null;
      others: UserSummary[];
    }[] = [];
    for (const [i, row] of recent.entries()) {
      const conv = await ctx.db.get(row.conversationId);
      if (!conv) continue;
      if (conv.kind === "dm") {
        const other = conv.memberIds.find((id) => id !== viewerId);
        if (other && !rank.has(other)) rank.set(other, i);
      } else if (conv.kind === "group") {
        const s = await summarize(ctx, conv, row, viewerId);
        if (!term || s.name.toLowerCase().includes(term))
          groups.push({ _id: s._id, name: s.name, photo: s.photo, others: s.others.slice(0, 2) });
      }
    }
    const people = users
      .filter(
        (u) =>
          !term ||
          u.name
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.startsWith(term)) ||
          u.name.toLowerCase().startsWith(term),
      )
      .sort(
        (a, b) =>
          (rank.get(a._id) ?? 999) - (rank.get(b._id) ?? 999) || a.name.localeCompare(b.name),
      )
      .slice(0, 20);
    return { people, groups: groups.slice(0, 6) };
  },
});

/* ---------------- Mutations ---------------- */

async function createConversation(
  ctx: MutationCtx,
  kind: "dm" | "group",
  memberIds: Id<"users">[],
  title?: string,
) {
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    kind,
    title,
    memberIds,
    createdAt: now,
    lastMessageAt: now,
  });
  for (const userId of memberIds)
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId,
      lastReadAt: now,
      lastMessageAt: now,
    });
  return conversationId;
}

/** The viewer's 1:1 thread with a person, created empty on first open. */
export const getOrCreateDm = viewerMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = ctx.viewer._id;
    const mine = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .collect();
    for (const m of mine) {
      const c = await ctx.db.get(m.conversationId);
      const self = userId === viewerId;
      if (
        c?.kind === "dm" &&
        c.memberIds.includes(userId) &&
        (self ? c.memberIds.every((id) => id === viewerId) : c.memberIds.length === 2)
      )
        return c._id;
    }
    return createConversation(ctx, "dm", userId === viewerId ? [viewerId] : [viewerId, userId]);
  },
});

/** A new group chat with the viewer and the chosen people. */
export const createGroup = viewerMutation({
  args: { userIds: v.array(v.id("users")), title: v.optional(v.string()) },
  handler: async (ctx, { userIds, title }) => {
    const ids = [...new Set([ctx.viewer._id, ...userIds])];
    if (ids.length < 3) throw new ConvexError("A group needs at least two other people");
    return createConversation(ctx, "group", ids, title?.trim() || undefined);
  },
});

export const generateUploadUrl = viewerMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const send = viewerMutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.optional(v.string()),
    images: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }),
      ),
    ),
    sticker: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, { conversationId, text, images, sticker, replyToId }) => {
    const viewerId = ctx.viewer._id;
    const { conv } = await requireMember(ctx, conversationId, viewerId);
    // 1:1 threads close while either person has blocked the other.
    const blocked = await dmBlockNotice(ctx, conv, viewerId);
    if (blocked) throw new ConvexError(blocked);
    const attachments: Doc<"messages">["attachments"] = [];
    for (const img of images ?? []) {
      const url = await ctx.storage.getUrl(img.storageId);
      if (url) attachments.push({ kind: "image", url, width: img.width, height: img.height });
    }
    if (sticker) attachments.push({ kind: "sticker", emoji: sticker });
    const body = text?.trim() || undefined;
    if (!body && attachments.length === 0) throw new ConvexError("Empty message");
    if (replyToId) {
      const r = await ctx.db.get(replyToId);
      if (r?.conversationId !== conversationId) throw new ConvexError("Bad reply target");
    }

    return insertMessage(ctx, conv._id, viewerId, { text: body, attachments, replyToId });
  },
});

/** Appends a sent message, bumps the thread for every member and marks it read for the sender. */
export async function insertMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  senderId: Id<"users">,
  fields: Pick<Doc<"messages">, "text" | "attachments" | "replyToId">,
) {
  const now = Date.now();
  const messageId = await ctx.db.insert("messages", {
    conversationId,
    senderId,
    author: { kind: "human" },
    status: "sent",
    ...fields,
    createdAt: now,
  });
  await ctx.db.patch(conversationId, { lastMessageAt: now, lastMessageId: messageId });
  const rows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  for (const r of rows)
    await ctx.db.patch(r._id, {
      lastMessageAt: now,
      archived: undefined,
      ...(r.userId === senderId ? { lastReadAt: now } : {}),
    });
  await clearTyping(ctx, conversationId, senderId);
  return messageId;
}

/* ---------------- End-to-end encryption PIN ---------------- */

async function pinRow(ctx: Ctx, userId: Id<"users">) {
  return ctx.db
    .query("messengerPins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether Messenger should gate chats behind "Create a PIN" for the viewer. */
export const pinStatus = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const row = await pinRow(ctx, ctx.viewer._id);
    const hasPin = Boolean(row?.pinHash);
    return { hasPin, prompt: !hasPin && !row?.dismissedAt };
  },
});

/** Stores a 6-digit PIN as a salted SHA-256 hash. */
export const createPin = viewerMutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!/^\d{6}$/.test(pin)) throw new ConvexError("Your PIN must be 6 digits");
    const salt = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const fields = { pinHash: await sha256Hex(`${salt}:${pin}`), salt, createdAt: Date.now() };
    const row = await pinRow(ctx, ctx.viewer._id);
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("messengerPins", { userId: ctx.viewer._id, ...fields });
  },
});

/** "Not now": stop prompting this persona for a PIN. */
export const dismissPinPrompt = viewerMutation({
  args: {},
  handler: async (ctx) => {
    const row = await pinRow(ctx, ctx.viewer._id);
    if (row) await ctx.db.patch(row._id, { dismissedAt: Date.now() });
    else await ctx.db.insert("messengerPins", { userId: ctx.viewer._id, dismissedAt: Date.now() });
  },
});

/** Unsend for everyone: the bubble stays as "You unsent a message". */
export const unsend = viewerMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const m = await ctx.db.get(messageId);
    if (!m || m.senderId !== ctx.viewer._id) throw new ConvexError("Can't unsend this message");
    await ctx.db.patch(messageId, { unsent: true, text: undefined, attachments: [] });
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_target", (q) => q.eq("targetType", "message").eq("targetId", messageId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);
  },
});

export const markRead = viewerMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const { conv, member } = await requireMember(ctx, conversationId, ctx.viewer._id);
    if (member.lastReadAt < conv.lastMessageAt)
      await ctx.db.patch(member._id, { lastReadAt: Math.max(Date.now(), conv.lastMessageAt) });
  },
});

export const markUnread = viewerMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const { conv, member } = await requireMember(ctx, conversationId, ctx.viewer._id);
    await ctx.db.patch(member._id, { lastReadAt: conv.lastMessageAt - 1 });
  },
});

export const setMuted = viewerMutation({
  args: { conversationId: v.id("conversations"), muted: v.boolean() },
  handler: async (ctx, { conversationId, muted }) => {
    const { member } = await requireMember(ctx, conversationId, ctx.viewer._id);
    await ctx.db.patch(member._id, { muted: muted || undefined });
  },
});

/** Archive hides the chat until a new message arrives. */
export const archive = viewerMutation({
  args: { conversationId: v.id("conversations"), archived: v.optional(v.boolean()) },
  handler: async (ctx, { conversationId, archived }) => {
    const { member } = await requireMember(ctx, conversationId, ctx.viewer._id);
    await ctx.db.patch(member._id, { archived: (archived ?? true) || undefined });
  },
});

export const rename = viewerMutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, { conversationId, title }) => {
    const { conv } = await requireMember(ctx, conversationId, ctx.viewer._id);
    if (conv.kind !== "group") throw new ConvexError("Only group chats have names");
    await ctx.db.patch(conversationId, { title: title.trim() || undefined });
  },
});

export const setEmoji = viewerMutation({
  args: { conversationId: v.id("conversations"), emoji: v.string() },
  handler: async (ctx, { conversationId, emoji }) => {
    await requireMember(ctx, conversationId, ctx.viewer._id);
    await ctx.db.patch(conversationId, { emoji: emoji === "👍" ? undefined : emoji });
  },
});

async function clearTyping(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("typing")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  for (const r of rows) if (r.userId === userId) await ctx.db.delete(r._id);
}

/** Called (throttled) while the viewer types; `false` clears the indicator. */
export const setTyping = viewerMutation({
  args: { conversationId: v.id("conversations"), typing: v.boolean() },
  handler: async (ctx, { conversationId, typing }) => {
    const viewerId = ctx.viewer._id;
    await requireMember(ctx, conversationId, viewerId);
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const mine = rows.find((r) => r.userId === viewerId);
    if (!typing) {
      if (mine) await ctx.db.delete(mine._id);
      return;
    }
    const until = Date.now() + TYPING_MS;
    if (mine) await ctx.db.patch(mine._id, { until });
    else await ctx.db.insert("typing", { conversationId, userId: viewerId, until });
  },
});

/** The existing thread with exactly these people (DM or group), for the "New message" composer. */
export const findThread = viewerQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const viewerId = ctx.viewer._id;
    const want = new Set([viewerId, ...userIds]);
    if (userIds.length === 0) return null;
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .collect();
    for (const row of rows) {
      const c = await ctx.db.get(row.conversationId);
      if (!c || c.kind === "marketplace" || c.memberIds.length !== want.size) continue;
      if (userIds.length > 1 && c.kind !== "group") continue;
      if (c.memberIds.every((id) => want.has(id))) return c._id;
    }
    return null;
  },
});

/** Leave a group chat; it disappears from the viewer's inbox. */
export const leaveGroup = viewerMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const viewerId = ctx.viewer._id;
    const { conv, member } = await requireMember(ctx, conversationId, viewerId);
    if (conv.kind !== "group") throw new ConvexError("Only group chats can be left");
    await ctx.db.delete(member._id);
    await ctx.db.patch(conversationId, {
      memberIds: conv.memberIds.filter((id) => id !== viewerId),
    });
    await clearTyping(ctx, conversationId, viewerId);
  },
});

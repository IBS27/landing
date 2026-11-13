import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Poll } from "../validators";

/**
 * Polls in group chats (#34). A poll is a message attachment; each person's
 * picks are one `pollVotes` row. Everyone in the chat sees who picked what,
 * like Messenger's polls.
 */

/** Plenty for a group chat; Messenger caps group chats well below this. */
const VOTES_READ = 250;

export function pollOf(m: Doc<"messages">): Poll | null {
  const a = m.attachments.find((x) => x.kind === "poll");
  return a?.kind === "poll"
    ? { question: a.question, options: a.options, closesAt: a.closesAt }
    : null;
}

export async function votesFor(ctx: QueryCtx, messageId: Id<"messages">) {
  return ctx.db
    .query("pollVotes")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .take(VOTES_READ);
}

export type PollVote = { userId: Id<"users">; optionIds: string[] };

/** The poll as chat members see it: each option with who picked it. */
export async function pollView(ctx: QueryCtx, messageId: Id<"messages">, poll: Poll) {
  const votes = await votesFor(ctx, messageId);
  return {
    kind: "poll" as const,
    messageId,
    question: poll.question,
    closesAt: poll.closesAt ?? null,
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      startAt: o.startAt ?? null,
      voterIds: votes.filter((v) => v.optionIds.includes(o.id)).map((v) => v.userId),
    })),
    voterCount: votes.filter((v) => v.optionIds.length > 0).length,
  };
}

export function pollClosed(poll: Pick<Poll, "closesAt">, now: number): boolean {
  return poll.closesAt !== undefined && poll.closesAt <= now;
}

/**
 * The option to plan around: the most votes among options still at least
 * `after` away (options without a time always qualify), then the earliest, then
 * poll order. Null when nobody picked anything that's still ahead.
 */
export function pollWinner(
  poll: Poll,
  votes: readonly PollVote[],
  after: number,
): { id: string; label: string; startAt?: number; votes: number } | null {
  let best: { id: string; label: string; startAt?: number; votes: number } | null = null;
  for (const o of poll.options) {
    if (o.startAt !== undefined && o.startAt < after) continue;
    const n = votes.filter((v) => v.optionIds.includes(o.id)).length;
    if (n === 0) continue;
    const better =
      !best ||
      n > best.votes ||
      (n === best.votes && (o.startAt ?? Infinity) < (best.startAt ?? Infinity));
    if (better) best = { id: o.id, label: o.label, startAt: o.startAt, votes: n };
  }
  return best;
}

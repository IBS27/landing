import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { ReactionType } from "../../../convex/validators";

export type Conversation = FunctionReturnType<typeof api.messenger.list>[number];
export type ConversationDetail = NonNullable<FunctionReturnType<typeof api.messenger.get>>;
export type Message = FunctionReturnType<typeof api.messenger.messages>["page"][number];
export type Member = ConversationDetail["members"][number];

/** Messenger reacts with emoji rather than Facebook's reaction faces. */
export const MESSAGE_REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😆", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😠", label: "Angry" },
  { type: "like", emoji: "👍", label: "Like" },
];
const CARE = { type: "care" as const, emoji: "🥰", label: "Care" };
export const reactionEmoji = (t: ReactionType) =>
  (MESSAGE_REACTIONS.find((r) => r.type === t) ?? CARE).emoji;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Inbox age: "1m", "2h", "3d", "1w", "2y". */
export function chatAge(ts: number, now = Date.now()) {
  const d = Math.max(0, now - ts);
  if (d < HOUR) return `${Math.max(1, Math.floor(d / MIN))}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  if (d < 365 * DAY) return `${Math.floor(d / (7 * DAY))}w`;
  return `${Math.floor(d / (365 * DAY))}y`;
}

/** Presence line under a name: "Active now", "Active 12m ago", "Active 3h ago". */
export function activeLabel(online: boolean, lastActiveAt: number, now = Date.now()) {
  if (online) return "Active now";
  const d = now - lastActiveAt;
  if (d < HOUR) return `Active ${Math.max(1, Math.floor(d / MIN))}m ago`;
  if (d < DAY) return `Active ${Math.floor(d / HOUR)}h ago`;
  return null;
}

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Centered thread separators: "2:14 PM", "Wed 2:14 PM", "Oct 28, 2:14 PM", "Oct 28, 2025, 2:14 PM". */
export function separatorTime(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return time.format(d);
  if (now - ts < 6 * DAY) return `${weekday.format(d)} ${time.format(d)}`;
  if (d.getFullYear() === n.getFullYear()) return `${monthDay.format(d)}, ${time.format(d)}`;
  return `${monthDayYear.format(d)}, ${time.format(d)}`;
}

/** Messages further apart than this get a timestamp separator. */
export const SEPARATOR_GAP = 20 * MIN;

/** Single-emoji texts render large without a bubble. */
export function isBigEmoji(text: string | undefined) {
  if (!text) return false;
  const t = text.trim();
  return t.length <= 8 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u.test(t);
}

export const STICKERS = [
  "👍",
  "❤️",
  "😂",
  "😍",
  "🥹",
  "😭",
  "🔥",
  "🎉",
  "🙏",
  "😅",
  "🤯",
  "👀",
  "💯",
  "😎",
  "🥳",
  "🤔",
  "😴",
  "🫶",
];

export const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "🤣",
  "😂",
  "🙂",
  "😉",
  "😊",
  "😇",
  "🥰",
  "😍",
  "🤩",
  "😘",
  "😋",
  "😛",
  "😜",
  "🤪",
  "😝",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🤐",
  "😐",
  "😑",
  "😶",
  "😏",
  "😒",
  "🙄",
  "😬",
  "😌",
  "😔",
  "😪",
  "😴",
  "😷",
  "🤒",
  "🥵",
  "🥶",
  "🥴",
  "😵",
  "🤯",
  "🤠",
  "🥳",
  "😎",
  "🤓",
  "😕",
  "😟",
  "🙁",
  "😮",
  "😯",
  "😲",
  "😳",
  "🥺",
  "🥹",
  "😦",
  "😧",
  "😨",
  "😰",
  "😥",
  "😢",
  "😭",
  "😱",
  "😖",
  "😣",
  "😞",
  "😓",
  "😩",
  "😫",
  "🥱",
  "😤",
  "😡",
  "😠",
  "🤬",
  "😈",
  "💀",
  "💩",
  "🤡",
  "👍",
  "👎",
  "👏",
  "🙌",
  "👐",
  "🤝",
  "🙏",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "👌",
  "👋",
  "💪",
  "🫶",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "💔",
  "💯",
  "🔥",
  "✨",
  "🎉",
  "🎂",
  "☕",
  "🍕",
  "🌧️",
  "🌲",
];

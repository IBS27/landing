import type { ReactNode } from "react";
import { ReactionIcon } from "@/features/posts";
import type { NotificationView } from "./types";

type Kind = NotificationView["kind"];

/** Filled 16px glyphs drawn on Facebook's coloured notification badges. */
const glyph: Record<string, ReactNode> = {
  comment: (
    <path d="M8 1.5C4.13 1.5 1 4.3 1 7.75c0 1.86.92 3.53 2.37 4.67-.1.9-.5 1.78-1.1 2.43a.4.4 0 0 0 .32.67c1.56-.09 2.84-.68 3.73-1.4.53.12 1.1.18 1.68.18 3.87 0 7-2.8 7-6.55S11.87 1.5 8 1.5Z" />
  ),
  person: (
    <path d="M8 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5ZM2.5 13.2C2.5 10.9 4.96 9.25 8 9.25s5.5 1.65 5.5 3.95v.55c0 .55-.45 1-1 1h-9a1 1 0 0 1-1-1v-.55Z" />
  ),
  group: (
    <path d="M8 2.25a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-4.75 1.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Zm9.5 0a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM8 8.5c-2.4 0-4.25 1.4-4.25 3.25v.75c0 .55.45 1 1 1h6.5c.55 0 1-.45 1-1v-.75C12.25 9.9 10.4 8.5 8 8.5Zm-5.17.5C1.3 9.2.25 10.25.25 11.5v.5c0 .41.34.75.75.75h1.5v-1c0-1.05.37-2 1.02-2.76A3.6 3.6 0 0 0 2.83 9Zm10.34 0c-.23 0-.47.02-.69.05.65.75 1.02 1.7 1.02 2.75v1H15c.41 0 .75-.34.75-.75v-.5c0-1.25-1.05-2.3-2.58-2.55Z" />
  ),
  tag: (
    <path d="M1.5 2.75c0-.69.56-1.25 1.25-1.25h4.4c.33 0 .65.13.88.37l6.5 6.5a1.25 1.25 0 0 1 0 1.76l-4.4 4.4a1.25 1.25 0 0 1-1.76 0l-6.5-6.5a1.25 1.25 0 0 1-.37-.88v-4.4ZM5 6.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
  ),
  calendar: (
    <path d="M5 .75a.75.75 0 0 0-1.5 0V1.5H3A2.5 2.5 0 0 0 .5 4v9A2.5 2.5 0 0 0 3 15.5h10a2.5 2.5 0 0 0 2.5-2.5V4A2.5 2.5 0 0 0 13 1.5h-.5V.75a.75.75 0 0 0-1.5 0V1.5H5V.75ZM2 6.5h12V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Zm2.25 1.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" />
  ),
  store: (
    <path d="M2.2 1.5h11.6l1.45 3.6c.5 1.24-.34 2.65-1.7 2.65a1.9 1.9 0 0 1-1.78-1.24 1.9 1.9 0 0 1-3.54 0 1.9 1.9 0 0 1-3.54 0 1.9 1.9 0 0 1-1.78 1.24c-1.36 0-2.2-1.4-1.7-2.65L2.2 1.5ZM2 9.1c.26.08.53.13.81.13.83 0 1.6-.33 2.15-.87a3.4 3.4 0 0 0 3.04.86 3.4 3.4 0 0 0 3.04-.86c.56.54 1.32.87 2.15.87.28 0 .55-.05.81-.13V13a1.5 1.5 0 0 1-1.5 1.5H10v-3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v3H3.5A1.5 1.5 0 0 1 2 13V9.1Z" />
  ),
  cake: (
    <path d="M8 .5c.4.6 1.25 1.6 1.25 2.5a1.25 1.25 0 0 1-2.5 0C6.75 2.1 7.6 1.1 8 .5Zm-.75 4.75h1.5v1.5H12A2.5 2.5 0 0 1 14.5 9.25v.6c-.6.3-1.17.4-1.6.4-.63 0-1.04-.25-1.53-.55-.53-.33-1.15-.7-2.12-.7s-1.59.37-2.12.7c-.5.3-.9.55-1.53.55s-1.04-.25-1.53-.55A3.4 3.4 0 0 0 1.5 9.1v.15A2.5 2.5 0 0 1 4 6.75h3.25v-1.5ZM1.5 10.94c.2.08.37.18.55.3.53.32 1.15.71 2.11.71.97 0 1.59-.39 2.12-.71.49-.3.9-.55 1.53-.55.63 0 1.04.25 1.53.55.53.32 1.15.71 2.12.71.6 0 1.1-.13 1.54-.32V14.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-3.56Z" />
  ),
  clock: (
    <path d="M8 .5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 3.75a.75.75 0 0 0-1.5 0V8c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.25Z" />
  ),
  video: (
    <path d="M1 4.75A2.25 2.25 0 0 1 3.25 2.5h6.5A2.25 2.25 0 0 1 12 4.75v6.5a2.25 2.25 0 0 1-2.25 2.25h-6.5A2.25 2.25 0 0 1 1 11.25v-6.5Zm12 1.6 1.9-1.27a.7.7 0 0 1 1.1.58v4.68a.7.7 0 0 1-1.1.58L13 9.65v-3.3Z" />
  ),
  bell: (
    <path d="M8 .75a4.75 4.75 0 0 0-4.75 4.75v2.7L1.9 10.4A1 1 0 0 0 2.75 12h10.5a1 1 0 0 0 .85-1.6l-1.35-2.2V5.5A4.75 4.75 0 0 0 8 .75ZM6 13.25a2 2 0 0 0 4 0H6Z" />
  ),
};

const BADGE: Record<Kind, { bg: string; icon: keyof typeof glyph }> = {
  reaction: { bg: "#0866FF", icon: "bell" },
  comment: { bg: "#45BD62", icon: "comment" },
  reply: { bg: "#45BD62", icon: "comment" },
  mention: { bg: "#0866FF", icon: "tag" },
  friend_request: { bg: "#0866FF", icon: "person" },
  friend_accept: { bg: "#0866FF", icon: "person" },
  group_post: { bg: "#0866FF", icon: "group" },
  group_invite: { bg: "#0866FF", icon: "group" },
  event_invite: { bg: "#F3425F", icon: "calendar" },
  event_reminder: { bg: "#F3425F", icon: "calendar" },
  listing_message: { bg: "#0866FF", icon: "store" },
  listing_saved: { bg: "#0866FF", icon: "store" },
  birthday: { bg: "#F3425F", icon: "cake" },
  memory: { bg: "#0866FF", icon: "clock" },
  live: { bg: "#F3425F", icon: "video" },
};

/** The 28px badge overlapping a notification avatar's bottom-right corner. */
export function KindBadge({ n, size = 28 }: { n: NotificationView; size?: number }) {
  if (n.kind === "reaction" && n.reaction)
    return <ReactionIcon type={n.reaction} size={size} className="rounded-full" />;
  const b = BADGE[n.kind];
  return (
    <span
      className="flex items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: b.bg }}
    >
      <svg
        viewBox="0 0 16 16"
        width={size * 0.57}
        height={size * 0.57}
        fill="currentColor"
        fillRule="evenodd"
        aria-hidden
      >
        {glyph[b.icon]}
      </svg>
    </span>
  );
}

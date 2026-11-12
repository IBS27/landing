import type { SVGProps } from "react";

/** Messenger glyphs (chat headers, composer, dock). Filled, `currentColor`. */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, viewBox = "0 0 24 24", children, ...p }: P) {
  return (
    <svg viewBox={viewBox} width={size} height={size} fill="currentColor" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export function PhoneIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M7.14 2.53a2 2 0 0 0-2.33-.45L3.4 2.8A3.2 3.2 0 0 0 1.75 6.3c1.33 7.4 8.55 14.62 15.95 15.95a3.2 3.2 0 0 0 3.5-1.65l.72-1.41a2 2 0 0 0-.45-2.33l-2.48-2.24a2 2 0 0 0-2.52-.13l-1.58 1.14a.8.8 0 0 1-.9.03 15.7 15.7 0 0 1-5.02-5.02.8.8 0 0 1 .03-.9l1.14-1.58a2 2 0 0 0-.13-2.52L7.14 2.53Z" />
    </Svg>
  );
}

export function VideoCallIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M1.5 7.5A3.5 3.5 0 0 1 5 4h8.5A3.5 3.5 0 0 1 17 7.5v9a3.5 3.5 0 0 1-3.5 3.5H5a3.5 3.5 0 0 1-3.5-3.5v-9Zm17 2.06 2.95-2.2A1 1 0 0 1 23 8.17v7.66a1 1 0 0 1-1.55.81l-2.95-2.2V9.56Z" />
    </Svg>
  );
}

export function MinimizeIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="2.2" rx="1.1" />
    </Svg>
  );
}

export function CloseIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M5.3 5.3a1 1 0 0 1 1.4 0L12 10.6l5.3-5.3a1 1 0 1 1 1.4 1.4L13.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4L12 13.4l-5.3 5.3a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4Z" />
    </Svg>
  );
}

export function InfoIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5Zm0 4.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm1.3 11.4a1.3 1.3 0 0 1-2.6 0v-5.6a1.3 1.3 0 0 1 2.6 0v5.6Z" />
    </Svg>
  );
}

export function PlusCircleIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5Zm1.1 15a1.1 1.1 0 0 1-2.2 0v-3.4H7.5a1.1 1.1 0 0 1 0-2.2h3.4V7.5a1.1 1.1 0 0 1 2.2 0v3.4h3.4a1.1 1.1 0 0 1 0 2.2h-3.4v3.4Z" />
    </Svg>
  );
}

export function ImageIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3Zm10 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM4.5 17.9v.6a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2.3l-3.4-3a1 1 0 0 0-1.3 0l-2.1 1.8-4.2-4.3a1 1 0 0 0-1.43 0L4.5 13.4v4.5Z" />
    </Svg>
  );
}

export function StickerIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M6 2.5h12A3.5 3.5 0 0 1 21.5 6v6.5h-5A4 4 0 0 0 12.5 16.5v5H6A3.5 3.5 0 0 1 2.5 18V6A3.5 3.5 0 0 1 6 2.5Zm2.7 6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm6.6 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6ZM14.5 21v-4.5a2 2 0 0 1 2-2H21a6 6 0 0 1-6.5 6.5Z" />
    </Svg>
  );
}

export function GifIcon(p: P) {
  return (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M5.5 3.5h13a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3Zm3.15 5.3c-1.65 0-2.85 1.3-2.85 3.2s1.2 3.2 2.85 3.2c.95 0 1.6-.36 2.05-.86a.8.8 0 0 0 .2-.53v-1.8a.6.6 0 0 0-.6-.6H8.9a.6.6 0 0 0 0 1.2h.9v.95c-.27.25-.65.4-1.1.4-.98 0-1.6-.8-1.6-1.96 0-1.17.62-1.96 1.55-1.96.45 0 .8.15 1.08.42a.62.62 0 0 0 .87-.88A2.68 2.68 0 0 0 8.65 8.8Zm4.23.07a.63.63 0 0 0-.63.63v5a.63.63 0 0 0 1.26 0v-5a.63.63 0 0 0-.63-.63Zm2.37 0a.63.63 0 0 0-.63.63v5a.63.63 0 0 0 1.26 0v-1.9h1.72a.6.6 0 0 0 0-1.2h-1.72v-1.33h2.02a.6.6 0 0 0 0-1.2h-2.65Z"
      />
    </Svg>
  );
}

export function SmileIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5ZM8.5 7.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm1.27 6.9A5.6 5.6 0 0 1 12 17.6a5.6 5.6 0 0 1-4.77-3.1.85.85 0 0 1 .75-1.25h8.04c.64 0 1.05.69.75 1.25Z" />
    </Svg>
  );
}

export function SendArrowIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3.4 2.6a1.2 1.2 0 0 1 1.32-.17l16.9 8.45a1.25 1.25 0 0 1 0 2.24L4.72 21.57a1.2 1.2 0 0 1-1.66-1.47L5.4 13.2h7.1a1.2 1.2 0 0 0 0-2.4H5.4L3.06 3.9a1.2 1.2 0 0 1 .34-1.3Z" />
    </Svg>
  );
}

/** Messenger's blue thumbs-up (the default quick reaction). */
export function ThumbIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M16.6 8.9h3.06c1.5 0 2.6 1.43 2.2 2.88l-1.95 7.13A3.2 3.2 0 0 1 16.83 21.3H9.6a1.6 1.6 0 0 1-1.6-1.6v-9.1c0-.5.15-.98.42-1.4l3.88-5.86c.33-.5.88-.79 1.47-.79h.3c1.26 0 2.17 1.2 1.84 2.42L16.6 8.9ZM3.6 10h1.6a1.1 1.1 0 0 1 1.1 1.1v9.1a1.1 1.1 0 0 1-1.1 1.1H3.6a1.6 1.6 0 0 1-1.6-1.6v-8.1A1.6 1.6 0 0 1 3.6 10Z" />
    </Svg>
  );
}

export function ComposeIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M17.3 2.3a2.5 2.5 0 0 1 3.54 0l.86.86a2.5 2.5 0 0 1 0 3.54l-8.43 8.43a2.5 2.5 0 0 1-1.13.65l-3.15.86a1 1 0 0 1-1.23-1.23l.86-3.15c.11-.43.34-.82.65-1.13L17.3 2.3ZM5.5 3.5h6.25a1 1 0 1 1 0 2H5.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.25a1 1 0 1 1 2 0v6.25a3 3 0 0 1-3 3h-12a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3Z" />
    </Svg>
  );
}

export function ExpandIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M14 3h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V6.41l-4.3 4.3a1 1 0 0 1-1.4-1.42L17.58 5H14a1 1 0 1 1 0-2ZM4 13a1 1 0 0 1 1 1v3.59l4.3-4.3a1 1 0 0 1 1.4 1.42L6.42 19H10a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

export function DotsIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </Svg>
  );
}

export function DotsVerticalIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </Svg>
  );
}

export function ReplyIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M10.3 4.3a1 1 0 0 1 0 1.4L7.42 8.6H14a7.5 7.5 0 0 1 7.5 7.5v2.4a1 1 0 1 1-2 0v-2.4a5.5 5.5 0 0 0-5.5-5.5H7.41l2.9 2.9a1 1 0 0 1-1.42 1.4l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 0 1 1.42 0Z" />
    </Svg>
  );
}

export function SmileOutlineIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 2a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.6 9.05a.9.9 0 0 1 .4 1.2A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4-2.45.9.9 0 1 1 1.6-.8c.43.83 1.33 1.45 2.4 1.45s1.97-.62 2.4-1.45a.9.9 0 0 1 1.2-.4ZM9 8.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm6 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z" />
    </Svg>
  );
}

export function BellOffIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3.3 2.3a1 1 0 0 0-1.4 1.4l18.8 18.8a1 1 0 0 0 1.4-1.4l-2.6-2.6h.3a1.3 1.3 0 0 0 1.1-2 8 8 0 0 1-1.2-4.2V9.5A7.7 7.7 0 0 0 7.2 3.82L3.3 2.3Zm1.12 6.06A8 8 0 0 0 4.3 9.5v2.8a8 8 0 0 1-1.2 4.2 1.3 1.3 0 0 0 1.1 2h11.86L4.42 8.36ZM9.1 19.6a3 3 0 0 0 5.8 0H9.1Z" />
    </Svg>
  );
}

/** Small read/sent tick under the newest outgoing message. */
export function SentIcon(p: P) {
  return (
    <svg viewBox="0 0 14 14" width={p.size ?? 14} height={p.size ?? 14} aria-hidden {...p}>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.3 7.2 6.1 9l3.6-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Empty-state illustration: speech bubble with the Messenger gradient cursor. */
export function NoChatsIllustration() {
  return (
    <svg viewBox="0 0 136 124" width="136" height="124" aria-hidden>
      <defs>
        <linearGradient id="msgr-cursor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D532FF" />
          <stop offset=".55" stopColor="#8F3BFF" />
          <stop offset="1" stopColor="#0A7CFF" />
        </linearGradient>
      </defs>
      <path
        d="M68 6C34 6 6 26 6 52c0 15 9 28 23 36v18c0 4 4.5 6 7.6 3.4L52 96.5c5 1 10.3 1.5 16 1.5 34 0 62-20 62-46S102 6 68 6Z"
        fill="none"
        stroke="var(--primary-text)"
        strokeOpacity=".85"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M56 30c0-2.3 2.6-3.7 4.6-2.4l22 14.4c2 1.3 1.6 4.3-.7 5l-8.7 2.8 6.3 11.2a3 3 0 0 1-5.2 3l-6.3-11.3-6.4 6.6c-1.7 1.8-4.6.6-4.6-1.9L56 30Z"
        fill="url(#msgr-cursor)"
      />
    </svg>
  );
}

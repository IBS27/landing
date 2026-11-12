import type { SVGProps } from "react";

/** Facebook-style glyphs used by posts, comments and the composer. */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...p }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden {...p}>
      {children}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ---------- Action bar ---------- */

export function LikeOutline(p: P) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M6.5 8.6 9.6 2.9c.25-.47.75-.75 1.28-.7 1.1.1 1.85 1.15 1.6 2.22L11.9 7.6h4.05c1.2 0 2.07 1.13 1.78 2.29l-1.48 5.9a2.4 2.4 0 0 1-2.33 1.81H6.5m0-8.9v8.9m0-8.9H3.9c-.66 0-1.2.54-1.2 1.2v6.5c0 .66.54 1.2 1.2 1.2h2.6"
      />
    </Svg>
  );
}

export function LikeFilled({ size = 20, ...p }: P) {
  return (
    <Svg size={size} fill="currentColor" {...p}>
      <path d="M6.2 8.3v9.4H3.9a1.6 1.6 0 0 1-1.6-1.6v-6.2c0-.88.72-1.6 1.6-1.6h2.3Zm1.5 9.4V8.2l2.9-5.5c.33-.62 1-.98 1.7-.92 1.38.13 2.33 1.45 2.03 2.8l-.55 2.42h3.13c1.66 0 2.88 1.56 2.48 3.17l-1.45 5.8A2.9 2.9 0 0 1 15.13 17.7H7.7Z" />
    </Svg>
  );
}

export function DislikeOutline(p: P) {
  return (
    <Svg {...p} style={{ transform: "scaleY(-1)", ...p.style }}>
      <path
        {...stroke}
        d="M6.5 8.6 9.6 2.9c.25-.47.75-.75 1.28-.7 1.1.1 1.85 1.15 1.6 2.22L11.9 7.6h4.05c1.2 0 2.07 1.13 1.78 2.29l-1.48 5.9a2.4 2.4 0 0 1-2.33 1.81H6.5m0-8.9v8.9m0-8.9H3.9c-.66 0-1.2.54-1.2 1.2v6.5c0 .66.54 1.2 1.2 1.2h2.6"
      />
    </Svg>
  );
}

export function CommentOutline(p: P) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M10 2.6a7.4 7.4 0 0 0-6.45 11.03l-.97 3.24a.45.45 0 0 0 .56.56l3.24-.97A7.4 7.4 0 1 0 10 2.6Z"
      />
    </Svg>
  );
}

export function ShareOutline(p: P) {
  return (
    <Svg {...p}>
      <path
        {...stroke}
        d="M11.2 3.6v3.5C5.6 7.4 2.8 10.9 2.6 16.4c1.6-2.7 4.4-4.2 8.6-4.3v3.6l6.3-6.05-6.3-6.05Z"
      />
    </Svg>
  );
}

/* ---------- Header meta ---------- */

export function GlobeIcon({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm5.92 7h-2.46a13.6 13.6 0 0 0-1.06-4.86A6.02 6.02 0 0 1 13.92 7ZM8 14c-.7 0-1.86-1.98-2.04-5h4.08C9.86 12.02 8.7 14 8 14ZM5.96 7C6.14 3.98 7.3 2 8 2s1.86 1.98 2.04 5H5.96ZM5.6 2.14A13.6 13.6 0 0 0 4.54 7H2.08A6.02 6.02 0 0 1 5.6 2.14ZM2.08 9h2.46c.08 1.83.45 3.5 1.06 4.86A6.02 6.02 0 0 1 2.08 9Zm8.32 4.86c.61-1.36.98-3.03 1.06-4.86h2.46a6.02 6.02 0 0 1-3.52 4.86Z" />
    </svg>
  );
}

export function FriendsAudienceIcon({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M5.5 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM11.5 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM0 12.8C0 10.7 2.46 9 5.5 9S11 10.7 11 12.8c0 .66-.54 1.2-1.2 1.2H1.2C.54 14 0 13.46 0 12.8ZM12.4 14h2.6c.55 0 1-.45 1-1 0-1.86-1.85-3.38-4.25-3.5.84.85 1.35 1.9 1.35 3.05 0 .52-.25 1.04-.7 1.45Z" />
    </svg>
  );
}

export function LockIcon({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M8 1a4 4 0 0 0-4 4v2h-.5A1.5 1.5 0 0 0 2 8.5v5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 12.5 7H12V5a4 4 0 0 0-4-4Zm2 6H6V5a2 2 0 1 1 4 0v2Z" />
    </svg>
  );
}

export function GroupAudienceIcon({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.25 7.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM12.75 7.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM4 12.5C4 10.57 5.8 9 8 9s4 1.57 4 3.5v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-.5ZM2.9 9.1A4.6 4.6 0 0 0 2.5 13H.8a.8.8 0 0 1-.8-.8c0-1.6 1.2-2.9 2.9-3.1ZM13.1 9.1c1.7.2 2.9 1.5 2.9 3.1a.8.8 0 0 1-.8.8h-1.7a4.6 4.6 0 0 0-.4-3.9Z" />
    </svg>
  );
}

export function DotsIcon({ size = 20, ...p }: P) {
  return (
    <Svg size={size} fill="currentColor" {...p}>
      <circle cx="4" cy="10" r="1.75" />
      <circle cx="10" cy="10" r="1.75" />
      <circle cx="16" cy="10" r="1.75" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path {...stroke} strokeWidth={1.8} d="m4.5 4.5 11 11m0-11-11 11" />
    </Svg>
  );
}

export function CaretRight({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M4 2.2v7.6a.5.5 0 0 0 .82.38l4.3-3.8a.5.5 0 0 0 0-.76l-4.3-3.8A.5.5 0 0 0 4 2.2Z" />
    </svg>
  );
}

export function CaretDown({ size = 12, ...p }: P) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M2.2 4h7.6a.5.5 0 0 1 .38.82l-3.8 4.3a.5.5 0 0 1-.76 0l-3.8-4.3A.5.5 0 0 1 2.2 4Z" />
    </svg>
  );
}

/* ---------- Composer (colored) ---------- */

export function LiveVideoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#F02849"
        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v1.3l3.3-2.1A1.1 1.1 0 0 1 22 6.6v10.8a1.1 1.1 0 0 1-1.7.93L17 16.2v1.3a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 17.5v-11Z"
      />
      <circle cx="10" cy="12" r="3.2" fill="#fff" />
      <circle cx="10" cy="12" r="1.6" fill="#F02849" />
    </svg>
  );
}

export function PhotoVideoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="5" y="2.5" width="17" height="15.5" rx="3" fill="#2ABA45" opacity=".55" />
      <rect x="2" y="5.5" width="17" height="16" rx="3" fill="#45BD62" />
      <circle cx="7.4" cy="10.4" r="1.9" fill="#fff" />
      <path
        fill="#fff"
        d="m4 19.4 4.2-4.4a1 1 0 0 1 1.4 0l1.4 1.4 3-3.4a1 1 0 0 1 1.5 0L18 15.8v2.2a1.5 1.5 0 0 1-1.5 1.5H4Z"
      />
    </svg>
  );
}

export function FeelingIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="#F7B928" strokeWidth="2.2" />
      <circle cx="8.7" cy="9.6" r="1.4" fill="#F7B928" />
      <circle cx="15.3" cy="9.6" r="1.4" fill="#F7B928" />
      <path
        fill="#F7B928"
        d="M6.9 13.2h10.2a.6.6 0 0 1 .58.75C17 16.6 14.8 18.3 12 18.3s-5-1.7-5.68-4.35a.6.6 0 0 1 .58-.75Z"
      />
    </svg>
  );
}

export function TagPeopleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#1877F2"
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h6.6c.66 0 1.3.26 1.77.73l7.4 7.4a2.5 2.5 0 0 1 0 3.54l-6.6 6.6a2.5 2.5 0 0 1-3.54 0l-7.4-7.4A2.5 2.5 0 0 1 3 12.1V5.5Z"
      />
      <circle cx="11.5" cy="10.2" r="2.2" fill="#fff" />
      <path
        fill="#fff"
        d="M7.6 16c.5-1.9 2-3 3.9-3s3.4 1.1 3.9 3l-2.1 2.1a2.5 2.5 0 0 1-3.5 0L7.6 16Z"
      />
    </svg>
  );
}

export function CheckInIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#F5533D"
        d="M12 2a8 8 0 0 0-8 8c0 5.4 6.4 11.1 7.1 11.7a1.4 1.4 0 0 0 1.8 0C13.6 21.1 20 15.4 20 10a8 8 0 0 0-8-8Z"
      />
      <circle cx="12" cy="10" r="3" fill="#fff" />
    </svg>
  );
}

export function GifIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="3.5" fill="#3BC4BD" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="#fff"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        GIF
      </text>
    </svg>
  );
}

export function TextBackgroundIcon({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 38 38" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="fb-aa-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5af19" />
          <stop offset=".5" stopColor="#f12711" />
          <stop offset="1" stopColor="#c600ff" />
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="8" fill="url(#fb-aa-grad)" />
      <text
        x="19"
        y="25"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#fff"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        Aa
      </text>
    </svg>
  );
}

/* ---------- Small outline glyphs (comment composer, menus) ---------- */

export function SmileOutline({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <circle {...stroke} cx="10" cy="10" r="7.6" />
      <path {...stroke} d="M6.8 11.8c.7 1.3 1.9 2 3.2 2s2.5-.7 3.2-2" />
      <circle cx="7.4" cy="8" r="1.05" fill="currentColor" />
      <circle cx="12.6" cy="8" r="1.05" fill="currentColor" />
    </Svg>
  );
}

export function CameraOutline({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path
        {...stroke}
        d="M2.6 7.2c0-1.1.9-2 2-2h1.6l1.2-1.8h5.2l1.2 1.8h1.6c1.1 0 2 .9 2 2v7.4c0 1.1-.9 2-2 2H4.6c-1.1 0-2-.9-2-2V7.2Z"
      />
      <circle {...stroke} cx="10" cy="10.6" r="3" />
    </Svg>
  );
}

export function GifOutline({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <rect {...stroke} x="2.4" y="4" width="15.2" height="12" rx="2.6" />
      <text
        x="10"
        y="12.6"
        textAnchor="middle"
        fontSize="6.4"
        fontWeight="700"
        fill="currentColor"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        GIF
      </text>
    </Svg>
  );
}

export function StickerOutline({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path
        {...stroke}
        d="M17.4 10.6V5.6a3 3 0 0 0-3-3H5.6a3 3 0 0 0-3 3v8.8a3 3 0 0 0 3 3h5l6.8-6.8Zm0 0h-3.8a3 3 0 0 0-3 3v3.8"
      />
      <circle cx="7.4" cy="8" r="1" fill="currentColor" />
      <circle cx="12.6" cy="8" r="1" fill="currentColor" />
    </Svg>
  );
}

export function AvatarStickerOutline({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <circle {...stroke} cx="10" cy="10" r="7.6" />
      <path
        {...stroke}
        d="M5 9.2h10M7 9.2c0 1.2.8 2 1.8 2s1.2-.6 1.2-1.4c0 .8.4 1.4 1.2 1.4s1.8-.8 1.8-2"
      />
      <path {...stroke} d="M8 14.2c1.2.7 2.8.7 4 0" />
    </Svg>
  );
}

export function SendIcon({ size = 16, ...p }: P) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      <path d="M1.6 1.2a.6.6 0 0 1 .66-.08l12.9 6.35a.6.6 0 0 1 0 1.07L2.26 14.9a.6.6 0 0 1-.83-.71L2.9 8.7h5.6a.7.7 0 0 0 0-1.4H2.9L1.43 1.82a.6.6 0 0 1 .17-.62Z" />
    </svg>
  );
}

export function BookmarkOutline({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path {...stroke} d="M5 3.4c0-.5.4-.9.9-.9h8.2c.5 0 .9.4.9.9v13.7l-5-3.6-5 3.6V3.4Z" />
    </Svg>
  );
}

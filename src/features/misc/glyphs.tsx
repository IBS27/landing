import { type ReactNode, useId } from "react";

/**
 * Facebook-style filled 20px rail glyphs (Events, Search, Saved, Pages, Video,
 * Gaming). They sit in the 36px grey circles of the app rails: dark glyph on
 * grey, white glyph on the blue "selected" circle. Category glyphs are drawn
 * as faint white silhouettes, the way Facebook renders its category art.
 */

type P = { size?: number; className?: string };

function Svg({
  size = 20,
  className,
  children,
  cut,
}: P & { children: ReactNode; cut?: ReactNode }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      {cut ? (
        <>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
            <rect width="20" height="20" fill="#fff" />
            <g fill="#000" stroke="#000">
              {cut}
            </g>
          </mask>
          <g mask={`url(#${id})`}>{children}</g>
        </>
      ) : (
        children
      )}
    </svg>
  );
}

function star(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/* ---------- Rail glyphs ---------- */

export function CalendarGridGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 1.75a.75.75 0 0 1 1.5 0V3h7V1.75a.75.75 0 0 1 1.5 0V3h.5A2.5 2.5 0 0 1 18 5.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 15.5v-10A2.5 2.5 0 0 1 4.5 3H5V1.75ZM3.5 8v2.5h3.25V8H3.5Zm4.75 0v2.5h3.5V8h-3.5Zm5 0v2.5h3.25V8h-3.25Zm3.25 4h-3.25v2.75h3.25V12Zm-4.75 2.75V12h-3.5v2.75h3.5Zm-5 0V12H3.5v2.75h3.25Z" />
    </Svg>
  );
}

export function PersonGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="5.75" r="3.75" />
      <path d="M3 16.25C3 12.8 5.9 11 10 11s7 1.8 7 5.25c0 .97-.78 1.75-1.75 1.75H4.75C3.78 18 3 17.22 3 16.25Z" />
    </Svg>
  );
}

export function GiftGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M10 6.2C8.6 3.4 5.4 2.6 5.4 4.6c0 1.3 2 1.6 4.6 1.6Zm0 0c1.4-2.8 4.6-3.6 4.6-1.6 0 1.3-2 1.6-4.6 1.6Z" />
      <path d="M3 8.2C3 7.5 3.5 7 4.2 7h4.55v4H3V8.2Zm8.25-1.2h4.55c.7 0 1.2.5 1.2 1.2V11h-5.75V7ZM4 12.25h4.75V18H5.5A1.5 1.5 0 0 1 4 16.5v-4.25Zm7.25 0H16v4.25a1.5 1.5 0 0 1-1.5 1.5h-3.25v-5.75Z" />
    </Svg>
  );
}

export function PinGlyph(p: P) {
  return (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 1.5A6.5 6.5 0 0 0 3.5 8c0 4.6 5.2 9.5 5.9 10.1a.9.9 0 0 0 1.2 0c.7-.6 5.9-5.5 5.9-10.1A6.5 6.5 0 0 0 10 1.5Zm0 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
      />
    </Svg>
  );
}

export function ListGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="3.75" cy="4.75" r="1.5" />
      <circle cx="3.75" cy="10" r="1.5" />
      <circle cx="3.75" cy="15.25" r="1.5" />
      <rect x="7" y="3.75" width="11" height="2" rx="1" />
      <rect x="7" y="9" width="11" height="2" rx="1" />
      <rect x="7" y="14.25" width="11" height="2" rx="1" />
    </Svg>
  );
}

export function PeopleGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="13.75" cy="5" r="2.75" />
      <path d="M12.4 9.9c.45-.1.9-.15 1.35-.15 2.7 0 4.75 1.5 4.75 3.9 0 .75-.6 1.35-1.35 1.35h-2.9c-.25-2-1.2-3.8-2.85-5.1Z" />
      <circle cx="7" cy="8" r="3.25" />
      <path d="M1 16.4C1 13.5 3.6 12 7 12s6 1.5 6 4.4c0 .9-.7 1.6-1.6 1.6H2.6c-.9 0-1.6-.7-1.6-1.6Z" />
    </Svg>
  );
}

export function GroupsGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="6.25" r="2.9" />
      <circle cx="4.4" cy="7.9" r="2.15" />
      <circle cx="15.6" cy="7.9" r="2.15" />
      <path d="M5.4 15.6c0-2.75 2-4.35 4.6-4.35s4.6 1.6 4.6 4.35c0 .8-.65 1.4-1.4 1.4H6.8c-.8 0-1.4-.6-1.4-1.4Z" />
      <path d="M1 14.7c0-2.05 1.5-3.4 3.5-3.4.55 0 1.1.1 1.55.3-.95.95-1.55 2.3-1.6 3.85V16H2.1c-.6 0-1.1-.5-1.1-1.1Zm18 0c0-2.05-1.5-3.4-3.5-3.4-.55 0-1.1.1-1.55.3.95.95 1.55 2.3 1.6 3.85V16h2.35c.6 0 1.1-.5 1.1-1.1Z" />
    </Svg>
  );
}

/** Search "All" and Saved "Saved Items": a card with two cards behind it. */
export function CardsGlyph(p: P) {
  return (
    <Svg {...p}>
      <path
        d="M2.75 12.5V5.5a2 2 0 0 1 2-2h9.5M4.9 14V7.75a1.75 1.75 0 0 1 1.75-1.75h9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        fillRule="evenodd"
        d="M9 8h7.25A2.25 2.25 0 0 1 18.5 10.25v5.5A2.25 2.25 0 0 1 16.25 18h-7.5A2.25 2.25 0 0 1 6.5 15.75v-5.5A2.25 2.25 0 0 1 8.75 8H9Zm1.2 2.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2.55.35a.65.65 0 0 0 0 1.3h3.5a.65.65 0 0 0 0-1.3h-3.5Z"
      />
    </Svg>
  );
}

export function ReelsGlyph(p: P) {
  return (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M4.5 4h11A3.5 3.5 0 0 1 19 7.5v5a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 1 12.5v-5A3.5 3.5 0 0 1 4.5 4Zm3.75 3.1v5.8L13.2 10 8.25 7.1Z"
      />
    </Svg>
  );
}

export function StoreGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M3.4 2.5h13.2c.5 0 .9.3 1.05.75l1.25 3.6a2.6 2.6 0 0 1-4.6 2.25 2.6 2.6 0 0 1-4.3 0 2.6 2.6 0 0 1-4.3 0A2.6 2.6 0 0 1 1.1 6.85l1.25-3.6c.15-.45.55-.75 1.05-.75Z" />
      <path d="M3 10.75c.95.4 2.2.45 3.45-.1.95.75 2.2 1.05 3.55 1.05s2.6-.3 3.55-1.05c1.25.55 2.5.5 3.45.1v5.75A1.5 1.5 0 0 1 15.5 18h-3.25v-4.25a1 1 0 0 0-1-1h-2.5a1 1 0 0 0-1 1V18H4.5A1.5 1.5 0 0 1 3 16.5v-5.75Z" />
    </Svg>
  );
}

export function FlagGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M4.25 2a1 1 0 0 1 1 1v.35c1.4-.75 2.9-.95 4.5-.4 1.9.65 3.5.7 5.6-.2.6-.25 1.15.2 1.15.8v7.8c0 .4-.25.75-.6.9-2.45 1.05-4.5 1.1-6.75.3-1.4-.5-2.65-.4-3.9.35V18a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

export function CalendarStarGlyph(p: P) {
  return (
    <Svg
      {...p}
      cut={
        <>
          <rect x="6" y="5" width="8" height="1.5" rx=".75" stroke="none" />
          <path d={star(10, 11.9, 3.7, 1.6)} stroke="none" />
        </>
      }
    >
      <rect x="2" y="2" width="16" height="16" rx="3.5" />
    </Svg>
  );
}

export function PostsGlyph(p: P) {
  return (
    <Svg
      {...p}
      cut={
        <>
          <rect x="5" y="5.25" width="6.5" height="3.25" rx=".6" stroke="none" />
          <rect x="5" y="10" width="6.5" height="1.4" rx=".7" stroke="none" />
          <rect x="5" y="13" width="6.5" height="1.4" rx=".7" stroke="none" />
        </>
      }
    >
      <path d="M3.75 2.5h8.5A1.75 1.75 0 0 1 14 4.25V15.5c0 .95.3 1.8.8 2.5H4.5a2.5 2.5 0 0 1-2.5-2.5V4.25A1.75 1.75 0 0 1 3.75 2.5Z" />
      <path d="M15.25 7H16.5A1.5 1.5 0 0 1 18 8.5v7.75a1.75 1.75 0 0 1-2.75 1.45V7Z" />
    </Svg>
  );
}

export function PhotoGlyph(p: P) {
  return (
    <Svg
      {...p}
      cut={
        <>
          <circle cx="13" cy="7" r="1.75" stroke="none" />
          <path d="M4.5 15.5 8.2 10.4l2.8 3.3 1.9-2.1 2.6 3.9Z" stroke="none" />
        </>
      }
    >
      <rect x="2" y="2.5" width="16" height="15" rx="3" />
    </Svg>
  );
}

export function VideoGlyph(p: P) {
  return (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M4 3.5h12A2.5 2.5 0 0 1 18.5 6v8a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 14V6A2.5 2.5 0 0 1 4 3.5Zm4.5 3.6v5.8l4.9-2.9-4.9-2.9Z"
      />
    </Svg>
  );
}

export function HouseGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M9.2 2.3a1.2 1.2 0 0 1 1.6 0l7 6.3c.5.45.2 1.4-.5 1.4H16v6.5a1.5 1.5 0 0 1-1.5 1.5H12v-4.25a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1V18H5.5A1.5 1.5 0 0 1 4 16.5V10H2.7c-.7 0-1-.95-.5-1.4l7-6.3Z" />
    </Svg>
  );
}

export function LiveGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="10" r="2.4" />
      <path
        d="M6.2 6.2a5.4 5.4 0 0 0 0 7.6m7.6 0a5.4 5.4 0 0 0 0-7.6M3.6 3.6a9 9 0 0 0 0 12.8m12.8 0a9 9 0 0 0 0-12.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ShowsGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M3.5 3.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
      <rect x="6" y="16.75" width="8" height="1.75" rx=".875" />
    </Svg>
  );
}

export function FollowedPagesGlyph(p: P) {
  return (
    <Svg {...p}>
      <rect x="5.5" y="1.75" width="9" height="1.5" rx=".75" />
      <rect x="3.75" y="4.25" width="12.5" height="1.5" rx=".75" />
      <path
        fillRule="evenodd"
        d="M4.5 7h11A2.5 2.5 0 0 1 18 9.5v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 15.5v-6A2.5 2.5 0 0 1 4.5 7Zm4.75 3.25v1.75H7.5v1.5h1.75v1.75h1.5V13.5h1.75V12h-1.75v-1.75h-1.5Z"
      />
    </Svg>
  );
}

export function PersonPlusGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="5.5" r="3.5" />
      <path d="M1.5 16.3C1.5 13 4.3 11 8 11c1.15 0 2.2.2 3.1.55A5.2 5.2 0 0 0 10.4 18H3.2c-.95 0-1.7-.75-1.7-1.7Z" />
      <path d="M14.25 11h1.5v3h3v1.5h-3v3h-1.5v-3h-3V14h3v-3Z" />
    </Svg>
  );
}

export function BusinessSuiteGlyph(p: P) {
  return (
    <Svg {...p}>
      <path
        d="M10 2.4a7.6 7.6 0 1 1-6.2 3.2M7.4 6.4 11.5 10l-4.1 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ---------- Category glyphs (Events) ---------- */

const BookG = (p: P) => (
  <Svg {...p} cut={<path d="M6.9 14.9 14.6 13.3" strokeWidth="1.2" fill="none" />}>
    <rect x="5" y="2.8" width="10.5" height="14.4" rx="1.6" transform="rotate(-12 10 10)" />
  </Svg>
);

const LaughG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <path
          d="m5.6 6.4 2.5 1.4-2.5 1.4m8.8-2.8-2.5 1.4 2.5 1.4"
          fill="none"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M5.4 11h9.2a4.6 4.6 0 0 1-9.2 0Z" stroke="none" />
      </>
    }
  >
    <circle cx="10" cy="10" r="8.5" />
  </Svg>
);

const ScissorsG = (p: P) => (
  <Svg {...p}>
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <circle cx="5.6" cy="14.6" r="2.6" strokeWidth="1.9" />
      <circle cx="14.4" cy="14.6" r="2.6" strokeWidth="1.9" />
      <path d="M7.4 12.7 15.5 2.5M12.6 12.7 4.5 2.5" strokeWidth="2.2" />
    </g>
  </Svg>
);

const ShoesG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <ellipse cx="6.6" cy="8.4" rx="1.9" ry="3" transform="rotate(-14 6.6 8.4)" stroke="none" />
        <ellipse cx="13.6" cy="7.6" rx="1.9" ry="3" transform="rotate(14 13.6 7.6)" stroke="none" />
      </>
    }
  >
    <ellipse cx="7" cy="10.6" rx="3.7" ry="6.6" transform="rotate(-14 7 10.6)" />
    <ellipse cx="13.3" cy="9.8" rx="3.7" ry="6.6" transform="rotate(14 13.3 9.8)" />
  </Svg>
);

const MartiniG = (p: P) => (
  <Svg {...p}>
    <path d="M2.6 2.5h14.8c.6 0 .9.7.5 1.15L10.9 11.4V16h2.6a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1 0-1.5h2.6v-4.6L2.1 3.65c-.4-.45-.1-1.15.5-1.15Z" />
    <circle cx="14.6" cy="1.9" r="1.6" />
  </Svg>
);

const DumbbellG = (p: P) => (
  <Svg {...p}>
    <g transform="rotate(-45 10 10)">
      <rect x="5" y="9" width="10" height="2" rx=".6" />
      <rect x="3.4" y="5" width="2.8" height="10" rx="1.1" />
      <rect x="13.8" y="5" width="2.8" height="10" rx="1.1" />
      <rect x="1.2" y="7" width="2" height="6" rx=".9" />
      <rect x="16.8" y="7" width="2" height="6" rx=".9" />
    </g>
  </Svg>
);

const ForkKnifeG = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 2.25a.6.6 0 0 1 1.2 0V6.5h.8V2.25a.6.6 0 0 1 1.2 0V6.5h.8V2.25a.6.6 0 0 1 1.2 0v5.1c0 1-.6 1.85-1.5 2.2v7.7a1.1 1.1 0 0 1-2.2 0v-7.7c-.9-.35-1.5-1.2-1.5-2.2v-5.1Z" />
    <path d="M13.6 2.1c1.9.7 3.15 2.9 3.15 6.1v2.55c0 .35-.3.65-.65.65h-1.15v6.2a1.1 1.1 0 0 1-2.2 0V2.6c0-.4.45-.7.85-.5Z" />
  </Svg>
);

const GamepadG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <path d="M6 8.2v3.4M4.3 9.9h3.4" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <circle cx="13.6" cy="8.6" r="1" stroke="none" />
        <circle cx="12.2" cy="11" r="1" stroke="none" />
      </>
    }
  >
    <path d="M5.6 4.5h8.8c2.5 0 4.4 2 4.6 4.5l.3 3.6c.2 2.1-1.4 3.9-3.5 3.9-1 0-2-.5-2.7-1.3l-.8-1H7.7l-.8 1c-.7.8-1.7 1.3-2.7 1.3-2.1 0-3.7-1.8-3.5-3.9L1 9c.2-2.5 2.1-4.5 4.6-4.5Z" />
  </Svg>
);

const TrowelG = (p: P) => (
  <Svg {...p}>
    <path d="M8.4 9.1 12.9 4.6c2-2 5.3-.55 5.1 2.25-.1 1.25-.6 2.4-1.5 3.3l-4.6 4.6-3.5-5.65Z" />
    <path
      d="M8.6 11.4 3 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </Svg>
);

const MedicalG = (p: P) => (
  <Svg {...p} cut={<path d="M8.6 5h2.8v3.6H15v2.8h-3.6V15H8.6v-3.6H5V8.6h3.6Z" stroke="none" />}>
    <rect x="2" y="2" width="16" height="16" rx="4" />
  </Svg>
);

const LotusG = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.6c2.1 2 3.2 4.3 3.2 6.6 0 2.4-1.3 4.6-3.2 6.1-1.9-1.5-3.2-3.7-3.2-6.1 0-2.3 1.1-4.6 3.2-6.6Z" />
    <path d="M1.5 7.6c3.3.1 5.8 1.8 7 4.6.4.95.75 1.95 1 2.9-4.1-.15-7.9-2.4-8-7.5Zm17 0c-3.3.1-5.8 1.8-7 4.6-.4.95-.75 1.95-1 2.9 4.1-.15 7.9-2.4 8-7.5Z" />
    <rect x="4" y="16.3" width="12" height="1.6" rx=".8" />
  </Svg>
);

const NoteG = (p: P) => (
  <Svg {...p}>
    <path d="M16.5 2.3v11a2.9 2.9 0 1 1-1.6-2.6V6.2L8.2 7.7v7.6a2.9 2.9 0 1 1-1.6-2.6V4.9c0-.4.3-.8.7-.9l8.2-2.4c.5-.15 1 .2 1 .7Z" />
  </Svg>
);

const BalloonG = (p: P) => (
  <Svg {...p}>
    <path d="M10 1.8c3 0 5.3 2.4 5.3 5.6 0 3.3-2.5 6.1-4.4 6.6l.5 1h-2.8l.5-1C7.2 13.5 4.7 10.7 4.7 7.4c0-3.2 2.3-5.6 5.3-5.6Z" />
    <path
      d="M10 15.2c-1.3 1-.2 1.9-.7 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </Svg>
);

const BriefcaseG = (p: P) => (
  <Svg {...p}>
    <path
      fillRule="evenodd"
      d="M7 4.6A1.6 1.6 0 0 1 8.6 3h2.8A1.6 1.6 0 0 1 13 4.6V6h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4.6Zm1.5.15V6h3V4.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"
    />
  </Svg>
);

const TempleG = (p: P) => (
  <Svg {...p}>
    <path d="M10 1.6c.3 0 .55.2.6.5l.2.95c2.6.7 4.4 2.9 4.4 5.45H4.8c0-2.55 1.8-4.75 4.4-5.45l.2-.95c.05-.3.3-.5.6-.5Z" />
    <path d="M3.5 9.7h13v7.8h-4.25v-3.3a2.25 2.25 0 0 0-4.5 0v3.3H3.5V9.7Z" />
  </Svg>
);

const BagG = (p: P) => (
  <Svg {...p}>
    <path
      fillRule="evenodd"
      d="M6 6V5.2a4 4 0 0 1 8 0V6h1.6c.5 0 .95.4 1 .9l.9 10a1 1 0 0 1-1 1.1H3.5a1 1 0 0 1-1-1.1l.9-10c.05-.5.5-.9 1-.9H6Zm1.5 0h5v-.8a2.5 2.5 0 0 0-5 0V6Z"
    />
  </Svg>
);

const HeartG = (p: P) => (
  <Svg {...p}>
    <path d="M10 17.6c-.2 0-.4-.05-.55-.15C6.6 15.6 2 12.2 2 7.7 2 5.1 3.9 3 6.3 3c1.55 0 2.85.8 3.7 2.05C10.85 3.8 12.15 3 13.7 3 16.1 3 18 5.1 18 7.7c0 4.5-4.6 7.9-7.45 9.75-.15.1-.35.15-.55.15Z" />
  </Svg>
);

const BallG = (p: P) => (
  <Svg
    {...p}
    cut={
      <path
        d="M1.5 10h17M10 1.5v17M4 4c2.6 3.1 2.6 8.9 0 12M16 4c-2.6 3.1-2.6 8.9 0 12"
        fill="none"
        strokeWidth="1.2"
      />
    }
  >
    <circle cx="10" cy="10" r="8.5" />
  </Svg>
);

const MaskG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <path
          d="M5.6 8.2c.8-.7 1.9-.7 2.7 0m3.4 0c.8-.7 1.9-.7 2.7 0"
          fill="none"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M6.6 11.6h6.8a3.4 3.4 0 0 1-6.8 0Z" stroke="none" />
      </>
    }
  >
    <path d="M2.5 3.3c0-.6.6-1 1.15-.75 1.95.85 4.1.95 6.35.2 2.25.75 4.4.65 6.35-.2.55-.25 1.15.15 1.15.75v5.45c0 4.7-3.3 8.75-7.5 8.75s-7.5-4.05-7.5-8.75V3.3Z" />
  </Svg>
);

const ClapperG = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 8.5h15v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7Z" />
    <path d="M2.1 5.6 15.9 2.6c.4-.1.8.15.9.55l.4 1.7-14.8 3.2-.4-1.7c-.1-.4.15-.8.55-.9Z" />
  </Svg>
);

const PaletteG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <circle cx="6" cy="9.6" r="1.4" stroke="none" />
        <circle cx="8.2" cy="5.8" r="1.4" stroke="none" />
        <circle cx="12.6" cy="5.6" r="1.4" stroke="none" />
      </>
    }
  >
    <path d="M10 2c4.4 0 8 2.8 8 6.3 0 2.3-1.9 4.2-4.2 4.2h-1.8c-.9 0-1.6.7-1.6 1.6 0 .45.2.85.5 1.15.3.3.5.75.5 1.2 0 .9-.7 1.55-1.6 1.55A8 8 0 0 1 10 2Z" />
  </Svg>
);

/** Events categories (faint white glyphs on grey). */
export const EVENT_CATEGORY_GLYPHS: Record<string, (p: P) => ReactNode> = {
  Classics: BookG,
  Comedy: LaughG,
  Crafts: ScissorsG,
  Dance: ShoesG,
  Drinks: MartiniG,
  "Fitness & Workouts": DumbbellG,
  Foods: ForkKnifeG,
  Games: GamepadG,
  Gardening: TrowelG,
  "Health & Medical": MedicalG,
  "Healthy Living & Self-Care": LotusG,
  "Home & Garden": HouseGlyph,
  "Music & Audio": NoteG,
  Parties: BalloonG,
  "Professional Networking": BriefcaseG,
  Religions: TempleG,
  Shopping: BagG,
  "Social Issues": HeartG,
  Sports: BallG,
  Theater: MaskG,
  "TV & Movies": ClapperG,
  "Visual Arts": PaletteG,
};

/* ---------- Category glyphs (Gaming) ---------- */

const RocketG = (p: P) => (
  <Svg {...p} cut={<circle cx="12.6" cy="7.4" r="1.5" stroke="none" />}>
    <path d="M17.9 2.1c-3.6.15-7 1.9-9.4 4.8l-3.2.2L2.6 9.8l3.3 1 3.3 3.3 1 3.3 2.7-2.7.2-3.2c2.9-2.4 4.65-5.8 4.8-9.4Z" />
    <path d="M4.6 13.3c-1.2.6-2 1.9-2.1 4.2 2.3-.1 3.6-.9 4.2-2.1l-2.1-2.1Z" />
  </Svg>
);

const MapG = (p: P) => (
  <Svg {...p} cut={<path d="M7.2 3.5v13M12.8 4.2v13" strokeWidth="1.3" fill="none" />}>
    <path d="M2 5.2c0-.45.3-.85.75-.95L7.2 3l5.6 1.2 4.1-1.15c.55-.15 1.1.25 1.1.8v11c0 .45-.3.85-.75.95L12.8 17l-5.6-1.2-4.1 1.15c-.55.15-1.1-.25-1.1-.8v-11Z" />
  </Svg>
);

const JoystickG = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="5.2" r="3.2" />
    <rect x="9.1" y="7" width="1.8" height="6.5" />
    <path d="M3 14.6c0-.9.7-1.6 1.6-1.6h10.8c.9 0 1.6.7 1.6 1.6V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.4Z" />
  </Svg>
);

const SwordG = (p: P) => (
  <Svg {...p}>
    <path d="M15.1 2h2.4c.3 0 .5.2.5.5v2.4L9.4 13.5 6.5 10.6 15.1 2Z" />
    <path d="M3.9 9.5a.9.9 0 0 1 1.3 0l5.3 5.3a.9.9 0 0 1-1.3 1.3L3.9 10.8a.9.9 0 0 1 0-1.3Z" />
    <path
      d="M6.2 13.8 2.6 17.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </Svg>
);

const PawnG = (p: P) => (
  <Svg {...p}>
    <path d="M10 2a2.6 2.6 0 0 1 1.75 4.5c1.05.3 1.75.95 1.75 1.75H6.5c0-.8.7-1.45 1.75-1.75A2.6 2.6 0 0 1 10 2Zm-2.3 7.6h4.6l1.1 5.4H6.6l1.1-5.4ZM4.5 16.3c0-.4.3-.7.7-.7h9.6c.4 0 .7.3.7.7v1.2c0 .3-.2.5-.5.5H5c-.3 0-.5-.2-.5-.5v-1.2Z" />
  </Svg>
);

const TowerG = (p: P) => (
  <Svg {...p} cut={<path d="M8.4 18v-3a1.6 1.6 0 0 1 3.2 0v3Z" stroke="none" />}>
    <path d="M3.5 2.8c0-.45.35-.8.8-.8h1.6c.45 0 .8.35.8.8V4h1.9V2.8c0-.45.35-.8.8-.8h1.2c.45 0 .8.35.8.8V4h1.9V2.8c0-.45.35-.8.8-.8h1.6c.45 0 .8.35.8.8v4.6c0 .3-.1.55-.3.75L15 9.7V18H5V9.7L3.8 8.15c-.2-.2-.3-.45-.3-.75V2.8Z" />
  </Svg>
);

const CardsG = (p: P) => (
  <Svg {...p} cut={<path d={star(12.2, 10.4, 2.6, 1.1)} stroke="none" />}>
    <rect
      x="2.6"
      y="4"
      width="9"
      height="12.5"
      rx="1.6"
      transform="rotate(-12 7 10)"
      opacity=".7"
    />
    <rect x="7.8" y="3.6" width="9.4" height="13.2" rx="1.6" transform="rotate(6 12.5 10)" />
  </Svg>
);

const GemG = (p: P) => (
  <Svg
    {...p}
    cut={<path d="M2 7.6h16M7 3l3 4.6L13 3M7.3 7.6 10 16.6l2.7-9" strokeWidth="1.1" fill="none" />}
  >
    <path d="M5.6 2.5h8.8c.3 0 .55.15.7.4l3.1 4.5c.2.3.2.75-.05 1.05l-7.5 9.2c-.35.45-1 .45-1.3 0l-7.5-9.2c-.25-.3-.25-.75-.05-1.05l3.1-4.5c.15-.25.4-.4.7-.4Z" />
  </Svg>
);

const PuzzleG = (p: P) => (
  <Svg {...p}>
    <path d="M3 6.2c0-.5.4-.95.95-.95H6.3a2.35 2.35 0 1 1 4.6 0h2.35c.55 0 .95.45.95.95v2.35a2.35 2.35 0 1 1 0 4.6v2.35c0 .55-.4.95-.95.95H10.9a2.35 2.35 0 1 0-4.6 0H3.95c-.55 0-.95-.4-.95-.95v-9.3Z" />
  </Svg>
);

const CityG = (p: P) => (
  <Svg
    {...p}
    cut={
      <>
        <rect x="9.4" y="5.5" width="1.3" height="1.6" stroke="none" />
        <rect x="9.4" y="9" width="1.3" height="1.6" stroke="none" />
        <rect x="9.4" y="12.5" width="1.3" height="1.6" stroke="none" />
      </>
    }
  >
    <path d="M2 9.2c0-.4.25-.75.6-.9L6.5 6.8v11.2H2.8a.8.8 0 0 1-.8-.8V9.2Z" />
    <path d="M7.6 3.2c0-.45.35-.8.8-.8h4.2c.45 0 .8.35.8.8V18H7.6V3.2Z" />
    <path d="M14.5 9.2h2.7c.45 0 .8.35.8.8v7.2a.8.8 0 0 1-.8.8h-2.7V9.2Z" />
  </Svg>
);

const SpadeG = (p: P) => (
  <Svg {...p}>
    <path d="M10 1.8c2.5 3.2 7 5.4 7 9.1a3.4 3.4 0 0 1-5.6 2.6l.75 3.7c.1.45-.25.8-.7.8H8.55c-.45 0-.8-.35-.7-.8l.75-3.7A3.4 3.4 0 0 1 3 10.9c0-3.7 4.5-5.9 7-9.1Z" />
  </Svg>
);

const KnightG = (p: P) => (
  <Svg {...p}>
    <path d="M5.6 18h9.3c.35 0 .6-.25.6-.6V16c0-2.3-1-4.4-1-7.2 0-3.4-2.3-6-5.6-6.3l-.85 1.45-1.4-.95v1.9L3.7 9.3c-.25.35-.2.8.1 1.1l.95.85c.25.2.6.25.9.1l2.5-1.3c.55-.3 1.1.35.75.85L5.1 15.6c-.1.15-.1.3-.1.45v1.35c0 .35.25.6.6.6Z" />
  </Svg>
);

const LetterG = (p: P) => (
  <Svg
    {...p}
    cut={
      <path
        d="M6.8 14.4 10 5.6l3.2 8.8M8 11.2h4"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    }
  >
    <rect x="2" y="2" width="16" height="16" rx="3.5" />
  </Svg>
);

/** Gaming categories. "All games" is drawn dark like Facebook's; the rest faint. */
export const GAME_CATEGORY_GLYPHS: Record<string, (p: P) => ReactNode> = {
  "All games": GamepadG,
  Action: RocketG,
  Adventure: MapG,
  Arcade: JoystickG,
  Battle: SwordG,
  Board: PawnG,
  Builder: TowerG,
  Card: CardsG,
  "Match 3": GemG,
  Puzzle: PuzzleG,
  Simulation: CityG,
  Solitaire: SpadeG,
  Sports: BallG,
  Strategy: KnightG,
  Word: LetterG,
};

/** Faint category art color: white on the light grey circle, dim on dark. */
export const CATEGORY_GLYPH_CLASS = "text-white dark:text-white/40";

import { type SVGProps, useId } from "react";

/** Facebook-style glyphs for the Groups surfaces (filled, currentColor). */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...p }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      {children}
    </svg>
  );
}

/** Rail "Your feed": a framed card with a solid header band (dot + two lines). */
export function FeedGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path
        fillRule="evenodd"
        d="M4.75 2.5A2.75 2.75 0 0 0 2 5.25v9.5a2.75 2.75 0 0 0 2.75 2.75h10.5A2.75 2.75 0 0 0 18 14.75v-9.5A2.75 2.75 0 0 0 15.25 2.5H4.75ZM3.75 9h12.5v5.75c0 .55-.45 1-1 1H4.75c-.55 0-1-.45-1-1V9Zm2.5-4.4a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm2.6.35a.6.6 0 0 0 0 1.2h5.4a.6.6 0 0 0 0-1.2h-5.4Zm0 1.6a.6.6 0 0 0 0 1.2h5.4a.6.6 0 0 0 0-1.2h-5.4Z"
      />
    </Svg>
  );
}

/** Rail "Discover": a solid disc holding a tilted rounded square with a dot. */
export function CompassGlyph({ size = 20, ...p }: P) {
  const id = useId();
  return (
    <Svg size={size} {...p}>
      <mask id={id}>
        <circle cx="10" cy="10" r="9" fill="#fff" />
        <rect
          x="5.6"
          y="5.6"
          width="8.8"
          height="8.8"
          rx="1.6"
          fill="#000"
          transform="rotate(-18 10 10)"
        />
        <circle cx="9.3" cy="10.3" r="1.5" fill="#fff" />
      </mask>
      <circle cx="10" cy="10" r="9" mask={`url(#${id})`} />
    </Svg>
  );
}

/** Rail "Your groups": three people with a check. */
export function YourGroupsGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 8.6a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6ZM4.5 9.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Zm11 0a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM10 10c-2.85 0-5 2-5 4.6v.4c0 .55.45 1 1 1h5.7a4.5 4.5 0 0 1 3.12-4.2A5.2 5.2 0 0 0 10 10Zm-6.2.6C2.2 10.95 1 12.6 1 14.65c0 .47.38.85.85.85H3.6v-.9c0-1.5.5-2.9 1.4-4a3.3 3.3 0 0 0-1.2 0Z" />
      <path d="M19.03 12.97a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.75-1.75a.75.75 0 1 1 1.06-1.06L15 15.94l2.97-2.97a.75.75 0 0 1 1.06 0Z" />
    </Svg>
  );
}

/** Rail "Your groups": three people. */
export function PeopleGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.25 9.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm11.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM5 15.75C5 13.13 7.24 11 10 11s5 2.13 5 4.75v.25a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.25Zm-1.6-4.9A5.86 5.86 0 0 0 3.6 17H1.75A.75.75 0 0 1 1 16.25C1 13.4 2.04 11.26 3.4 10.85Zm13.2 0c1.36.41 2.4 2.55 2.4 5.4a.75.75 0 0 1-.75.75H16.4a5.86 5.86 0 0 0 .2-6.15Z" />
    </Svg>
  );
}

/** People with a plus ("Join group"). */
export function JoinGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.75 9.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM3 16c0-2.76 2.24-5 5-5 1.2 0 2.3.42 3.16 1.13A4.5 4.5 0 0 0 10.6 17H4a1 1 0 0 1-1-1Zm-1.6-4.85A5.5 5.5 0 0 0 1.6 17H.75A.75.75 0 0 1 0 16.25c0-2.1.6-3.9 1.4-5.1ZM15 11a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 15 11Z" />
    </Svg>
  );
}

/** People with a check ("Joined"). */
export function JoinedGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.75 9.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM3 16c0-2.76 2.24-5 5-5 1.2 0 2.3.42 3.16 1.13A4.5 4.5 0 0 0 10.6 17H4a1 1 0 0 1-1-1Zm-1.6-4.85A5.5 5.5 0 0 0 1.6 17H.75A.75.75 0 0 1 0 16.25c0-2.1.6-3.9 1.4-5.1Zm17.38 1.32a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.75-1.75a.75.75 0 1 1 1.06-1.06l1.22 1.22 2.97-2.97a.75.75 0 0 1 1.06 0Z" />
    </Svg>
  );
}

export function PlusGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 2.75a.75.75 0 0 1 .75.75v5.75h5.75a.75.75 0 0 1 0 1.5h-5.75v5.75a.75.75 0 0 1-1.5 0v-5.75H3.5a.75.75 0 0 1 0-1.5h5.75V3.5A.75.75 0 0 1 10 2.75Z" />
    </Svg>
  );
}

export function GearGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M8.6 1.2a1 1 0 0 0-.98.8l-.3 1.5c-.45.18-.87.42-1.25.71l-1.45-.5a1 1 0 0 0-1.19.45L2.03 6.6a1 1 0 0 0 .21 1.25l1.15 1c-.04.38-.04.76 0 1.13l-1.15 1.01a1 1 0 0 0-.2 1.25l1.4 2.43a1 1 0 0 0 1.19.45l1.45-.5c.38.3.8.54 1.25.72l.3 1.5a1 1 0 0 0 .98.8h2.8a1 1 0 0 0 .98-.8l.3-1.5c.45-.18.87-.42 1.25-.71l1.45.5a1 1 0 0 0 1.19-.46l1.4-2.42a1 1 0 0 0-.2-1.25l-1.16-1.01c.05-.37.05-.75 0-1.13l1.15-1a1 1 0 0 0 .21-1.26l-1.4-2.42a1 1 0 0 0-1.19-.46l-1.45.5a5.4 5.4 0 0 0-1.25-.72l-.3-1.5a1 1 0 0 0-.98-.8H8.6ZM10 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </Svg>
  );
}

export function SearchGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M9 2.5a6.5 6.5 0 1 0 3.93 11.68l3.7 3.7a.75.75 0 1 0 1.06-1.06l-3.7-3.7A6.5 6.5 0 0 0 9 2.5ZM4 9a5 5 0 1 1 10 0A5 5 0 0 1 4 9Z" />
    </Svg>
  );
}

export function ShareGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M11.3 2.3a.75.75 0 0 1 .8.13l6.5 6a.75.75 0 0 1 0 1.1l-6.5 6a.75.75 0 0 1-1.26-.55V12c-3.7.08-5.88 1.2-7.46 3.75a.75.75 0 0 1-1.38-.47C2.6 9.9 5.6 7.4 10.84 7.03V3a.75.75 0 0 1 .46-.7Z" />
    </Svg>
  );
}

export function ChevronDownGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M4.47 7.47a.75.75 0 0 1 1.06 0L10 11.94l4.47-4.47a.75.75 0 1 1 1.06 1.06l-5 5a.75.75 0 0 1-1.06 0l-5-5a.75.75 0 0 1 0-1.06Z" />
    </Svg>
  );
}

export function ChevronRightGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M7.47 4.47a.75.75 0 0 1 1.06 0l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06L11.94 10 7.47 5.53a.75.75 0 0 1 0-1.06Z" />
    </Svg>
  );
}

export function ChevronLeftGlyph({ size = 16, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M12.53 4.47a.75.75 0 0 1 0 1.06L8.06 10l4.47 4.47a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" />
    </Svg>
  );
}

export function GlobeGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm6.92 8h-3.04a15.3 15.3 0 0 0-1.5-5.95A7.02 7.02 0 0 1 16.92 9ZM10 17c-.83 0-2.37-2.4-2.62-6h5.24c-.25 3.6-1.79 6-2.62 6ZM7.38 9C7.63 5.4 9.17 3 10 3s2.37 2.4 2.62 6H7.38Zm.24-5.95A15.3 15.3 0 0 0 6.12 9H3.08a7.02 7.02 0 0 1 4.54-5.95ZM3.08 11h3.04c.13 2.28.66 4.38 1.5 5.95A7.02 7.02 0 0 1 3.08 11Zm9.3 5.95c.84-1.57 1.37-3.67 1.5-5.95h3.04a7.02 7.02 0 0 1-4.54 5.95Z" />
    </Svg>
  );
}

export function LockGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 1.5A4.5 4.5 0 0 0 5.5 6v2H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-.5V6A4.5 4.5 0 0 0 10 1.5ZM12.5 8h-5V6a2.5 2.5 0 0 1 5 0v2ZM10 11.5a1.5 1.5 0 0 1 .75 2.8V15a.75.75 0 0 1-1.5 0v-.7A1.5 1.5 0 0 1 10 11.5Z" />
    </Svg>
  );
}

export function EyeGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 4C5.5 4 2.3 7 1.15 9.4a1.4 1.4 0 0 0 0 1.2C2.3 13 5.5 16 10 16s7.7-3 8.85-5.4a1.4 1.4 0 0 0 0-1.2C17.7 7 14.5 4 10 4Zm0 9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0-5.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" />
    </Svg>
  );
}

export function EyeOffGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M2.22 2.22a.75.75 0 0 1 1.06 0l14.5 14.5a.75.75 0 1 1-1.06 1.06l-2.33-2.33A8.9 8.9 0 0 1 10 16c-4.5 0-7.7-3-8.85-5.4a1.4 1.4 0 0 1 0-1.2 10.6 10.6 0 0 1 3.1-3.74L2.22 3.28a.75.75 0 0 1 0-1.06Zm5.3 5.3a3.5 3.5 0 0 0 4.96 4.96L7.52 7.52ZM10 4c4.5 0 7.7 3 8.85 5.4.18.38.18.82 0 1.2a10.4 10.4 0 0 1-2.02 2.87L13.4 10.04A3.5 3.5 0 0 0 9.96 6.6L7.68 4.32C8.42 4.12 9.2 4 10 4Z" />
    </Svg>
  );
}

export function ClockGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.75 4.5v4.19l2.78 2.78a.75.75 0 1 1-1.06 1.06l-3-3A.75.75 0 0 1 9.25 10V5.5a.75.75 0 0 1 1.5 0Z" />
    </Svg>
  );
}

export function PinGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M10 1a6.5 6.5 0 0 0-6.5 6.5c0 4.6 5.1 9.86 5.68 10.45a1.15 1.15 0 0 0 1.64 0c.58-.59 5.68-5.85 5.68-10.45A6.5 6.5 0 0 0 10 1Zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    </Svg>
  );
}

export function ChatGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M4 2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1v3a.75.75 0 0 0 1.24.57L10.28 15H16a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H4Zm1.75 4.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z" />
    </Svg>
  );
}

export function TagGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h5.38c.4 0 .78.16 1.06.44l7.62 7.62a1.5 1.5 0 0 1 0 2.12l-5.38 5.38a1.5 1.5 0 0 1-2.12 0L2.44 9.94A1.5 1.5 0 0 1 2 8.88V3.5ZM6 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </Svg>
  );
}

export function FileGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M5 1.5A2.5 2.5 0 0 0 2.5 4v12A2.5 2.5 0 0 0 5 18.5h10a2.5 2.5 0 0 0 2.5-2.5V7.62a1.5 1.5 0 0 0-.44-1.06l-4.62-4.62a1.5 1.5 0 0 0-1.06-.44H5Zm6 1.75L15.75 8H12a1 1 0 0 1-1-1V3.25Z" />
    </Svg>
  );
}

export function CalendarGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M6 1.25a.75.75 0 0 1 .75.75v1h6.5V2a.75.75 0 0 1 1.5 0v1H15a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h.25V2A.75.75 0 0 1 6 1.25ZM3.5 8v7c0 .83.67 1.5 1.5 1.5h10c.83 0 1.5-.67 1.5-1.5V8h-13Z" />
    </Svg>
  );
}

export function ImageGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v11A2.5 2.5 0 0 0 4.5 18h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 15.5 2h-11ZM7 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-3.5 9.94 3.47-3.47a.75.75 0 0 1 1.06 0l1.47 1.47 3.47-3.47a.75.75 0 0 1 1.06 0l2.47 2.47v3.06a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-.06Z" />
    </Svg>
  );
}

export function LeaveGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M4 2.5A2.5 2.5 0 0 0 1.5 5v10A2.5 2.5 0 0 0 4 17.5h5a.75.75 0 0 0 0-1.5H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5a.75.75 0 0 0 0-1.5H4Zm9.47 3.97a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H7.75a.75.75 0 0 1 0-1.5h7.44l-1.72-1.72a.75.75 0 0 1 0-1.06Z" />
    </Svg>
  );
}

export function BellOffGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M2.22 2.22a.75.75 0 0 1 1.06 0l14.5 14.5a.75.75 0 1 1-1.06 1.06L14.94 16H4.5a1 1 0 0 1-.8-1.6l.8-1.07V8.5c0-.68.12-1.33.35-1.93L2.22 3.28a.75.75 0 0 1 0-1.06ZM10 1.5a6 6 0 0 1 5.5 6v4.94L7 3.95A5.97 5.97 0 0 1 10 1.5ZM8 17h4a2 2 0 0 1-4 0Z" />
    </Svg>
  );
}

export function CloseGlyph({ size = 20, ...p }: P) {
  return (
    <Svg size={size} {...p}>
      <path d="M4.47 4.47a.75.75 0 0 1 1.06 0L10 8.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L11.06 10l4.47 4.47a.75.75 0 1 1-1.06 1.06L10 11.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L8.94 10 4.47 5.53a.75.75 0 0 1 0-1.06Z" />
    </Svg>
  );
}

/* ---------------- Colored composer icons (24px) ---------------- */

/** Group composer "Anonymous post": a light-blue hat and glasses. */
export function AnonymousPostIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#0EA5F7" aria-hidden>
      <path d="M7.6 3.2c.2-.7.9-1.1 1.6-.9l2.2.6c.4.1.8.1 1.2 0l2.2-.6c.7-.2 1.4.2 1.6.9l1.3 5.3H6.3l1.3-5.3Z" />
      <rect x="2" y="9.4" width="20" height="2.2" rx="1.1" />
      <path d="M6.6 12.9a3.6 3.6 0 0 1 3.4 2.4c.6-.4 1.3-.6 2-.6s1.4.2 2 .6a3.6 3.6 0 1 1-.2 1.9 2.6 2.6 0 0 0-3.6 0 3.6 3.6 0 1 1-3.6-4.3Z" />
    </svg>
  );
}

/** Group composer "Feeling/activity": an orange outlined smile. */
export function GroupFeelingIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="#E9710F" strokeWidth="2" />
      <circle cx="8.7" cy="9.4" r="1.4" fill="#E9710F" />
      <circle cx="15.3" cy="9.4" r="1.4" fill="#E9710F" />
      <path
        fill="#E9710F"
        d="M6.9 13.1h10.2a.6.6 0 0 1 .58.75C17 16.5 14.8 18.2 12 18.2s-5-1.7-5.68-4.35a.6.6 0 0 1 .58-.75Z"
      />
    </svg>
  );
}

/** Group composer "Poll": white bars on an orange disc. */
export function PollIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#F7A43B" />
      <rect x="7.4" y="9" width="2.2" height="8" rx="1.1" fill="#fff" />
      <rect x="10.9" y="6.5" width="2.2" height="10.5" rx="1.1" fill="#fff" />
      <rect x="14.4" y="10.5" width="2.2" height="6.5" rx="1.1" fill="#fff" />
    </svg>
  );
}

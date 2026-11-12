import { type ReactNode, type SVGProps, useId } from "react";

/**
 * Filled glyphs for Marketplace (Facebook draws its rail, category and
 * composer icons solid). All paths use `evenodd`, so inner subpaths are
 * cut-outs that show the circle behind them (grey or the active blue).
 */
type P = SVGProps<SVGSVGElement> & { size?: number };
const g = (size: number, p: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  fillRule: "evenodd" as const,
  clipRule: "evenodd" as const,
  "aria-hidden": true,
  ...p,
});

/** A filled shape with stroked cut-outs (a `$`, a check, seams) knocked out via a mask. */
function Knockout({
  size,
  p,
  shape,
  cut,
  cutWidth = 1.6,
}: {
  size: number;
  p: P;
  shape: ReactNode;
  cut: string;
  cutWidth?: number;
}) {
  const id = useId();
  return (
    <svg {...g(size, p)}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="#fff" />
        <path
          d={cut}
          fill="none"
          stroke="#000"
          strokeWidth={cutWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g mask={`url(#${id})`}>{shape}</g>
    </svg>
  );
}

/** A small `$` centred at (cx, cy), drawn as a stroke path. */
const dollar = (cx: number, cy: number) =>
  `M${cx + 1.9} ${cy - 1.9}c-.35-.8-1.1-1.2-1.9-1.2-1.15 0-1.95.6-1.95 1.4 0 1.9 4 1 4 3.1 0 .9-.85 1.5-2.05 1.5-.95 0-1.75-.45-2.1-1.3M${cx} ${cy - 4.2}v1.1m0 6.2v1.1`;

/* ───────────── Rail: Browse all … Selling ───────────── */

export function StoreIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M4.6 2h14.8a2 2 0 0 1 1.92 1.44l1.16 3.98A3.3 3.3 0 0 1 19.3 11.6a3.6 3.6 0 0 1-3.65-1.55A3.9 3.9 0 0 1 12 11.6a3.9 3.9 0 0 1-3.65-1.55A3.6 3.6 0 0 1 4.7 11.6a3.3 3.3 0 0 1-3.18-4.18l1.16-3.98A2 2 0 0 1 4.6 2Z" />
      <path d="M3.5 13.25c.38.08.78.12 1.2.12a5.4 5.4 0 0 0 3.65-1.38A5.6 5.6 0 0 0 12 13.37a5.6 5.6 0 0 0 3.65-1.38 5.4 5.4 0 0 0 3.65 1.38c.42 0 .82-.04 1.2-.12V20a2 2 0 0 1-2 2H14.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-2a1.5 1.5 0 0 0-1.5 1.5V22H5.5a2 2 0 0 1-2-2v-6.75Z" />
    </svg>
  );
}

export function BellFill({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M3 9.5a9 9 0 0 1 18 0v2.927c0 1.69.475 3.345 1.37 4.778a1.5 1.5 0 0 1-1.272 2.295H2.902a1.5 1.5 0 0 1-1.272-2.295A9.01 9.01 0 0 0 3 12.43V9.5Z" />
      <path d="M9.2 20.5h5.6a2.9 2.9 0 0 1-5.6 0Z" />
    </svg>
  );
}

export function InboxIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M5.5 2h13A3.5 3.5 0 0 1 22 5.5v13a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 18.5v-13A3.5 3.5 0 0 1 5.5 2Zm0 2.5a1 1 0 0 0-1 1V12h3.6a1 1 0 0 1 .93.63l.3.75A2.5 2.5 0 0 0 11.65 15h.7a2.5 2.5 0 0 0 2.32-1.62l.3-.75a1 1 0 0 1 .93-.63h3.6V5.5a1 1 0 0 0-1-1h-13Z" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 1.3 20.6 4.6v6.2c0 5.5-3.66 10.2-8.6 11.9-4.94-1.7-8.6-6.4-8.6-11.9V4.6L12 1.3Zm0 2.75L5.9 6.38v4.42c0 4.15 2.58 7.75 6.1 9.2 3.52-1.45 6.1-5.05 6.1-9.2V6.38L12 4.05Z" />
      <path d="M12 5.9 16.6 7.66v3.14c0 3.12-1.85 5.85-4.6 7.1-2.75-1.25-4.6-3.98-4.6-7.1V7.66L12 5.9Z" />
    </svg>
  );
}

export function BagIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M8 6.5a4 4 0 1 1 8 0h1.7a2 2 0 0 1 1.98 1.73l1.55 11.5A2 2 0 0 1 19.25 22H4.75a2 2 0 0 1-1.98-2.27l1.55-11.5A2 2 0 0 1 6.3 6.5H8Zm2 0h4a2 2 0 1 0-4 0Zm-.9 3.6a1 1 0 0 0-1.9.62 5 5 0 0 0 9.6 0 1 1 0 1 0-1.9-.62 3 3 0 0 1-5.8 0Z" />
    </svg>
  );
}

/** Plain price tag (the active "Your listings" / "Choose listing type" glyph). */
export function TagIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M13.2 2.5h6.3a2 2 0 0 1 2 2v6.3a2 2 0 0 1-.59 1.41l-8.5 8.5a2 2 0 0 1-2.82 0L3.79 14.9a2 2 0 0 1 0-2.82l8-8A2 2 0 0 1 13.2 2.5ZM16.75 5.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" />
    </svg>
  );
}

/** Price tag on a string (Selling, Classifieds, inactive "Your listings"). */
export function SellingTagIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M11.4 3.6h4.9a1.8 1.8 0 0 1 1.8 1.8v4.9a1.8 1.8 0 0 1-.53 1.27l-7.3 7.3a1.8 1.8 0 0 1-2.54 0L3.13 14.3a1.8 1.8 0 0 1 0-2.54l7-7a1.8 1.8 0 0 1 1.27-.53ZM14.6 6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
      <path
        d="M14.6 7.3c2.1-2.6 6.4-2.9 6.9-.2.5 2.6-2.4 3.4-3.7 5.6-1.1 1.9-.3 4.6 2.2 4.9 1.1.1 1.6-.4 1.6-.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ───────────── Rail: Buying / Selling sub-pages ───────────── */

export function ClockIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22Zm0 2.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z" />
      <path d="M11 6.5a1 1 0 1 1 2 0v5.03l2.9 2.32a1 1 0 1 1-1.25 1.56l-3.27-2.6A1 1 0 0 1 11 12V6.5Z" />
    </svg>
  );
}

export function BookmarkFill({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M6 1a3 3 0 0 0-3 3v17.5a1.5 1.5 0 0 0 2.38 1.21L12 17.9l6.62 4.81A1.5 1.5 0 0 0 21 21.5V4a3 3 0 0 0-3-3H6Z" />
    </svg>
  );
}

export function BookmarkOutline({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M3 4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v17.5a1.5 1.5 0 0 1-2.38 1.21L12 17.9l-6.62 4.81A1.5 1.5 0 0 1 3 21.5V4Zm3-1a1 1 0 0 0-1 1v16.04l6.41-4.66a1 1 0 0 1 1.18 0L19 20.04V4a1 1 0 0 0-1-1H6Z" />
    </svg>
  );
}

/** Purchased orders: an archive box. */
export function ArchiveIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M3.5 3h17A1.5 1.5 0 0 1 22 4.5v2A1.5 1.5 0 0 1 20.5 8h-17A1.5 1.5 0 0 1 2 6.5v-2A1.5 1.5 0 0 1 3.5 3Z" />
      <path d="M3.5 9.5h17V19a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 19V9.5Zm6 2.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z" />
    </svg>
  );
}

/** Submitted offers: a jar with a dollar sign. */
export function OfferJarIcon({ size = 20, ...p }: P) {
  return (
    <Knockout
      size={size}
      p={p}
      cut={dollar(12, 14.6)}
      shape={
        <>
          <rect x="5" y="1.5" width="14" height="3.5" rx="1.75" />
          <path d="M5.5 6.5h13a1 1 0 0 1 1 1v12a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 19.5v-12a1 1 0 0 1 1-1Z" />
        </>
      }
    />
  );
}

/** Your alerts: a ringing bell. */
export function AlertBellIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M5 10.5a7 7 0 0 1 14 0v2.4c0 1.3.37 2.57 1.06 3.67A1.3 1.3 0 0 1 18.96 18.5H5.04a1.3 1.3 0 0 1-1.1-1.93A6.9 6.9 0 0 0 5 12.9v-2.4Z" />
      <path d="M9.6 19.8h4.8a2.5 2.5 0 0 1-4.8 0Z" />
      <path
        d="M3.6 3.9A9.6 9.6 0 0 0 1.5 8.2m18.9-4.3a9.6 9.6 0 0 1 2.1 4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Following: a shop basket with a check. */
export function FollowingIcon({ size = 20, ...p }: P) {
  return (
    <Knockout
      size={size}
      p={p}
      cut="m8.6 14.6 2.4 2.4 4.4-4.6"
      cutWidth={1.8}
      shape={
        <>
          <rect x="6" y="1.8" width="12" height="1.8" rx=".9" />
          <rect x="4.5" y="4.6" width="15" height="1.8" rx=".9" />
          <path d="M5 7.6h14a2 2 0 0 1 2 2V19a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.6a2 2 0 0 1 2-2Z" />
        </>
      }
    />
  );
}

export function ChartIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M6 2a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H6Zm2 8a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4-3a1 1 0 0 1 1 1v9a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function BarsIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 2a2 2 0 0 1 2 2v16a2 2 0 1 1-4 0V4a2 2 0 0 1 2-2ZM5 12a2 2 0 0 1 2 2v6a2 2 0 1 1-4 0v-6a2 2 0 0 1 2-2Zm14-4a2 2 0 0 1 2 2v10a2 2 0 1 1-4 0V10a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function MegaphoneIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M20.4 2.6A1.4 1.4 0 0 1 22 4v15a1.4 1.4 0 0 1-1.6 1.4L13 17V6l7.4-3.4Z" />
      <path d="M4.5 6.5H11.5V16.5H10V20a2 2 0 0 1-4 0v-3.6A5 5 0 0 1 4.5 6.5Z" />
    </svg>
  );
}

export function HelpIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22Zm0 15.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM12 5a4 4 0 0 0-4 4 1 1 0 1 0 2 0 2 2 0 1 1 2.67 1.88A2.46 2.46 0 0 0 11 13.2v.8a1 1 0 1 0 2 0v-.8c0-.18.1-.35.3-.42A4 4 0 0 0 12 5Z" />
    </svg>
  );
}

export function GearIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M10.4 1.4a1.6 1.6 0 0 1 3.2 0l.18 1.37a8.97 8.97 0 0 1 2.16.9l1.1-.85a1.6 1.6 0 0 1 2.26 2.26l-.85 1.1c.38.67.68 1.4.9 2.16l1.37.18a1.6 1.6 0 0 1 0 3.2l-1.37.18a8.97 8.97 0 0 1-.9 2.16l.85 1.1a1.6 1.6 0 0 1-2.26 2.26l-1.1-.85c-.67.38-1.4.68-2.16.9l-.18 1.37a1.6 1.6 0 0 1-3.2 0l-.18-1.37a8.97 8.97 0 0 1-2.16-.9l-1.1.85a1.6 1.6 0 0 1-2.26-2.26l.85-1.1a8.97 8.97 0 0 1-.9-2.16L1.4 13.6a1.6 1.6 0 0 1 0-3.2l1.37-.18c.22-.76.52-1.49.9-2.16l-.85-1.1A1.6 1.6 0 0 1 5.08 4.7l1.1.85c.67-.38 1.4-.68 2.16-.9l.18-1.37ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </svg>
  );
}

export function PinIcon({ size = 16, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 1a8.5 8.5 0 0 0-8.5 8.5c0 3.2 1.9 6.3 3.9 8.6a35 35 0 0 0 4 3.8 1 1 0 0 0 1.2 0 35 35 0 0 0 4-3.8c2-2.3 3.9-5.4 3.9-8.6A8.5 8.5 0 0 0 12 1Zm0 5.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </svg>
  );
}

export function ShareArrow({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M13.3 2.3a1 1 0 0 1 1.1.2l8.3 8a1 1 0 0 1 0 1.44l-8.3 8a1 1 0 0 1-1.7-.72V15.1c-4.4.17-7.4 1.6-9.6 4.6a1 1 0 0 1-1.8-.7C2.1 12.3 6.4 8.4 12.7 7.95V3.22a1 1 0 0 1 .6-.92Z" />
    </svg>
  );
}

/* ───────────── Categories ───────────── */

export function CarIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M7.4 3h9.2a2 2 0 0 1 1.9 1.4L19.8 8.5h.7A1.5 1.5 0 0 1 22 10v7a1 1 0 0 1-1 1h-1v1.5a1.5 1.5 0 0 1-3 0V18H7v1.5a1.5 1.5 0 0 1-3 0V18H3a1 1 0 0 1-1-1v-7a1.5 1.5 0 0 1 1.5-1.5h.7L5.5 4.4A2 2 0 0 1 7.4 3Zm.6 2.2-1.1 3.3h10.2L16 5.2H8ZM6.25 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm11.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM10 12.25a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z" />
    </svg>
  );
}

const housePath =
  "M12 1.8c.37 0 .73.13 1.01.38l8.46 7.4A1.4 1.4 0 0 1 20.55 12H19.5v8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8H3.45a1.4 1.4 0 0 1-.92-2.45l8.46-7.38c.28-.24.64-.37 1.01-.37Z";

/** House with a dollar sign (Property Rentals). */
export function RentHouseIcon({ size = 20, ...p }: P) {
  return <Knockout size={size} p={p} cut={dollar(12, 14.8)} shape={<path d={housePath} />} />;
}

/** House with a door (Home Sales). */
export function HouseIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d={`${housePath}M10 15.5a2 2 0 0 1 4 0V22h-4v-6.5Z`} />
    </svg>
  );
}

export function ShirtIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M8.8 2.5h.4a2.8 2.8 0 0 0 5.6 0h.4c.3 0 .6.06.88.18l5.06 2.17a1.5 1.5 0 0 1 .86 1.06l.78 3.7a1.2 1.2 0 0 1-.96 1.42l-3.32.6V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20v-8.37l-3.32-.6a1.2 1.2 0 0 1-.96-1.42L2 5.91a1.5 1.5 0 0 1 .86-1.06l5.06-2.17c.28-.12.58-.18.88-.18Z" />
    </svg>
  );
}

export function PhoneIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M7.5 1.5h9A2.5 2.5 0 0 1 19 4v16a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 20V4a2.5 2.5 0 0 1 2.5-2.5Zm3.25 16.75a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" />
    </svg>
  );
}

export function TicketIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v2.65a2.9 2.9 0 0 0 0 5.7v2.65a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-2.65a2.9 2.9 0 0 0 0-5.7V6.5A2.5 2.5 0 0 1 4.5 4Zm10.25 2.5v2.25h1.5V6.5h-1.5Zm0 4.4v2.2h1.5v-2.2h-1.5Zm0 4.35v2.25h1.5v-2.25h-1.5Z" />
    </svg>
  );
}

export function HeartIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 21.2c-.3 0-.6-.1-.84-.27C8.1 18.8 2 14.2 2 8.7A5.7 5.7 0 0 1 7.7 3c1.75 0 3.3.82 4.3 2.1A5.45 5.45 0 0 1 16.3 3 5.7 5.7 0 0 1 22 8.7c0 5.5-6.1 10.1-9.16 12.23-.24.17-.54.27-.84.27Z" />
    </svg>
  );
}

export function GiftIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 6.6C10.6 3.3 7.4 1.9 6.3 3.6c-1 1.6.8 3 5.7 3Zm0 0c1.4-3.3 4.6-4.7 5.7-3 1 1.6-.8 3-5.7 3Z" />
      <path d="M3.5 7.8h7.75V12H2.5V8.8a1 1 0 0 1 1-1Zm9.25 0h7.75a1 1 0 0 1 1 1V12h-8.75V7.8Z" />
      <path d="M3.75 13.5h7.5V22H5.75a2 2 0 0 1-2-2v-6.5Zm9 0h7.5V20a2 2 0 0 1-2 2h-5.5v-8.5Z" />
    </svg>
  );
}

export function SproutIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M11.2 11.6C7.3 11.5 4.5 9.3 4.2 4.6c3.9-.1 6.4 1.7 7 5V11.6Z" />
      <path d="M12.8 13.2V9.4c.5-3.6 3.1-6 7.2-6.1-.1 4.8-3 7.6-6.4 7.8v2.1h-.8Z" />
      <path d="M6.2 14h11.6a1 1 0 0 1 .98 1.2l-1.2 5.6A1.5 1.5 0 0 1 16.12 22H7.88a1.5 1.5 0 0 1-1.46-1.2l-1.2-5.6A1 1 0 0 1 6.2 14Z" />
    </svg>
  );
}

export function PaletteIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 2c5.6 0 10 3.6 10 8.3 0 3.4-2.7 5.7-6 5.7h-2.2a1.6 1.6 0 0 0-1.2 2.7 1.8 1.8 0 0 1-1.3 3.1C6.3 21.8 2 17.4 2 11.9 2 6.4 6.5 2 12 2ZM7 9.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm3-4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm3 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />
    </svg>
  );
}

export function SofaIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M8 3.5h8a3 3 0 0 1 3 3v2.6a2.9 2.9 0 0 0-2.5 2.9v1.5h-9V12a2.9 2.9 0 0 0-2.5-2.9V6.5a3 3 0 0 1 3-3Z" />
      <path d="M3.5 10.5A1.5 1.5 0 0 1 5 12v3.5h14V12a1.5 1.5 0 0 1 3 0v6a1 1 0 0 1-1 1h-1v1.25a1 1 0 0 1-2 0V19H6v1.25a1 1 0 0 1-2 0V19H3a1 1 0 0 1-1-1v-6a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

export function WrenchIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M21.55 6.4a.7.7 0 0 0-1.17-.3l-2.6 2.6-2.35-.13-.13-2.35 2.6-2.6a.7.7 0 0 0-.3-1.17 6.1 6.1 0 0 0-7.4 7.6L2.9 17.4a2.5 2.5 0 0 0 3.54 3.54l7.35-7.35a6.1 6.1 0 0 0 7.76-7.19Z" />
    </svg>
  );
}

export function MusicIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M20.5 3.2v12.8a3.5 3.5 0 1 1-2-3.16V8.1L10 9.95V18a3.5 3.5 0 1 1-2-3.16V5.4a1.2 1.2 0 0 1 .94-1.17l10.1-2.2A1.2 1.2 0 0 1 20.5 3.2Z" />
    </svg>
  );
}

export function BriefcaseIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M9.5 2.5h5A1.5 1.5 0 0 1 16 4v2h-2V4.5h-4V6H8V4a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M4 7h16a2 2 0 0 1 2 2v3.5H2V9a2 2 0 0 1 2-2Z" />
      <path d="M2 14h8.25v.75a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1V14H22v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z" />
    </svg>
  );
}

export function PawIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 11.2c-3 0-6 3.8-6 6.6 0 1.9 1.5 2.9 3.3 2.4.95-.27 1.8-.6 2.7-.6.9 0 1.75.33 2.7.6 1.8.5 3.3-.5 3.3-2.4 0-2.8-3-6.6-6-6.6Z" />
      <ellipse cx="4.6" cy="10.6" rx="2" ry="2.4" />
      <ellipse cx="19.4" cy="10.6" rx="2" ry="2.4" />
      <ellipse cx="9" cy="5.6" rx="2.1" ry="2.6" />
      <ellipse cx="15" cy="5.6" rx="2.1" ry="2.6" />
    </svg>
  );
}

export function BallIcon({ size = 20, ...p }: P) {
  return (
    <Knockout
      size={size}
      p={p}
      cutWidth={1.4}
      cut="M2 12h20M12 2v20M5 4.8c2.4 2 3.6 4.4 3.6 7.2S7.4 17.2 5 19.2M19 4.8c-2.4 2-3.6 4.4-3.6 7.2s1.2 5.2 3.6 7.2"
      shape={<circle cx="12" cy="12" r="10.5" />}
    />
  );
}

export function ControllerIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M7.2 5.5h9.6a5 5 0 0 1 4.92 4.1l1 5.5a3.2 3.2 0 0 1-5.5 2.75L15.4 16H8.6l-1.82 1.85a3.2 3.2 0 0 1-5.5-2.75l1-5.5A5 5 0 0 1 7.2 5.5Zm-.45 3.5v1.75H5v1.5h1.75V14h1.5v-1.75H10v-1.5H8.25V9h-1.5ZM16 9.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm2 2.5a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" />
    </svg>
  );
}

export function PeopleIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM8 13h2a6 6 0 0 1 6 6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a6 6 0 0 1 6-6Z" />
      <path d="M16.75 5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Zm.55 8h-.7a7.5 7.5 0 0 1 1.9 5v3h3.5a1 1 0 0 0 1-1v-1.5a5.5 5.5 0 0 0-5.7-5.5Z" />
    </svg>
  );
}

/* ───────────── Composer ───────────── */

export function PhotosAddIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M9.5 2h9A3.5 3.5 0 0 1 22 5.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 6 14.5v-9A3.5 3.5 0 0 1 9.5 2Zm3.75 4v3.25H10v1.5h3.25V14h1.5v-3.25H18v-1.5h-3.25V6h-1.5Z" />
      <path d="M3 7.5a1.25 1.25 0 0 1 1.25 1.25V17A2.75 2.75 0 0 0 7 19.75h8.25a1.25 1.25 0 0 1 0 2.5H7A5.25 5.25 0 0 1 1.75 17V8.75C1.75 8.06 2.31 7.5 3 7.5Z" />
    </svg>
  );
}

export function VideoAddIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M4.5 5h10A3.5 3.5 0 0 1 18 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-10A3.5 3.5 0 0 1 1 15.5v-7A3.5 3.5 0 0 1 4.5 5Zm4.25 3.75v2.5h-2.5v1.5h2.5v2.5h1.5v-2.5h2.5v-1.5h-2.5v-2.5h-1.5Z" />
      <path d="m19.5 9.6 2.25-1.6A.8.8 0 0 1 23 8.65v6.7a.8.8 0 0 1-1.25.65L19.5 14.4V9.6Z" />
    </svg>
  );
}

export function RocketIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M21.9 2.1c-4.6-.6-8.7 1.2-11.7 5.3L6.2 7.7a1 1 0 0 0-.73.38L3.2 10.9a.6.6 0 0 0 .35.96l4.1.85 3.65 3.65.85 4.1a.6.6 0 0 0 .96.35l2.82-2.27a1 1 0 0 0 .38-.73l.3-4c4.1-3 5.9-7.1 5.3-11.7ZM15.6 6.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path
        d="M6.3 17.7 3.5 20.5m4.6-1.2-1.7 1.7M4.7 15.9 3 17.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M7 10V7a5 5 0 0 1 10 0v3h.5A2.5 2.5 0 0 1 20 12.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-7A2.5 2.5 0 0 1 6.5 10H7Zm2.5 0h5V7a2.5 2.5 0 0 0-5 0v3Z" />
    </svg>
  );
}

/** Messenger glyph in Messenger's blue. */
export function MessengerGradient({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 13" width={size} height={size} aria-hidden>
      <path
        fill="#0866FF"
        d="M6 .5C2.75.5.25 2.88.25 6.08c0 1.67.69 3.12 1.8 4.12.1.08.15.21.16.34l.03 1.02c.01.33.35.54.65.41l1.14-.5a.46.46 0 0 1 .3-.02c.53.14 1.08.22 1.67.22 3.25 0 5.75-2.38 5.75-5.58S9.25.5 6 .5Z"
      />
      <path
        fill="#fff"
        d="M9.45 4.8 7.76 7.47a.87.87 0 0 1-1.25.23L5.17 6.7a.35.35 0 0 0-.42 0l-1.81 1.37c-.24.18-.56-.1-.4-.36L4.24 5.03a.87.87 0 0 1 1.25-.23l1.34 1a.35.35 0 0 0 .42 0l1.81-1.37c.24-.18.56.1.4.36Z"
      />
    </svg>
  );
}

/** Rail icons for each browse category. */
export const CATEGORY_ICONS: Record<string, ReactNode> = {
  vehicles: <CarIcon />,
  propertyrentals: <RentHouseIcon />,
  apparel: <ShirtIcon />,
  classifieds: <SellingTagIcon />,
  electronics: <PhoneIcon />,
  entertainment: <TicketIcon />,
  family: <HeartIcon />,
  free: <GiftIcon />,
  garden: <SproutIcon />,
  hobbies: <PaletteIcon />,
  home: <SofaIcon />,
  "home-improvements": <WrenchIcon />,
  propertyforsale: <HouseIcon />,
  instruments: <MusicIcon />,
  "office-supplies": <BriefcaseIcon />,
  pets: <PawIcon />,
  sports: <BallIcon />,
  toys: <ControllerIcon />,
  groups: <PeopleIcon />,
};

/** Facebook's grey paper-plane empty-state illustration (112px). */
export function PaperPlane({ size = 112 }: { size?: number }) {
  return (
    <svg viewBox="0 0 112 112" width={size} height={size} aria-hidden>
      <path fill="#BCC0C4" d="M12 64 86 26 70 92 54 74Z" />
      <path fill="#8A8D91" d="M86 26 54 74l-4 18Z" />
      <path fill="#0866FF" d="m50 92 4-18 8 8Z" />
      <path fill="#A8ABAF" d="M86 26 54 74l16 18Z" />
    </svg>
  );
}

/** Facebook's grey list-document empty-state illustration (112px). */
export function ListDoc({ size = 112 }: { size?: number }) {
  return (
    <svg viewBox="0 0 112 112" width={size} height={size} aria-hidden>
      <path fill="#0866FF" d="M26 16a10 10 0 0 1 20 0Z" />
      <rect x="34" y="14" width="64" height="82" rx="10" fill="#BCC0C4" />
      <path fill="#BCC0C4" d="M26 16h20v10H26z" />
      {[36, 54, 72].map((y) => (
        <g key={y}>
          <circle cx="48" cy={y} r="3.5" fill="#fff" />
          <rect x="58" y={y - 3} width="30" height="6" rx="3" fill="#65686C" />
        </g>
      ))}
    </svg>
  );
}

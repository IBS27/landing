import {
  Armchair,
  Baby,
  Car,
  Drama,
  Guitar,
  Hammer,
  Home,
  Paperclip,
  PawPrint,
  Puzzle,
  Shirt,
  Smartphone,
  Sprout,
  Store,
  Tags,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode, SVGProps } from "react";

/** Filled 20px glyphs for the Marketplace rail (Facebook draws these solid). */
type P = SVGProps<SVGSVGElement> & { size?: number };
const g = (size: number, p: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  ...p,
});

export function StoreIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M2.5 2a1.5 1.5 0 0 0-1.42 1.03L.15 5.8A3.5 3.5 0 0 0 2 10.33V20a2 2 0 0 0 2 2h4v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6h4a2 2 0 0 0 2-2v-9.67a3.5 3.5 0 0 0 1.85-4.53l-.93-2.77A1.5 1.5 0 0 0 21.5 2h-19Z" />
    </svg>
  );
}

export function BellFill({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M3 9.5a9 9 0 0 1 18 0v2.927c0 1.69.475 3.345 1.37 4.778a1.5 1.5 0 0 1-1.272 2.295h-4.625a4.5 4.5 0 0 1-8.946 0H2.902a1.5 1.5 0 0 1-1.272-2.295A9.01 9.01 0 0 0 3 12.43V9.5Zm6.55 10a2.5 2.5 0 0 0 4.9 0h-4.9Z" />
    </svg>
  );
}

export function InboxIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M6 2a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H6Zm-2 11h3.38a1 1 0 0 1 .9.55l.45.9a1 1 0 0 0 .9.55h4.74a1 1 0 0 0 .9-.55l.45-.9a1 1 0 0 1 .9-.55H20v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M11.3 1.2a2 2 0 0 1 1.4 0l7 2.6A2 2 0 0 1 21 5.67V11c0 5.14-3.6 9.72-8.55 11.15a1.6 1.6 0 0 1-.9 0C6.6 20.72 3 16.14 3 11V5.67a2 2 0 0 1 1.3-1.87l7-2.6ZM12 4.1 6 6.33V11c0 3.63 2.4 6.9 6 8.08V4.1Z" />
    </svg>
  );
}

export function BagIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M8 6a4 4 0 1 1 8 0h1.6a2 2 0 0 1 1.98 1.72l1.7 12A2 2 0 0 1 19.3 22H4.7a2 2 0 0 1-1.98-2.28l1.7-12A2 2 0 0 1 6.4 6H8Zm2 0h4a2 2 0 1 0-4 0Zm-1 4a1 1 0 0 0-2 0 5 5 0 0 0 10 0 1 1 0 1 0-2 0 3 3 0 0 1-6 0Z" />
    </svg>
  );
}

export function TagIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M13.17 2a3 3 0 0 1 2.12.88l6.83 6.83a3 3 0 0 1 0 4.24l-7.17 7.17a3 3 0 0 1-4.24 0l-6.83-6.83A3 3 0 0 1 3 12.17V5a3 3 0 0 1 3-3h7.17ZM8.5 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </svg>
  );
}

export function ClockIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path
        fillRule="evenodd"
        d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm-1 5h2v5.59l3.7 3.7-1.41 1.42L11 12.41V6Z"
      />
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

export function ShareArrow({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M13.3 2.3a1 1 0 0 1 1.1.2l8.3 8a1 1 0 0 1 0 1.44l-8.3 8a1 1 0 0 1-1.7-.72V15.1c-4.4.17-7.4 1.6-9.6 4.6a1 1 0 0 1-1.8-.7C2.1 12.3 6.4 8.4 12.7 7.95V3.22a1 1 0 0 1 .6-.92Z" />
    </svg>
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
      <path d="M10 3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v18a2 2 0 0 1-4 0V3ZM3 13a2 2 0 1 1 4 0v8a2 2 0 1 1-4 0v-8Zm14-4a2 2 0 1 1 4 0v12a2 2 0 1 1-4 0V9Z" />
    </svg>
  );
}

export function MegaphoneIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M20.6 2.2A1.5 1.5 0 0 1 22 3.7v14.6a1.5 1.5 0 0 1-2.06 1.39L13 16.9V7.1l6.94-2.79a1.5 1.5 0 0 1 .66-.11ZM11 7H5a4 4 0 0 0-1 7.87V19a3 3 0 0 0 6 0v-3h1V7Z" />
    </svg>
  );
}

export function HelpIcon({ size = 20, ...p }: P) {
  return (
    <svg {...g(size, p)}>
      <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 15.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 5a4 4 0 0 1 1.3 7.78c-.2.07-.3.24-.3.42V14a1 1 0 1 1-2 0v-.8c0-1.08.7-2 1.67-2.32A2 2 0 1 0 10 9a1 1 0 1 1-2 0 4 4 0 0 1 4-4Z" />
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

/** Messenger glyph in Messenger's blue-purple gradient. */
export function MessengerGradient({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 13" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="mp-msgr" cx="19%" cy="99%" r="108%">
          <stop offset="0" stopColor="#09f" />
          <stop offset=".6" stopColor="#a033ff" />
          <stop offset=".9" stopColor="#ff5280" />
          <stop offset="1" stopColor="#ff7061" />
        </radialGradient>
      </defs>
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
const s = { size: 20, strokeWidth: 2.25 } as const;
export const CATEGORY_ICONS: Record<string, ReactNode> = {
  vehicles: <Car {...s} />,
  propertyrentals: <Home {...s} />,
  apparel: <Shirt {...s} />,
  classifieds: <Tags {...s} />,
  electronics: <Smartphone {...s} />,
  entertainment: <Drama {...s} />,
  family: <Baby {...s} />,
  free: <TagIcon />,
  garden: <Sprout {...s} />,
  hobbies: <Puzzle {...s} />,
  home: <Armchair {...s} />,
  "home-improvements": <Hammer {...s} />,
  propertyforsale: <Store {...s} />,
  instruments: <Guitar {...s} />,
  "office-supplies": <Paperclip {...s} />,
  pets: <PawPrint {...s} />,
  sports: <Trophy {...s} />,
  toys: <Puzzle {...s} />,
  groups: <Users {...s} />,
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

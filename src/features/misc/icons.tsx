import { useId } from "react";

/**
 * Glyphs for the secondary surfaces (menu, settings, gaming, pages). Facebook
 * draws these as filled 20px shapes; lucide only covers the outline ones.
 */

type P = { size?: number; className?: string };

export function GearFilled({ size = 20, className }: P) {
  const id = useId().replace(/:/g, "");
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <mask id={`g${id}`}>
        <rect width="20" height="20" fill="#fff" />
        <circle cx="10" cy="10" r="2.6" fill="#000" />
      </mask>
      <g fill="currentColor" mask={`url(#g${id})`}>
        <circle cx="10" cy="10" r="6.2" />
        {teeth.map((a) => (
          <rect
            key={a}
            x="8.4"
            y="1.4"
            width="3.2"
            height="4"
            rx="1"
            transform={`rotate(${a} 10 10)`}
          />
        ))}
      </g>
    </svg>
  );
}

export function ControllerFilled({ size = 20, className }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M5.6 4.5h8.8c2.5 0 4.4 2 4.6 4.5l.3 3.6c.2 2.1-1.4 3.9-3.5 3.9-1 0-2-.5-2.7-1.3l-.8-1H7.7l-.8 1c-.7.8-1.7 1.3-2.7 1.3-2.1 0-3.7-1.8-3.5-3.9L1 9c.2-2.5 2.1-4.5 4.6-4.5Zm.6 3a.75.75 0 0 0-.75.75v1h-1a.75.75 0 0 0 0 1.5h1v1a.75.75 0 0 0 1.5 0v-1h1a.75.75 0 0 0 0-1.5h-1v-1a.75.75 0 0 0-.75-.75Zm7.3.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-1.7 2.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      />
    </svg>
  );
}

export function BellFilled({ size = 20, className }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M10 1.5a6 6 0 0 0-6 6v3.2l-1.6 2.6A1 1 0 0 0 3.3 15h13.4a1 1 0 0 0 .9-1.7L16 10.7V7.5a6 6 0 0 0-6-6Zm-2.6 15a2.7 2.7 0 0 0 5.2 0H7.4Z"
      />
    </svg>
  );
}

export function BookmarkFilled({ size = 20, className }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M5.5 1.5h9A1.5 1.5 0 0 1 16 3v14.6a.9.9 0 0 1-1.4.7L10 15l-4.6 3.3a.9.9 0 0 1-1.4-.7V3a1.5 1.5 0 0 1 1.5-1.5Z"
      />
    </svg>
  );
}

export function CompassFilled({ size = 20, className }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10 1a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm3.6 5.4-5 1.6a1 1 0 0 0-.6.6l-1.6 5c-.1.3.2.6.5.5l5-1.6a1 1 0 0 0 .6-.6l1.6-5c.1-.3-.2-.6-.5-.5ZM10 8.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"
      />
    </svg>
  );
}

export function MetaInfinity({ size = 24, className }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="M6.4 7C3.8 7 2 10 2 13.3 2 15.6 3.1 17 4.9 17c1.9 0 3.2-1.7 5.6-6 1.5-2.7 2.8-4 4.4-4 2.6 0 4.4 3.3 4.4 6.6 0 2-1 3.4-2.6 3.4-1.9 0-3-1.6-5.4-5.8C9.5 8.4 8.2 7 6.4 7Z" />
    </svg>
  );
}

/** Meta AI's gradient ring. */
export function MetaAIRing({ size = 36, className }: P) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0082FB" />
          <stop offset="0.5" stopColor="#A142F4" />
          <stop offset="1" stopColor="#E040A0" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="13.5" fill="none" stroke={`url(#m${id})`} strokeWidth="5" />
    </svg>
  );
}

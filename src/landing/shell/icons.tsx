import { useId } from "react";

/** Landing's mark: a map pin with a house, in Facebook's colorful bookmark style (36x36). */
export function BmLanding({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
      <defs>
        <linearGradient id={id} x1="6" y1="2" x2="30" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#36B3F9" />
          <stop offset="1" stopColor="#5541FD" />
        </linearGradient>
      </defs>
      <path
        d="M18 2.5C11.1 2.5 5.5 7.9 5.5 14.7c0 8.7 10.6 17.5 11.4 18.2.6.5 1.6.5 2.2 0 .8-.7 11.4-9.5 11.4-18.2C30.5 7.9 24.9 2.5 18 2.5Z"
        fill={`url(#${id})`}
      />
      <path
        d="M11.8 14.9 18 9.7l6.2 5.2v6.4c0 .6-.5 1.1-1.1 1.1h-3.3v-4.1h-3.6v4.1h-3.3c-.6 0-1.1-.5-1.1-1.1Z"
        fill="#fff"
      />
    </svg>
  );
}

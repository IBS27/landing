import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24, p: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  ...p,
});

/* ---------- Brand ---------- */

export function FacebookLogo({ size = 40, ...p }: P) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} {...p}>
      <path
        fill="#0866FF"
        d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87Z"
      />
      <path
        fill="#fff"
        d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.5h-4.867v12.37a18.183 18.183 0 0 1-6.53-.399Z"
      />
    </svg>
  );
}

export function FacebookWordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "Helvetica, Arial, sans-serif",
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: "#0866FF",
      }}
    >
      facebook
    </span>
  );
}

/* ---------- Top navigation tabs (outline when idle, filled when active) ---------- */

export function HomeIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M8.99 23H7.93c-1.354 0-2.471 0-3.355-.119-.928-.125-1.747-.396-2.403-1.053-.656-.656-.928-1.475-1.053-2.403C1 18.541 1 17.425 1 16.07v-4.875c0-1.204-.000-2.07.209-2.875a6 6 0 0 1 .955-1.943c.493-.664 1.153-1.21 2.07-1.966l2.986-2.465c.997-.823 1.83-1.511 2.574-1.979C10.582.443 11.244.207 12 .207c.756 0 1.418.236 2.206.733.743.468 1.577 1.156 2.574 1.979l2.987 2.465c.916.756 1.576 1.302 2.07 1.966a6 6 0 0 1 .954 1.943c.21.805.209 1.67.209 2.875v4.875c0 1.354 0 2.47-.119 3.354-.125.928-.396 1.747-1.053 2.403-.656.657-1.475.928-2.403 1.053-.884.12-2 .119-3.354.119H15.01a.5.5 0 0 1-.5-.5v-5.5a2.5 2.5 0 0 0-5 0V22.5a.5.5 0 0 1-.5.5Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M9.464 1.286C10.294.803 11.092.5 12 .5c.908 0 1.707.303 2.537.786.795.462 1.7 1.142 2.815 1.977l2.232 1.675c1.391 1.042 2.359 1.766 2.888 2.826.53 1.059.53 2.268.528 4.006v4.3c0 1.355 0 2.471-.119 3.355-.124.928-.396 1.747-1.052 2.403-.657.657-1.476.928-2.404 1.053-.884.119-2 .119-3.354.119H7.93c-1.354 0-2.471 0-3.355-.119-.928-.125-1.747-.396-2.403-1.053-.656-.656-.928-1.475-1.053-2.403C1 18.541 1 17.425 1 16.07v-4.3c0-1.738-.002-2.947.528-4.006.53-1.06 1.497-1.784 2.888-2.826L6.65 3.263c1.114-.835 2.02-1.515 2.815-1.977ZM10.47 3.015c-.703.409-1.53 1.028-2.69 1.898l-2 1.5c-1.68 1.26-2.198 1.693-2.462 2.22C3.05 9.162 3 9.835 3 11.936V16c0 1.436.002 2.437.103 3.192.099.734.28 1.122.556 1.399.277.277.665.457 1.4.556.754.101 1.756.103 3.191.103H9.5v-4a2.5 2.5 0 0 1 5 0v4h1.25c1.435 0 2.436-.002 3.192-.103.734-.099 1.122-.28 1.399-.556.277-.277.457-.665.556-1.4.101-.754.103-1.755.103-3.191v-4.064c0-2.101-.05-2.774-.318-3.303-.264-.527-.782-.96-2.463-2.22l-2-1.5c-1.16-.87-1.986-1.489-2.69-1.898C12.84 2.619 12.403 2.5 12 2.5c-.403 0-.84.119-1.53.515Z" />
    </svg>
  );
}

export function FriendsIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M8.5 1a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm8.5 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM8.5 13C4.32 13 1 15.43 1 18.5v1A3.5 3.5 0 0 0 4.5 23h8a3.5 3.5 0 0 0 3.5-3.5v-1c0-3.07-3.32-5.5-7.5-5.5Zm9.5 9.5a5.43 5.43 0 0 0 .4-2v-2c0-1.74-.82-3.26-2.13-4.42C21.23 12.9 23 15.2 23 17.5v1.5a3.5 3.5 0 0 1-3.5 3.5H18Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M8.5 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Zm13.5-1a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-4 2a4 4 0 1 1 8 0 4 4 0 0 1-8 0ZM1 18.5C1 15.43 4.32 13 8.5 13s7.5 2.43 7.5 5.5v1a3.5 3.5 0 0 1-3.5 3.5h-8A3.5 3.5 0 0 1 1 19.5v-1Zm7.5-3.5C5.19 15 3 16.82 3 18.5v1A1.5 1.5 0 0 0 4.5 21h8a1.5 1.5 0 0 0 1.5-1.5v-1c0-1.68-2.19-3.5-5.5-3.5Zm9.06 3.03a1 1 0 0 1 1.02-.98C21.07 17.13 23 18.46 23 20.5a2.5 2.5 0 0 1-2.5 2.5H18a1 1 0 1 1 0-2h2.5a.5.5 0 0 0 .5-.5c0-.68-.72-1.4-2.46-1.45a1 1 0 0 1-.98-1.02Z" />
    </svg>
  );
}

export function VideoIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M7.93 1h8.14c1.354 0 2.471 0 3.355.119.928.125 1.747.396 2.403 1.053.657.656.928 1.475 1.053 2.403C23 5.459 23 6.575 23 7.93v8.14c0 1.354 0 2.471-.119 3.355-.125.928-.396 1.747-1.053 2.403-.656.657-1.475.928-2.403 1.053-.884.119-2 .119-3.354.119H7.93c-1.354 0-2.471 0-3.355-.119-.928-.125-1.747-.396-2.403-1.053-.656-.656-.928-1.475-1.053-2.403C1 18.541 1 17.425 1 16.07V7.93c0-1.354 0-2.471.119-3.355.125-.928.396-1.747 1.053-2.403.656-.657 1.475-.928 2.403-1.053C5.459 1 6.575 1 7.93 1Zm2.03 7.27a.75.75 0 0 0-1.15.63v6.2a.75.75 0 0 0 1.15.63l4.86-3.1a.75.75 0 0 0 0-1.26l-4.86-3.1Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M10.996 8.132A1 1 0 0 0 9.5 9v6a1 1 0 0 0 1.496.868l5.25-3a1 1 0 0 0 0-1.736l-5.25-3ZM7.93 1h8.14c1.354 0 2.471 0 3.355.119.928.125 1.747.396 2.403 1.053.657.656.928 1.475 1.053 2.403C23 5.459 23 6.575 23 7.93v8.14c0 1.354 0 2.471-.119 3.355-.125.928-.396 1.747-1.053 2.403-.656.657-1.475.928-2.403 1.053-.884.119-2 .119-3.354.119H7.93c-1.354 0-2.471 0-3.355-.119-.928-.125-1.747-.396-2.403-1.053-.656-.656-.928-1.475-1.053-2.403C1 18.541 1 17.425 1 16.07V7.93c0-1.354 0-2.471.119-3.355.125-.928.396-1.747 1.053-2.403.656-.657 1.475-.928 2.403-1.053C5.459 1 6.575 1 7.93 1ZM4.84 3.1c-.734.1-1.122.28-1.399.557-.277.277-.457.665-.556 1.4C2.784 5.811 2.782 6.812 2.782 8.247v7.508c0 1.435.002 2.436.103 3.192.099.734.28 1.122.556 1.399.277.277.665.457 1.4.556.754.101 1.755.103 3.191.103h7.936c1.435 0 2.436-.002 3.192-.103.734-.099 1.122-.28 1.399-.556.277-.277.457-.665.556-1.4.101-.755.103-1.756.103-3.191V8.247c0-1.435-.002-2.436-.103-3.191-.099-.735-.28-1.123-.556-1.4-.277-.277-.665-.457-1.4-.556-.755-.101-1.756-.103-3.191-.103H8.032c-1.435 0-2.437.002-3.192.103Z" />
    </svg>
  );
}

export function GroupsIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 4.5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Zm-5.5 2a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm11 0a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5ZM12 13.5c2.86 0 5.12 1.5 5.62 3.9a8.98 8.98 0 0 1-11.24 0c.5-2.4 2.76-3.9 5.62-3.9Zm-6.3.03a6.6 6.6 0 0 0-1.43 2.6A8.97 8.97 0 0 1 3.13 14c.66-.32 1.53-.5 2.57-.47Zm12.6 0c1.04-.03 1.91.15 2.57.47a8.97 8.97 0 0 1-1.14 2.13 6.6 6.6 0 0 0-1.43-2.6Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M12 3a9 9 0 0 0-7.34 14.21c.86-2.13 2.66-3.6 4.89-4.21A4.24 4.24 0 0 1 7.75 9.5a4.25 4.25 0 1 1 6.7 3.5c2.23.6 4.03 2.08 4.89 4.21A9 9 0 0 0 12 3Zm5.86 15.82C17.33 16.54 15.04 15 12 15s-5.33 1.54-5.86 3.82A8.96 8.96 0 0 0 12 21a8.96 8.96 0 0 0 5.86-2.18ZM1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12Zm11-4.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
    </svg>
  );
}

export function GamingIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M8 4h8c3.87 0 7 3.13 7 7v3.5a5.5 5.5 0 0 1-10 3.17L12.3 17h-.6l-.7.67A5.5 5.5 0 0 1 1 14.5V11c0-3.87 3.13-7 7-7Zm-1 4a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2H8V9a1 1 0 0 0-1-1Zm9.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm-2 3a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M8 6a5 5 0 0 0-5 5v3.5a3.5 3.5 0 0 0 6.25 2.16l.88-1.08A1.5 1.5 0 0 1 11.3 15h1.4c.45 0 .88.2 1.17.55l.88 1.08A3.5 3.5 0 0 0 21 14.5V11a5 5 0 0 0-5-5H8Zm-7 5c0-3.87 3.13-7 7-7h8c3.87 0 7 3.13 7 7v3.5a5.5 5.5 0 0 1-9.8 3.44L12.53 17h-1.06l-.67.94A5.5 5.5 0 0 1 1 14.5V11Zm6-3a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2H8v1a1 1 0 1 1-2 0v-1H5a1 1 0 1 1 0-2h1V9a1 1 0 0 1 1-1Zm8.25 1.25a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Zm-2 2.75a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Z" />
    </svg>
  );
}

export function MarketplaceIcon({ active, size = 24, ...p }: P & { active?: boolean }) {
  return active ? (
    <svg {...base(size, p)}>
      <path d="M2.5 2a1.5 1.5 0 0 0-1.42 1.03L.15 5.8A3.5 3.5 0 0 0 2 10.33V20a2 2 0 0 0 2 2h4v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6h4a2 2 0 0 0 2-2v-9.67a3.5 3.5 0 0 0 1.85-4.53l-.93-2.77A1.5 1.5 0 0 0 21.5 2h-19Z" />
    </svg>
  ) : (
    <svg {...base(size, p)}>
      <path d="M2.5 2a1.5 1.5 0 0 0-1.42 1.03L.15 5.8A3.5 3.5 0 0 0 2 10.33V20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9.67a3.5 3.5 0 0 0 1.85-4.53l-.93-2.77A1.5 1.5 0 0 0 21.5 2h-19Zm.38 2h18.24l.78 2.33A1.5 1.5 0 0 1 20.5 8.5h-.33a1.5 1.5 0 0 1-1.47-1.2 1 1 0 0 0-1.96 0 1.5 1.5 0 0 1-2.94 0 1 1 0 0 0-1.96 0 1.5 1.5 0 0 1-2.94 0 1 1 0 0 0-1.96 0A1.5 1.5 0 0 1 5.47 8.5h-.33A1.5 1.5 0 0 1 3.1 6.33L2.88 4ZM4 10.43c.63-.12 1.21-.4 1.7-.79a3.48 3.48 0 0 0 4.3 0 3.48 3.48 0 0 0 4 .1 3.48 3.48 0 0 0 4.3-.1c.49.39 1.07.67 1.7.79V20h-4v-4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4H4v-9.57ZM10 20v-4h4v4h-4Z" />
    </svg>
  );
}

/* ---------- Header circle buttons ---------- */

export function MenuGridIcon({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} viewBox="0 0 20 20">
      {[2, 8, 14].flatMap((y) =>
        [2, 8, 14].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="1" />),
      )}
    </svg>
  );
}

export function MessengerIcon({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} viewBox="0 0 12 13">
      <path d="M6 .5C2.75.5.25 2.88.25 6.08c0 1.67.69 3.12 1.8 4.12.1.08.15.21.16.34l.03 1.02c.01.33.35.54.65.41l1.14-.5a.46.46 0 0 1 .3-.02c.53.14 1.08.22 1.67.22 3.25 0 5.75-2.38 5.75-5.58S9.25.5 6 .5Zm3.45 4.3L7.76 7.47a.87.87 0 0 1-1.25.23L5.17 6.7a.35.35 0 0 0-.42 0l-1.81 1.37c-.24.18-.56-.1-.4-.36L4.24 5.03a.87.87 0 0 1 1.25-.23l1.34 1a.35.35 0 0 0 .42 0l1.81-1.37c.24-.18.56.1.4.36Z" />
    </svg>
  );
}

export function BellIcon({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)}>
      <path d="M3 9.5a9 9 0 0 1 18 0v2.927c0 1.69.475 3.345 1.37 4.778a1.5 1.5 0 0 1-1.272 2.295h-4.625a4.5 4.5 0 0 1-8.946 0H2.902a1.5 1.5 0 0 1-1.272-2.295A9.01 9.01 0 0 0 3 12.43V9.5Zm6.55 10a2.5 2.5 0 0 0 4.9 0h-4.9Z" />
    </svg>
  );
}

/* ---------- Colorful left-rail bookmarks (36x36) ---------- */

type B = { size?: number };
const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 36 36" });

export function BmFriends({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bf1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5FC9F8" />
          <stop offset="1" stopColor="#1D8CF8" />
        </linearGradient>
      </defs>
      <circle cx="12.5" cy="11.5" r="5.5" fill="url(#bf1)" />
      <path
        d="M2.5 27.5c0-5.2 4.5-8.5 10-8.5s10 3.3 10 8.5V29a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-1.5Z"
        fill="url(#bf1)"
      />
      <circle cx="24.5" cy="13" r="4.5" fill="#1877F2" />
      <path
        d="M21.4 20.4c1-.27 2.03-.4 3.1-.4 4.7 0 8.5 2.8 8.5 7.2V28a2 2 0 0 1-2 2h-6.3c.2-.45.3-.95.3-1.5V27c0-2.6-1.3-4.92-3.6-6.6Z"
        fill="#1877F2"
      />
    </svg>
  );
}

export function BmMemories({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <circle cx="18" cy="18" r="15" fill="#1D8CF8" />
      <circle cx="18" cy="18" r="11.5" fill="#fff" />
      <path
        d="M18 10.5a1.5 1.5 0 0 1 1.5 1.5v5.38l3.56 2.06a1.5 1.5 0 1 1-1.5 2.6l-4.31-2.5A1.5 1.5 0 0 1 16.5 18v-6a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="#1D8CF8"
      />
      <path d="M4 7.5 9 4l1.5 7.5L4 7.5Z" fill="#1D8CF8" />
    </svg>
  );
}

export function BmSaved({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bs1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C64CF5" />
          <stop offset="1" stopColor="#8B2BE2" />
        </linearGradient>
      </defs>
      <path
        d="M9 4h18a2 2 0 0 1 2 2v26.2a1 1 0 0 1-1.6.8L18 26l-9.4 7a1 1 0 0 1-1.6-.8V6a2 2 0 0 1 2-2Z"
        fill="url(#bs1)"
      />
    </svg>
  );
}

export function BmGroups({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#36B3F9" />
          <stop offset="1" stopColor="#1877F2" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="17" fill="url(#bg1)" />
      <circle cx="18" cy="13.5" r="4.5" fill="#fff" />
      <path
        d="M10 26c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5v.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 10 26.5V26Z"
        fill="#fff"
      />
      <circle cx="9.5" cy="16" r="3" fill="#B3E0FF" />
      <circle cx="26.5" cy="16" r="3" fill="#B3E0FF" />
      <path
        d="M4.5 25c0-2.9 2.3-4.6 5-4.6 1 0 1.9.2 2.7.6A7.6 7.6 0 0 0 9 26.5H5.5a1 1 0 0 1-1-1V25Zm27 0c0-2.9-2.3-4.6-5-4.6-1 0-1.9.2-2.7.6a7.6 7.6 0 0 1 3.2 5.5h3.5a1 1 0 0 0 1-1V25Z"
        fill="#B3E0FF"
      />
    </svg>
  );
}

export function BmReels({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="br1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6A3D" />
          <stop offset="1" stopColor="#FF2E7A" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="30" height="30" rx="8" fill="url(#br1)" />
      <path d="M3.5 11h29M13 3.5 16.5 11M22.5 3.5 26 11" stroke="#fff" strokeWidth="2" />
      <path
        d="M15 16.3v9.4c0 .8.86 1.3 1.55.9l7.6-4.7a1.05 1.05 0 0 0 0-1.8l-7.6-4.7a1.04 1.04 0 0 0-1.55.9Z"
        fill="#fff"
      />
    </svg>
  );
}

export function BmMarketplace({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bm1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#46BEFF" />
          <stop offset="1" stopColor="#1877F2" />
        </linearGradient>
      </defs>
      <path d="M6 15h24v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V15Z" fill="#1877F2" />
      <rect x="14" y="21" width="8" height="11" rx="1" fill="#B3E0FF" />
      <path
        d="M5.5 5h25l3 8.5a3.5 3.5 0 0 1-6.7 1.8 3.5 3.5 0 0 1-6.6 0 3.5 3.5 0 0 1-6.6 0 3.5 3.5 0 0 1-6.6 0A3.5 3.5 0 0 1 2.5 13.5L5.5 5Z"
        fill="url(#bm1)"
      />
    </svg>
  );
}

export function BmFeeds({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="4" y="5" width="24" height="26" rx="4" fill="#1877F2" />
      <rect x="8" y="10" width="16" height="3" rx="1.5" fill="#fff" />
      <rect x="8" y="16" width="10" height="3" rx="1.5" fill="#B3E0FF" />
      <circle cx="26" cy="25" r="8" fill="#36B3F9" stroke="#fff" strokeWidth="2" />
      <path
        d="M26 21v4.4l2.6 1.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function BmEvents({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="4" y="6" width="28" height="26" rx="5" fill="#fff" stroke="#E4E6EB" />
      <path d="M4 11a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v3H4v-3Z" fill="#F3425F" />
      <rect x="10" y="3" width="3" height="7" rx="1.5" fill="#C9354F" />
      <rect x="23" y="3" width="3" height="7" rx="1.5" fill="#C9354F" />
      <path
        d="m18 17 1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6L18 17Z"
        fill="#F3425F"
      />
    </svg>
  );
}

export function BmVideo({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="3" y="7" width="30" height="21" rx="4" fill="#1877F2" />
      <path
        d="M15 13v9.6a1 1 0 0 0 1.5.87l7.6-4.8a1 1 0 0 0 0-1.7l-7.6-4.8A1 1 0 0 0 15 13Z"
        fill="#fff"
      />
      <rect x="11" y="30" width="14" height="2.5" rx="1.25" fill="#1877F2" />
    </svg>
  );
}

export function BmGaming({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bgm1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#36B3F9" />
          <stop offset="1" stopColor="#1877F2" />
        </linearGradient>
      </defs>
      <path
        d="M11 9h14a9 9 0 0 1 9 9v4a6 6 0 0 1-10.6 3.9l-1-1.2a2 2 0 0 0-1.5-.7h-5.8a2 2 0 0 0-1.5.7l-1 1.2A6 6 0 0 1 2 22v-4a9 9 0 0 1 9-9Z"
        fill="url(#bgm1)"
      />
      <path d="M10.5 14v6M7.5 17h6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24.5" cy="15.5" r="1.8" fill="#fff" />
      <circle cx="27.5" cy="19.5" r="1.8" fill="#fff" />
    </svg>
  );
}

export function BmMessenger({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <radialGradient id="bms1" cx="0.2" cy="1" r="1.2">
          <stop offset="0" stopColor="#0099FF" />
          <stop offset="0.6" stopColor="#A033FF" />
          <stop offset="0.9" stopColor="#FF5280" />
          <stop offset="1" stopColor="#FF7061" />
        </radialGradient>
      </defs>
      <path
        d="M18 3C9.6 3 3 9.2 3 17.5c0 4.3 1.8 8.1 4.7 10.7.25.22.4.53.41.86l.08 2.65c.03.86.9 1.41 1.68 1.06l2.96-1.3c.25-.11.53-.13.8-.06 1.36.37 2.81.57 4.37.57 8.4 0 15-6.2 15-14.5S26.4 3 18 3Z"
        fill="url(#bms1)"
      />
      <path
        d="m9 21.8 4.4-7c.7-1.1 2.2-1.4 3.3-.6l3.5 2.6c.3.2.8.2 1.1 0l4.7-3.6c.6-.5 1.5.3 1 .9l-4.4 7c-.7 1.1-2.2 1.4-3.3.6l-3.5-2.6a.9.9 0 0 0-1.1 0l-4.7 3.6c-.6.5-1.5-.3-1-.9Z"
        fill="#fff"
      />
    </svg>
  );
}

export function BmPages({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="6" y="3" width="3" height="30" rx="1.5" fill="#E8620F" />
      <path d="M9 5h20.5a1 1 0 0 1 .8 1.6L26 12.5l4.3 5.9a1 1 0 0 1-.8 1.6H9V5Z" fill="#F7923B" />
    </svg>
  );
}

export function BmMetaAI({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <defs>
        <linearGradient id="bai1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0082FB" />
          <stop offset="0.5" stopColor="#A142F4" />
          <stop offset="1" stopColor="#E040A0" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="14" fill="none" stroke="url(#bai1)" strokeWidth="5" />
    </svg>
  );
}

export function BmFundraisers({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <path
        d="M18 32S4 23.6 4 13.5A7.5 7.5 0 0 1 18 9.6a7.5 7.5 0 0 1 14 3.9C32 23.6 18 32 18 32Z"
        fill="#F3425F"
      />
      <path d="M18 14v10M13 19h10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function BmAdsManager({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="5" y="20" width="5" height="12" rx="1.5" fill="#1877F2" />
      <rect x="12.5" y="13" width="5" height="19" rx="1.5" fill="#1877F2" />
      <rect x="20" y="16" width="5" height="16" rx="1.5" fill="#36B3F9" />
      <rect x="27.5" y="6" width="5" height="26" rx="1.5" fill="#1877F2" />
    </svg>
  );
}

export function BmClimate({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <circle cx="18" cy="18" r="15" fill="#2ABA6B" />
      <path
        d="M11 22c0-6 5-10 14-11-1 9-5 14-11 14l-3 3"
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BmBirthdays({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="5" y="16" width="26" height="16" rx="3" fill="#2ABBA7" />
      <rect x="3" y="12" width="30" height="6" rx="2" fill="#4CD8C4" />
      <rect x="16.5" y="12" width="3" height="20" fill="#F7B928" />
      <path d="M18 12c-3-6-9-6-8-2 .6 2 5 2 8 2Zm0 0c3-6 9-6 8-2-.6 2-5 2-8 2Z" fill="#F7B928" />
    </svg>
  );
}

export function BmRecent({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <circle cx="18" cy="18" r="15" fill="#1877F2" />
      <path d="M18 10v8l5 3" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

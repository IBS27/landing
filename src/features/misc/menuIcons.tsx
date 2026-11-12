import { useId } from "react";

/** Extra 36px colour glyphs for the Facebook menu (alongside the Bm* set in src/icons). */

type B = { size?: number };
const box = (size: number) => ({
  viewBox: "0 0 36 36",
  width: size,
  height: size,
  "aria-hidden": true as const,
});

export function BmNewsFeed({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="5" y="7" width="26" height="22" rx="4" fill="#1877F2" />
      <rect x="5" y="7" width="26" height="8" rx="4" fill="#5AB0FF" />
      <circle cx="10" cy="11" r="2" fill="#fff" />
      <rect x="14" y="10" width="13" height="2.2" rx="1.1" fill="#fff" />
      <rect x="9" y="19" width="18" height="2.2" rx="1.1" fill="#fff" opacity=".9" />
      <rect x="9" y="23.5" width="12" height="2.2" rx="1.1" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function BmGamingVideo({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="5" y="5" width="26" height="26" rx="6" fill="#1877F2" />
      <path d="M12 11h13v6h-6v8h-7Z" fill="#fff" />
      <path d="M19 17h6v8h-6Z" fill="#7FC4FF" />
    </svg>
  );
}

export function BmOrders({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="4" y="9" width="28" height="19" rx="4" fill="#0A7CFF" />
      <rect x="4" y="13" width="28" height="4" fill="#063F8C" />
      <rect x="8" y="21" width="9" height="3" rx="1.5" fill="#fff" />
    </svg>
  );
}

export function BmSupport({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <circle cx="18" cy="18" r="13" fill="#1877F2" />
      <circle cx="18" cy="18" r="6.5" fill="#fff" />
      <path
        d="M8.8 8.8l4.6 4.6M27.2 8.8l-4.6 4.6M8.8 27.2l4.6-4.6M27.2 27.2l-4.6-4.6"
        stroke="#9ED0FF"
        strokeWidth="3.2"
      />
    </svg>
  );
}

export function BmMessengerKids({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <path
        d="M18 5C10.3 5 5 10.5 5 17c0 3.6 1.6 6.7 4.3 8.8V31l4.5-2.5c1.3.4 2.7.6 4.2.6 7.7 0 13-5.5 13-12S25.7 5 18 5Z"
        fill="#7B61FF"
      />
      <circle cx="13" cy="16.5" r="2" fill="#fff" />
      <circle cx="23" cy="16.5" r="2" fill="#fff" />
      <path
        d="M13 21.5c2.8 2.4 7.2 2.4 10 0"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BmQuest({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <rect x="4" y="11" width="28" height="15" rx="7.5" fill="#1C1E21" />
      <rect x="7" y="14" width="22" height="9" rx="4.5" fill="#3A3B3C" />
      <circle cx="12.5" cy="18.5" r="2" fill="#8A8D91" />
      <circle cx="23.5" cy="18.5" r="2" fill="#8A8D91" />
    </svg>
  );
}

export function BmWhatsApp({ size = 36 }: B) {
  return (
    <svg {...box(size)}>
      <path
        d="M18 4.5A13.5 13.5 0 0 0 6.4 24.8L4.7 31.3l6.6-1.7A13.5 13.5 0 1 0 18 4.5Z"
        fill="#25D366"
      />
      <path
        d="M13.4 11.3c-.3-.6-.6-.6-.9-.6h-.8c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.2 2.7 4.3 6.7 5.9 3.3 1.3 4 1 4.7 1 .7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5l-2.7-1.3c-.4-.2-.6-.2-.9.2l-1.2 1.5c-.2.3-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.1-2.7-.2-.4 0-.6.2-.8l.6-.7.4-.7c.1-.3.1-.5 0-.7l-1.3-3.2Z"
        fill="#fff"
      />
    </svg>
  );
}

export function BmInstagram({ size = 36 }: B) {
  const id = useId().replace(/:/g, "");
  return (
    <svg {...box(size)}>
      <defs>
        <radialGradient id={`ig${id}`} cx="0.3" cy="1.05" r="1.2">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.35" stopColor="#FF543E" />
          <stop offset="0.7" stopColor="#C837AB" />
          <stop offset="1" stopColor="#5B4BDB" />
        </radialGradient>
      </defs>
      <rect x="5" y="5" width="26" height="26" rx="8" fill={`url(#ig${id})`} />
      <rect
        x="10"
        y="10"
        width="16"
        height="16"
        rx="5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <circle cx="18" cy="18" r="3.8" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="23" cy="13" r="1.3" fill="#fff" />
    </svg>
  );
}

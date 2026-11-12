import type { SVGProps } from "react";

/** Facebook's filled friend glyphs (rail icons, friend buttons). */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...p }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden {...p}>
      {children}
    </svg>
  );
}

const HEAD = "M8 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z";
const BODY =
  "M8 11c-3.87 0-7 2.24-7 5v.5A2.5 2.5 0 0 0 3.5 19h7.04A5.98 5.98 0 0 1 9.3 11.1 9.6 9.6 0 0 0 8 11Z";

/** Two people (rail "Home"). */
export function FriendsHomeGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M7 1.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm7.25 1.25a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 10.5c-3.6 0-6.5 2.1-6.5 4.75v.75A2.5 2.5 0 0 0 3 18.5h8a2.5 2.5 0 0 0 2.5-2.5v-.75C13.5 12.6 10.6 10.5 7 10.5Zm8 8h1.5A2.5 2.5 0 0 0 19 16v-.5c0-2.35-2.1-4.27-5.02-4.67A5.66 5.66 0 0 1 15 14.2V16c0 .93-.25 1.8-.69 2.5H15Z" />
    </Svg>
  );
}

/** Person with an arrow (rail "Friend requests"). */
export function FriendRequestsGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d={HEAD} />
      <path d={BODY} />
      <path d="M14.3 11.3a1 1 0 0 1 1.4 0l2.5 2.5a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 1 1-1.4-1.4l.8-.8H12a1 1 0 1 1 0-2h3.1l-.8-.8a1 1 0 0 1 0-1.4Z" />
    </Svg>
  );
}

/** Person with a plus (rail "Suggestions", "Add friend"). */
export function PersonPlusGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d={HEAD} />
      <path d={BODY} />
      <path d="M15 11a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

/** Person with list lines (rail "All friends", "Custom lists"). */
export function PersonListGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d={HEAD} />
      <path d={BODY} />
      <path d="M12 12.5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Zm0 3.5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Z" />
    </Svg>
  );
}

/** Person with a check (the "Friends" button). */
export function PersonCheckGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d={HEAD} />
      <path d={BODY} />
      <path d="M18.7 12.3a1 1 0 0 1 0 1.4l-3.5 3.5a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4l1.3 1.29 2.8-2.8a1 1 0 0 1 1.4 0Z" />
    </Svg>
  );
}

/** Person with an x ("Cancel request"). */
export function PersonXGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d={HEAD} />
      <path d={BODY} />
      <path d="M12.3 12.3a1 1 0 0 1 1.4 0l1.3 1.29 1.3-1.3a1 1 0 1 1 1.4 1.42L16.42 15l1.3 1.3a1 1 0 0 1-1.42 1.4L15 16.42l-1.3 1.3a1 1 0 0 1-1.4-1.42L13.58 15l-1.3-1.3a1 1 0 0 1 0-1.4Z" />
    </Svg>
  );
}

/** Gift (rail "Birthdays"). */
export function GiftGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M6.5 1.5c1.36 0 2.62.73 3.5 1.83.88-1.1 2.14-1.83 3.5-1.83a2.75 2.75 0 0 1 2.24 4.35H17A1.5 1.5 0 0 1 18.5 7.4v1.6A1.5 1.5 0 0 1 17 10.5h-6.25V5.9h-1.5v4.6H3A1.5 1.5 0 0 1 1.5 9V7.4A1.5 1.5 0 0 1 3 5.85h1.26A2.75 2.75 0 0 1 6.5 1.5Zm0 2a.75.75 0 0 0 0 1.5h2.2c-.53-.9-1.36-1.5-2.2-1.5Zm7 0c-.84 0-1.67.6-2.2 1.5h2.2a.75.75 0 0 0 0-1.5ZM2.5 12h6.75v6.5H4.5a2 2 0 0 1-2-2V12Zm8.25 0h6.75v4.5a2 2 0 0 1-2 2h-4.75V12Z" />
    </Svg>
  );
}

/** The two-person illustration on the empty right pane. */
export function PeopleIllustration({ size = 112 }: { size?: number }) {
  return (
    <svg viewBox="0 0 112 112" width={size} height={size} aria-hidden>
      <rect x="18" y="0" width="20" height="58" rx="5" fill="#65686c" opacity=".55" />
      <rect x="18" y="10" width="20" height="26" rx="10" fill="#8ab4f8" />
      <path d="M0 60a12 12 0 0 1 12-12h32a12 12 0 0 1 12 12v52H0V60Z" fill="#bcc0c4" />
      <circle cx="68" cy="22" r="9" fill="#bcc0c4" />
      <circle cx="74" cy="44" r="14" fill="#0866ff" />
      <path
        d="M60 44a14 14 0 0 1 14-14c4 0 7.5 1.6 10 4.2L64 47.5A14 14 0 0 1 60 44Z"
        fill="#bcc0c4"
      />
      <path d="M38 112a36 36 0 0 1 72 0H38Z" fill="#65686c" opacity=".85" />
    </svg>
  );
}

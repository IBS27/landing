import { type SVGProps, useId } from "react";

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

/** Two people (rail "Home"): one in front, one behind and higher. */
export function FriendsHomeGlyph(p: P) {
  const id = useId();
  return (
    <Svg {...p}>
      <mask id={id}>
        <rect width="20" height="20" fill="#fff" />
        <circle cx="6.5" cy="8.3" r="4.6" fill="#000" />
        <rect x="-1" y="11" width="15" height="9" rx="4.5" fill="#000" />
      </mask>
      <g mask={`url(#${id})`}>
        <circle cx="14" cy="4.6" r="3.6" />
        <rect x="8.5" y="9.2" width="11" height="6.3" rx="3.15" />
      </g>
      <circle cx="6.5" cy="8.3" r="3.3" />
      <rect x="0.5" y="12.5" width="12" height="6" rx="3" />
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

/** Filled gear (rail title "Edit notification settings"). */
export function GearGlyph(p: P) {
  return (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M10.2 1.5h3.6a1 1 0 0 1 1 .86l.32 2.27c.6.26 1.16.58 1.68.97l2.13-.86a1 1 0 0 1 1.24.43l1.8 3.12a1 1 0 0 1-.24 1.29l-1.8 1.41a7.6 7.6 0 0 1 0 2.02l1.8 1.41a1 1 0 0 1 .24 1.29l-1.8 3.12a1 1 0 0 1-1.24.43l-2.13-.86c-.52.39-1.08.71-1.68.97l-.32 2.27a1 1 0 0 1-1 .86h-3.6a1 1 0 0 1-1-.86l-.32-2.27a7.9 7.9 0 0 1-1.68-.97l-2.13.86a1 1 0 0 1-1.24-.43l-1.8-3.12a1 1 0 0 1 .24-1.29l1.8-1.41a7.6 7.6 0 0 1 0-2.02l-1.8-1.41a1 1 0 0 1-.24-1.29l1.8-3.12a1 1 0 0 1 1.24-.43l2.13.86c.52-.39 1.08-.71 1.68-.97l.32-2.27a1 1 0 0 1 1-.86ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
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

/** The two-person illustration on the empty right pane (traced from Facebook's). */
export function PeopleIllustration({ size = 112 }: { size?: number }) {
  const id = useId();
  return (
    <svg viewBox="0 -3 112 112" width={size} height={size} aria-hidden>
      <clipPath id={id}>
        <circle cx="73" cy="53" r="11" />
      </clipPath>
      <path d="M23 21a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v24H23V21Z" fill="#7d8085" />
      <rect x="23" y="27" width="20" height="23" rx="8" fill="#9ec5fe" />
      <path d="M12 61a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v38H12V61Z" fill="#bcc0c4" />
      <circle cx="66" cy="34" r="7" fill="#bcc0c4" />
      <circle cx="73" cy="53" r="11" fill="#0866ff" />
      <circle cx="68" cy="45" r="10" fill="#bcc0c4" clipPath={`url(#${id})`} />
      <path d="M42 99a29 29 0 0 1 58 0H42Z" fill="#7d8085" />
    </svg>
  );
}

/** 80px spot illustrations used on the Settings home (drawn, not copied). */

export function BlockingArt() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
      <circle cx="40" cy="40" r="34" fill="#BEE3F8" />
      <circle cx="33" cy="30" r="9" fill="#F5A623" />
      <path d="M14 62c3-12 11-18 19-18s16 6 19 18a34 34 0 0 1-38 0Z" fill="#F5A623" />
      <circle cx="54" cy="34" r="7" fill="none" stroke="#E4572E" strokeWidth="2.5" />
      <path d="m49 39 10-10" stroke="#E4572E" strokeWidth="2.5" />
    </svg>
  );
}

export function ActivityLogArt() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
      <path d="M16 8h38l10 10v54H16Z" fill="#FDE7D0" />
      <path d="M54 8v10h10" fill="#F8C9A0" />
      <circle cx="24" cy="18" r="4" fill="#F5A623" />
      {[30, 38, 46, 54, 62].map((y) => (
        <rect key={y} x="22" y={y} width="34" height="2.5" rx="1.2" fill="#8A8D91" />
      ))}
      <rect x="31" y="16" width="16" height="2.5" rx="1.2" fill="#8A8D91" />
      <path d="m62 22 8-8 3 3-8 8-4 1Z" fill="#E4572E" />
    </svg>
  );
}

export function DarkModeArt() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
      <circle cx="40" cy="30" r="22" fill="#FFD43B" />
      <path d="M31 38l9 7 9-7M40 45v8" stroke="#8A8D91" strokeWidth="2.5" fill="none" />
      <rect x="32" y="52" width="16" height="4" rx="1" fill="#B0B3B8" />
      <rect x="32" y="58" width="16" height="4" rx="1" fill="#B0B3B8" />
      <rect x="34" y="64" width="12" height="4" rx="1" fill="#8A8D91" />
    </svg>
  );
}

export function PrivacyCenterArt() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
      <path d="M24 36V24a16 16 0 0 1 32 0v12" stroke="#65686C" strokeWidth="6" fill="none" />
      <rect x="16" y="34" width="48" height="40" rx="3" fill="#B0B3B8" />
      <rect x="16" y="68" width="48" height="6" fill="#C0392B" />
      <circle cx="40" cy="50" r="5" fill="#3A3B3C" />
      <rect x="38" y="52" width="4" height="10" rx="1" fill="#3A3B3C" />
    </svg>
  );
}

export function HelpCenterArt() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
      <rect x="6" y="14" width="68" height="44" rx="3" fill="#3A3B3C" />
      <rect x="10" y="18" width="60" height="36" fill="#1877F2" />
      <circle cx="40" cy="34" r="10" fill="#fff" />
      <path d="M34 36l6-6 6 6v6H34Z" fill="#F5A623" />
      <rect x="34" y="58" width="12" height="8" fill="#65686C" />
      <rect x="24" y="66" width="32" height="4" rx="2" fill="#8A8D91" />
    </svg>
  );
}

import { Link, useRouter } from "@tanstack/react-router";

/** Facebook's broken-link spot illustration (112px). */
function BrokenLinkIllustration() {
  return (
    <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden>
      <g fill="none" strokeLinecap="round" strokeWidth="7">
        <path
          d="M84 45l2.4-12.6a9.6 9.6 0 0 0-18-6.4L52.4 58c-2.6 8.4 13.6 15.6 22.2 4.6"
          stroke="#7A7D81"
          strokeLinejoin="round"
        />
        <rect
          x="11"
          y="63.5"
          width="58"
          height="21"
          rx="10.5"
          transform="rotate(-41 40 74)"
          stroke="#90C3FF"
        />
        {/* The hook passes in front of the blue link on its way down. */}
        <path d="M53 60.5c2.8 6.8 14.6 9.6 21.6 2" stroke="#7A7D81" />
        <path
          d="M85.5 60.8l10.4-1.6M87.4 65.6l9.6 4.6M82.8 67.8l4.8 7.4"
          stroke="#1876F2"
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}

/**
 * Facebook's generic "This Page Isn't Available" screen. It fills the content
 * area without rails; the root route uses it for unknown URLs.
 */
export function PageUnavailable() {
  const router = useRouter();
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 pt-6 pb-0 text-center">
      <BrokenLinkIllustration />
      <h1 className="mt-5 font-bold text-[20px] text-secondary leading-6">
        This Page Isn't Available
      </h1>
      <p className="mt-1 max-w-[452px] text-[17px] text-secondary leading-5">
        The link may be broken, or the page may have been removed. Check to see if the link you're
        trying to open is correct.
      </p>
      <Link
        to="/"
        className="mt-5 flex h-10 w-[169px] items-center justify-center rounded-lg bg-btn-primary font-semibold text-[17px] text-white hover:bg-btn-primary-hover"
      >
        Go to Feed
      </Link>
      <button
        type="button"
        onClick={() => router.history.back()}
        className="mt-3 font-semibold text-[17px] text-link leading-5 hover:underline"
      >
        Go back
      </button>
      <Link
        to="/settings"
        search={{ tab: "learn" }}
        className="mt-2 font-semibold text-[17px] text-link leading-5 hover:underline"
      >
        Visit Help Center
      </Link>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useViewer } from "@/app/viewer";
import { PRIMARY_COUNT, SHORTCUTS } from "@/layout/shortcuts";
import { Avatar } from "@/ui/primitives";
import { AdChoicesGlyph, FOOTER_LINKS } from "./AppRail";

const ROW =
  "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 my-[2px] text-left transition-colors hover:bg-hover";
const LABEL = "font-medium text-[15px] text-primary leading-5";

/** /bookmarks — every shortcut as one full-width list (Facebook's "Menu" page). */
export function BookmarksPage() {
  const viewer = useViewer();
  const [all, setAll] = useState(false);
  const shown = all ? SHORTCUTS : SHORTCUTS.slice(0, PRIMARY_COUNT);
  return (
    <nav aria-label="Shortcuts" className="px-2 pt-4 pb-8">
      <ul>
        <li>
          <Link to="/$username" params={{ username: viewer.username }} className={ROW}>
            <Avatar src={viewer.avatar} size={36} />
            <span className={LABEL}>{viewer.name}</span>
          </Link>
        </li>
        {shown.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className={ROW}>
              <s.Icon size={36} />
              <span className={LABEL}>{s.label}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-label={all ? "See fewer explore items" : "See more explore items"}
            aria-expanded={all}
            onClick={() => setAll((a) => !a)}
            className={ROW}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon">
              {all ? (
                <ChevronUp size={20} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={20} strokeWidth={2.5} />
              )}
            </span>
            <span className={LABEL}>{all ? "See less" : "See more"}</span>
          </button>
        </li>
      </ul>
      <footer className="px-2 pt-4 text-[13px] text-secondary leading-4">
        {FOOTER_LINKS.map((l, i) => (
          <span key={l}>
            {i > 0 && <span className="px-1">·</span>}
            <button type="button" className="font-semibold hover:underline">
              {l}
              {l === "Ad Choices" && <AdChoicesGlyph />}
            </button>
          </span>
        ))}
      </footer>
    </nav>
  );
}

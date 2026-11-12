import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useViewer } from "@/app/viewer";
import { PRIMARY_COUNT, SHORTCUTS } from "@/layout/shortcuts";
import { Avatar } from "@/ui/primitives";
import { groupParams } from "./links";
import type { RailsData } from "./RightRail";

const ROW =
  "flex min-h-[52px] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-hover";
const LABEL = "min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5";

/** Home left rail: profile, bookmarks with See more, "Your shortcuts" (groups) and footer. */
export function LeftRail({ groups }: { groups: RailsData["groups"] | undefined }) {
  const viewer = useViewer();
  const [expanded, setExpanded] = useState(false);
  const [moreGroups, setMoreGroups] = useState(false);
  const shown = expanded ? SHORTCUTS : SHORTCUTS.slice(0, PRIMARY_COUNT);
  const groupList = groups ?? [];
  const visibleGroups = moreGroups ? groupList : groupList.slice(0, 5);

  return (
    <nav
      aria-label="Shortcuts"
      className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] min-w-[280px] shrink flex-col overflow-y-auto pt-4 min-[900px]:flex"
    >
      <ul className="flex flex-col px-2">
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
            onClick={() => setExpanded((e) => !e)}
            className={`${ROW} w-full text-left`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
              {expanded ? (
                <ChevronUp size={20} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={20} strokeWidth={2.5} />
              )}
            </span>
            <span className={LABEL}>{expanded ? "See less" : "See more"}</span>
          </button>
        </li>
      </ul>

      {groupList.length > 0 && (
        <>
          <div className="mx-4 my-2 h-px bg-divider" />
          <div className="px-2">
            <h2 className="group flex items-center justify-between px-2 pt-1 pb-1 font-semibold text-[17px] text-secondary leading-5">
              Your shortcuts
              <span className="invisible rounded-md px-2 py-1 font-normal text-[15px] text-link hover:bg-hover group-hover:visible">
                Edit
              </span>
            </h2>
            <ul className="flex flex-col">
              {visibleGroups.map((g) => (
                <li key={g._id}>
                  <Link to="/groups/$groupId" params={groupParams(g)} className={ROW}>
                    <Avatar src={g.cover} size={36} square />
                    <span className={LABEL}>{g.name}</span>
                  </Link>
                </li>
              ))}
              {groupList.length > 5 && (
                <li>
                  <button
                    type="button"
                    onClick={() => setMoreGroups((m) => !m)}
                    className={`${ROW} w-full text-left`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                      {moreGroups ? (
                        <ChevronUp size={20} strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={20} strokeWidth={2.5} />
                      )}
                    </span>
                    <span className={LABEL}>{moreGroups ? "See less" : "See more"}</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      <footer className="mt-auto px-4 pt-6 pb-4 font-semibold text-[13px] text-secondary leading-4">
        {["Privacy", "Terms", "Advertising", "Ad Choices", "Cookies", "More"].map((l) => (
          <span key={l}>
            <button type="button" className="hover:underline">
              {l}
            </button>
            {" · "}
          </span>
        ))}
        <span>Meta © 2026</span>
      </footer>
    </nav>
  );
}

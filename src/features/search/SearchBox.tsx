import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Clock, Search, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Avatar, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { type RecentSearch, useRecentSearches } from "./recent";
import { useOpenEntity } from "./useOpenEntity";

type Row = {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  sub?: string;
  onSelect: () => void;
  onRemove?: () => void;
};

function IconCircle({ children, blue }: { children: ReactNode; blue?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        blue ? "bg-fb text-white" : "bg-btn text-icon",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Header search. Focusing it opens Facebook's overlay: the logo turns into a
 * back arrow and a 320px panel shows recent searches, or typeahead results.
 */
/**
 * `collapsed` renders the round icon Facebook shows on Marketplace, Gaming, Messenger and the
 * Groups section pages. The resting pill is 240px on Home and 280px (`wide`) elsewhere.
 */
export function SearchBox({
  collapsed = false,
  wide = false,
}: {
  collapsed?: boolean;
  wide?: boolean;
}) {
  const location = useRouterState({ select: (s) => s.location });
  const searchQ = (location.search as { q?: unknown }).q;
  const routeQ =
    location.pathname.startsWith("/search/") && typeof searchQ === "string" ? searchQ : "";
  const [q, setQ] = useState(routeQ);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const openEntity = useOpenEntity();
  const recent = useRecentSearches();

  useEffect(() => setQ(routeQ), [routeQ]);

  // The input moves into the overlay when it opens; keep focus and the caret at the end.
  useEffect(() => {
    const el = inputRef.current;
    if (!open || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [open]);

  const term = q.trim();
  const live = useQ(api.search.typeahead, open && term ? { q: term } : "skip");
  // Keep the previous results on screen while the next keystroke loads.
  const [shown, setShown] = useState(live ?? []);
  useEffect(() => {
    if (live) setShown(live);
  }, [live]);

  const close = () => {
    setOpen(false);
    setEditing(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const searchFor = (text: string) => {
    const t = text.trim();
    if (!t) return;
    recent.add({ kind: "query", q: t });
    setQ(t);
    close();
    void navigate({ to: "/search/$tab", params: { tab: "top" }, search: { q: t } });
  };

  const pick = (item: Exclude<RecentSearch, { kind: "query" }>) => {
    recent.add(item);
    close();
    openEntity(item);
  };

  const rows: Row[] = term
    ? [
        ...shown.map(
          (r): Row => ({
            id: `${r.kind}:${r.id}`,
            icon: (
              <Avatar src={r.image} size={36} square={r.kind === "group" || r.kind === "event"} />
            ),
            title: (
              <span className="inline-flex items-center gap-1">
                {r.title}
                {r.verified && <VerifiedBadge />}
              </span>
            ),
            sub: r.sub || undefined,
            onSelect: () =>
              pick({ kind: r.kind, id: r.id, key: r.key, title: r.title, image: r.image }),
          }),
        ),
        {
          id: "search-for",
          icon: (
            <IconCircle blue>
              <Search size={16} strokeWidth={2.6} />
            </IconCircle>
          ),
          title: (
            <span className="font-normal">
              Search for <span className="font-semibold">{term}</span>
            </span>
          ),
          onSelect: () => searchFor(term),
        },
      ]
    : recent.items.map(
        (r): Row => ({
          id: r.kind === "query" ? `q:${r.q}` : `${r.kind}:${r.id}`,
          icon:
            r.kind === "query" ? (
              <IconCircle>
                <Clock size={18} />
              </IconCircle>
            ) : (
              <Avatar src={r.image} size={36} square={r.kind === "group" || r.kind === "event"} />
            ),
          title: r.kind === "query" ? r.q : r.title,
          onSelect: () => (r.kind === "query" ? searchFor(r.q) : pick(r)),
          onRemove: () => recent.remove(r),
        }),
      );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && rows[active]) rows[active].onSelect();
      else searchFor(q);
    }
  };

  const input = (
    <input
      ref={inputRef}
      value={q}
      onChange={(e) => {
        setQ(e.target.value);
        setActive(-1);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      placeholder="Search Facebook"
      aria-label="Search Facebook"
      role="combobox"
      aria-expanded={open}
      aria-controls="search-typeahead"
      aria-autocomplete="list"
      className="h-10 min-w-0 flex-1 bg-transparent pt-[7px] pr-2 pb-[9px] pl-2 text-[15px] text-primary outline-none placeholder:text-placeholder"
    />
  );

  return (
    <>
      {/* Resting pill (or icon); while open, the overlay below draws its own copy on top. */}
      {/* Below 1024px the header has no room for the pill, so it's always the icon. */}
      <button
        type="button"
        aria-label="Search Facebook"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-input text-icon-secondary hover:brightness-95",
          !collapsed && "lg:hidden",
          open && "invisible",
        )}
      >
        <Search size={16} strokeWidth={2.4} />
      </button>
      {!collapsed && (
        <div
          className={cn(
            "hidden h-10 shrink-0 items-center rounded-full bg-input pl-3 lg:flex",
            wide ? "w-[280px]" : "w-[240px]",
            open && "invisible",
          )}
        >
          <Search size={16} strokeWidth={2.4} className="shrink-0 text-icon-secondary" />
          {!open && input}
        </div>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed top-0 left-0 z-50 w-[320px] rounded-br-lg bg-popover pb-2 shadow-elevated"
        >
          <div className="flex h-14 items-center gap-1 pr-4 pl-1.5">
            <button
              type="button"
              aria-label="Close search"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
            >
              <ArrowLeft size={20} strokeWidth={2.2} />
            </button>
            <div className="ml-1.5 flex h-10 min-w-0 flex-1 items-center rounded-full bg-input pl-1">
              {input}
            </div>
          </div>

          <div
            id="search-typeahead"
            role="listbox"
            className="max-h-[calc(100vh-72px)] overflow-y-auto px-2"
          >
            {!term && (
              <div className="flex items-center justify-between px-2 pt-1 pb-1">
                <h2 className="font-semibold text-[17px] text-primary leading-5">Recent</h2>
                {recent.items.length > 0 &&
                  (editing ? (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={recent.clear}
                        className="rounded-md px-2 py-1.5 text-[15px] text-link hover:bg-hover"
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-md px-2 py-1.5 text-[15px] text-link hover:bg-hover"
                      >
                        Done
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="-mr-2 rounded-md px-2 py-1.5 text-[15px] text-link hover:bg-hover"
                    >
                      Edit
                    </button>
                  ))}
              </div>
            )}
            {!term && recent.items.length === 0 && (
              <p className="px-2 pt-2 pb-3 text-center text-[15px] text-secondary">
                No recent searches
              </p>
            )}
            {rows.map((r, i) => (
              <div
                key={r.id}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={r.onSelect}
                onKeyDown={(e) => {
                  if (e.key === "Enter") r.onSelect();
                }}
                className={cn(
                  "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                  i === active && "bg-hover",
                )}
              >
                {r.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[15px] text-primary leading-5">
                    {r.title}
                  </span>
                  {r.sub && (
                    <span className="block truncate text-[13px] text-secondary leading-4">
                      {r.sub}
                    </span>
                  )}
                </span>
                {r.onRemove && (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      r.onRemove?.();
                    }}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-icon-secondary hover:bg-hover",
                      editing && "bg-btn",
                    )}
                  >
                    <X size={14} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

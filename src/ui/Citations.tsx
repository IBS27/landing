import { Link } from "@tanstack/react-router";
import { ExternalLink, Globe, Quote } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { chipLabel, sourceMeta, sourceTitle } from "@/lib/citations";
import { cn } from "@/lib/format";
import type { CitedSource, NonEmpty } from "../../convex/lib/citations";
import { PopoverPanel } from "./overlays";
import { Avatar } from "./primitives";

/**
 * The one citation UI: a chip ("15 comments · 2 weeks ago", or "3 sources")
 * that opens a popover of sources, each linking to the original. Pass what
 * `resolveCitations()` returned for the viewer; when it returned null, hide the
 * score or recommendation instead.
 */
export function SourcesChip({
  sources,
  label,
  className,
}: {
  sources: NonEmpty<CitedSource>;
  /** Overrides the chip text. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  return (
    <PopoverPanel
      open={open}
      onOpenChange={setOpen}
      align="start"
      width={360}
      trigger={
        <button
          type="button"
          aria-label={`Sources: ${label ?? chipLabel(sources, now)}`}
          className={cn(
            "inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-btn px-2 font-semibold text-primary text-xs transition-colors hover:bg-hover data-[state=open]:bg-btn-soft data-[state=open]:text-btn-soft-text",
            className,
          )}
        >
          <Quote size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <span className="truncate">{label ?? chipLabel(sources, now)}</span>
        </button>
      }
    >
      <div className="px-4 pt-3 pb-1 font-bold text-md text-primary">
        {sources.length === 1 ? "Source" : "Sources"}
      </div>
      <ul className="min-h-0 overflow-y-auto px-2 pb-2">
        {sources.map((s) => (
          <li key={s.key}>
            <SourceLink source={s} onNavigate={() => setOpen(false)}>
              <SourceImage source={s} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold text-primary text-sm">
                  <span className="truncate">{sourceTitle(s)}</span>
                  {s.kind === "external" && (
                    <ExternalLink size={12} className="shrink-0 text-secondary" aria-hidden />
                  )}
                </span>
                <span className="line-clamp-2 text-primary text-sm leading-[18px]">
                  {s.snippet}
                </span>
                <span className="block truncate text-secondary text-xs">{sourceMeta(s, now)}</span>
              </span>
            </SourceLink>
          </li>
        ))}
      </ul>
    </PopoverPanel>
  );
}

const ROW = "flex gap-3 rounded-lg p-2 text-left transition-colors hover:bg-hover";

/**
 * Links each source to its original: permalink (a comment opens the post at the
 * comment), Event, listing, Group or the web page.
 */
export function SourceLink({
  source: s,
  onNavigate,
  children,
}: {
  source: CitedSource;
  onNavigate: () => void;
  children: ReactNode;
}) {
  switch (s.kind) {
    case "post":
      return (
        <Link
          to="/$username/posts/$postId"
          params={{ username: s.author.username, postId: s.postId }}
          onClick={onNavigate}
          className={ROW}
        >
          {children}
        </Link>
      );
    case "comment":
      // Opens the post at the comment: its replies expanded, scrolled to and highlighted.
      return (
        <Link
          to="/$username/posts/$postId"
          params={{ username: s.postAuthorUsername, postId: s.postId }}
          search={{ comment_id: s.commentId }}
          onClick={onNavigate}
          className={ROW}
        >
          {children}
        </Link>
      );
    case "event":
      return (
        <Link
          to="/events/$eventId"
          params={{ eventId: s.eventId }}
          onClick={onNavigate}
          className={ROW}
        >
          {children}
        </Link>
      );
    case "listing":
      return (
        <Link
          to="/marketplace/item/$listingId"
          params={{ listingId: s.listingId }}
          onClick={onNavigate}
          className={ROW}
        >
          {children}
        </Link>
      );
    case "group":
      return (
        <Link
          to="/groups/$groupId"
          params={{ groupId: s.slug }}
          onClick={onNavigate}
          className={ROW}
        >
          {children}
        </Link>
      );
    case "external":
      // Stored URLs are checked on insert; check again so nothing but http(s) is ever a link.
      return /^https?:\/\//i.test(s.url) ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer" className={ROW}>
          {children}
        </a>
      ) : (
        <div className={ROW}>{children}</div>
      );
  }
}

function SourceImage({ source: s }: { source: CitedSource }) {
  switch (s.kind) {
    case "post":
    case "comment":
      return <Avatar src={s.author.avatar} size={36} />;
    case "event":
    case "group":
      return <Avatar src={s.image} size={36} square />;
    case "listing":
      return s.image ? <Avatar src={s.image} size={36} square /> : <IconTile />;
    case "external":
      return <IconTile />;
  }
}

function IconTile() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-btn text-primary">
      <Globe size={18} aria-hidden />
    </span>
  );
}

/** The current time, refreshed every minute so ages stay accurate on long-open pages. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

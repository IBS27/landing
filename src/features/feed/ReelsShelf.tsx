import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, ChevronRight, CircleMinus, EyeOff, Flag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { DotsIcon } from "@/features/posts/icons";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from "@/ui/overlays";
import { Button, Card, IconButton } from "@/ui/primitives";
import { ReportProblemDialog } from "@/ui/ReportDialog";
import { api } from "../../../convex/_generated/api";

const TILE = 192;
const GAP = 8;

/** Facebook's clapperboard Reels glyph. */
function ReelsGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M5 2h14a3 3 0 0 1 3 3v2H2V5a3 3 0 0 1 3-3Zm2.2 1.6L8.9 6h2.4L9.6 3.6H7.2Zm5 0L13.9 6h2.4l-1.7-2.4h-2.4Zm5 0L18.9 6h1.5V5c0-.7-.5-1.3-1.1-1.4h-2.1ZM2 8.5h20V19a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8.5Zm8 3.3v6.4c0 .5.5.8 1 .6l5-3.2a.7.7 0 0 0 0-1.2l-5-3.2c-.5-.2-1 .1-1 .6Z" />
    </svg>
  );
}

type GlyphProps = { size?: number };

/** Facebook's filled menu glyphs (20px, currentColor). */
function MinusCircleGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22ZM7 10.75a1.25 1.25 0 1 0 0 2.5h10a1.25 1.25 0 1 0 0-2.5H7Z"
      />
    </svg>
  );
}

function EyeOffGlyph({ size = 20 }: GlyphProps) {
  const mask = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <path d="M3 3 21 21" stroke="black" strokeWidth="5" strokeLinecap="round" />
      </mask>
      <path
        mask={`url(#${mask})`}
        fillRule="evenodd"
        d="M12 4.5c-5.3 0-9 4.2-10.6 6.6a1.6 1.6 0 0 0 0 1.8C3 15.3 6.7 19.5 12 19.5s9-4.2 10.6-6.6a1.6 1.6 0 0 0 0-1.8C21 8.7 17.3 4.5 12 4.5Zm0 3.75a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
      />
      <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AlertGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 1 1-2.5 0v-5.5C10.75 6.56 11.31 6 12 6Zm0 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
      />
    </svg>
  );
}

function FlagGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M5 2a1 1 0 0 1 1 1v.5h12.3c.8 0 1.3.9.9 1.6L16.6 9l2.6 3.9c.4.7-.1 1.6-.9 1.6H6V21a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

type ReelsInFeed = "Show" | "Show fewer" | "Hidden";

/**
 * The "Reels" card Home slots into the feed: a horizontally scrolling row of
 * 9:16 tiles with previous/next arrows. Each tile opens that reel.
 *
 * The header menu's "Show fewer reels" moves the shelf to its `fewer` slot
 * further down the Feed and "Hide all reels" removes it (persisted per viewer);
 * either leaves an Undo bar where the shelf was.
 */
export function ReelsShelf({ placement = "default" }: { placement?: "default" | "fewer" }) {
  const choice = useQ(api.settings.get, {})?.prefs["reels-in-feed"] as ReelsInFeed | undefined;
  const setPref = useM(api.settings.setPref);
  /** Set when the viewer changed the choice from this shelf just now: show the Undo bar. */
  const [changed, setChanged] = useState<{ to: ReelsInFeed; from: ReelsInFeed } | null>(null);
  const choose = (value: ReelsInFeed, undo = false) => {
    setChanged(undo || value === "Show" ? null : { to: value, from: choice ?? "Show" });
    void setPref({ key: "reels-in-feed", value });
  };
  const [reportingProblem, setReportingProblem] = useState(false);
  const wanted = choice === "Show" ? "default" : choice === "Show fewer" ? "fewer" : null;

  if (changed && choice === changed.to)
    return <ShelfUndoBar choice={changed.to} onUndo={() => choose(changed.from, true)} />;
  if (wanted !== placement) return null;
  return (
    <>
      <Shelf
        onChoose={choose}
        fewer={choice === "Show fewer"}
        onReportProblem={() => setReportingProblem(true)}
      />
      {reportingProblem && <ReportProblemDialog onClose={() => setReportingProblem(false)} />}
    </>
  );
}

/** What's left of the shelf after "Show fewer reels" / "Hide all reels". */
function ShelfUndoBar({ choice, onUndo }: { choice: ReelsInFeed; onUndo: () => void }) {
  return (
    <Card className="flex items-center gap-3 rounded-xl px-4 py-3">
      {choice === "Hidden" ? (
        <EyeOff size={24} className="shrink-0 text-icon" />
      ) : (
        <CircleMinus size={24} className="shrink-0 text-icon" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[15px] text-primary leading-5">
          {choice === "Hidden" ? "Reels hidden" : "You'll see fewer reels"}
        </p>
        <p className="text-[13px] text-secondary leading-4">
          {choice === "Hidden"
            ? "You won't see Reels in your Feed."
            : "Reels will show up less often in your Feed."}
        </p>
      </div>
      <Button variant="secondary" className="px-4" onClick={onUndo}>
        Undo
      </Button>
    </Card>
  );
}

function Shelf({
  onChoose,
  fewer,
  onReportProblem,
}: {
  onChoose: (v: ReelsInFeed) => void;
  fewer: boolean;
  onReportProblem: () => void;
}) {
  const live = useQ(api.media.reelsShelf, {});
  const hide = useM(api.media.hideReel);
  /** Reels hidden from this shelf just now: they stay as an "Undo" placeholder in place. */
  const [justHidden, setJustHidden] = useState<{ reel: ShelfReel; at: number }[]>([]);
  const [reporting, setReporting] = useState<ShelfReel | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const reels = live && withPlaceholders(live, justHidden, reportedIds);
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = row.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure once tiles arrive
  useEffect(update, [reels?.length]);

  const hideReel = (reel: ShelfReel, at: number, reason: "hidden" | "reported") => {
    setJustHidden((h) => [...h.filter((x) => x.reel._id !== reel._id), { reel, at }]);
    hide({ postId: reel._id, hidden: true, reason }).catch(() =>
      setJustHidden((h) => h.filter((x) => x.reel._id !== reel._id)),
    );
  };
  // The placeholder stays until the reel is back in the live list, so the row doesn't jump.
  const undo = (reel: ShelfReel) =>
    void hide({ postId: reel._id, hidden: false }).then(() =>
      setJustHidden((h) => h.filter((x) => x.reel._id !== reel._id)),
    );

  if (reels !== undefined && reels.length === 0) return null;
  const page = (dir: 1 | -1) =>
    row.current?.scrollBy({ left: dir * (TILE + GAP) * 3, behavior: "smooth" });

  return (
    <Card className="relative rounded-xl">
      <div className="flex h-[47px] items-center gap-2 pr-2 pl-3">
        <Link to="/reel" className="flex items-center gap-2 text-primary hover:underline">
          <ReelsGlyph />
          <span className="font-semibold text-[15px] leading-5">Reels</span>
        </Link>
        <span className="flex-1" />
        <Menu modal={false}>
          <MenuTrigger asChild>
            <IconButton label="More options for Reels" variant="ghost">
              <DotsIcon className="text-icon-secondary" />
            </IconButton>
          </MenuTrigger>
          <MenuContent width={320} arrow>
            {fewer ? (
              <MenuItem
                icon={<ReelsGlyph />}
                label="Show more reels"
                sub="Reels will show up higher in your Feed."
                onSelect={() => onChoose("Show")}
              />
            ) : (
              <MenuItem
                icon={<MinusCircleGlyph />}
                label="Show fewer reels"
                sub="Reels will show up less often in your Feed."
                onSelect={() => onChoose("Show fewer")}
              />
            )}
            <MenuItem
              icon={<EyeOffGlyph />}
              label="Hide all reels"
              sub="Stop seeing Reels in your Feed."
              onSelect={() => onChoose("Hidden")}
            />
            <MenuSeparator />
            <MenuItem icon={<AlertGlyph />} label="Report a problem" onSelect={onReportProblem} />
          </MenuContent>
        </Menu>
      </div>
      <div
        ref={row}
        onScroll={update}
        className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-4"
      >
        {reels === undefined
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[343px] w-[192px] shrink-0 rounded-[10px] bg-btn" />
            ))
          : reels.map((t, i) =>
              t.hidden ? (
                <HiddenTile
                  key={t.reel._id}
                  reported={t.reported}
                  onUndo={t.reported ? undefined : () => undo(t.reel)}
                />
              ) : (
                <ReelTile
                  key={t.reel._id}
                  reel={t.reel}
                  onHide={() => hideReel(t.reel, i, "hidden")}
                  onReport={() => setReporting(t.reel)}
                />
              ),
            )}
      </div>
      {!edge.start && <ShelfArrow side="left" onClick={() => page(-1)} />}
      {!edge.end && reels !== undefined && <ShelfArrow side="right" onClick={() => page(1)} />}
      <Modal
        open={reporting !== null}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Report reel?"
        width={548}
      >
        <div className="p-4">
          <p className="text-[15px] text-primary leading-5">
            We'll review this reel against our Community Standards. Your report is anonymous, and
            the reel will be hidden from your Reels.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="link" className="px-3" onClick={() => setReporting(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="px-8"
              onClick={() => {
                const r = reporting;
                setReporting(null);
                if (!r) return;
                const at = reels?.findIndex((t) => t.reel._id === r._id) ?? 0;
                setJustHidden((h) => h.filter((x) => x.reel._id !== r._id));
                hideReel(r, Math.max(0, at), "reported");
                setReportedIds((ids) => new Set(ids).add(r._id));
              }}
            >
              Report
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

type ShelfReel = FunctionReturnType<typeof api.media.reelsShelf>[number];
type ShelfTile = { reel: ShelfReel; hidden: boolean; reported: boolean };

/** The live shelf with this session's hidden reels re-inserted where they were, as placeholders. */
function withPlaceholders(
  live: ShelfReel[],
  hidden: { reel: ShelfReel; at: number }[],
  reported: Set<string>,
): ShelfTile[] {
  const hiddenIds = new Set(hidden.map((h) => h.reel._id));
  const tiles: ShelfTile[] = live
    .filter((r) => !hiddenIds.has(r._id))
    .map((reel) => ({ reel, hidden: false, reported: false }));
  for (const h of [...hidden].sort((a, b) => a.at - b.at))
    tiles.splice(Math.min(h.at, tiles.length), 0, {
      reel: h.reel,
      hidden: true,
      reported: reported.has(h.reel._id),
    });
  return tiles;
}

/** What's left of a tile after "Hide reel" (with Undo) or "Report". */
function HiddenTile({ reported, onUndo }: { reported: boolean; onUndo?: () => void }) {
  return (
    <div className="flex h-[343px] w-[192px] shrink-0 flex-col items-center justify-center gap-2 rounded-[10px] bg-comment px-4 text-center">
      {reported ? (
        <Flag size={28} className="text-icon-secondary" />
      ) : (
        <EyeOff size={28} className="text-icon-secondary" />
      )}
      <p className="font-semibold text-[15px] text-primary leading-5">
        {reported ? "Thanks for reporting" : "Reel hidden"}
      </p>
      <p className="text-[13px] text-secondary leading-4">
        {reported
          ? "You won't see this reel again."
          : "You'll see fewer reels like this in your Feed."}
      </p>
      {onUndo && (
        <Button variant="secondary" className="mt-1 px-4" onClick={onUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

/** A 9:16 tile: the poster and a muted looping preview while hovered; no caption, like Facebook. */
function ReelTile({
  reel: r,
  onHide,
  onReport,
}: {
  reel: ShelfReel;
  onHide: () => void;
  onReport: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (hover) void el.play().catch(() => {});
    else {
      el.pause();
      el.currentTime = 0;
    }
  }, [hover]);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative h-[343px] w-[192px] shrink-0 overflow-hidden rounded-[10px] bg-black shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
    >
      <Link
        to="/reel/$reelId"
        params={{ reelId: r._id }}
        aria-label={r.caption ? `Reel: ${r.caption}` : "Reel"}
        className="absolute inset-0"
      >
        {r.poster && (
          <img
            src={r.poster}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <video
          ref={video}
          src={r.video}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-0"}`}
        />
        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
      </Link>
      <Menu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="More options for this reel"
            className="absolute top-[6px] right-[10px] flex h-8 w-8 items-center justify-center rounded-full text-white drop-shadow hover:bg-white/20 data-[state=open]:bg-white/20"
          >
            {/* FB: 4px dots on a 7px pitch, centred 22px from the top and 26px from the right. */}
            <DotsIcon size={23} className="rotate-90" />
          </button>
        </MenuTrigger>
        <MenuContent width={300} align="end">
          <MenuItem
            icon={<EyeOffGlyph />}
            label="Hide reel"
            sub="See fewer reels like this."
            onSelect={onHide}
          />
          <MenuItem
            icon={<FlagGlyph />}
            label="Report"
            sub="We won't let them know who reported this."
            onSelect={onReport}
          />
        </MenuContent>
      </Menu>
    </div>
  );
}

function ShelfArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "See more"}
      onClick={onClick}
      className={`absolute top-[194px] flex h-12 w-12 items-center justify-center rounded-full bg-card text-icon-secondary shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.1)] hover:bg-comment ${side === "left" ? "left-4" : "right-4"}`}
    >
      <Icon size={24} strokeWidth={2} />
    </button>
  );
}

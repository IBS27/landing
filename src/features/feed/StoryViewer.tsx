import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  SendHorizontal,
  Settings,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { FriendsAudienceIcon, GlobeIcon } from "@/features/posts/icons";
import { ViewerCornerVeils } from "@/features/posts/ViewerVeil";
import { FacebookLogo } from "@/icons";
import { HeaderActions } from "@/layout/HeaderActions";
import { cn, shortAge } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { StorySettingsDialog } from "./StorySettingsDialog";
import {
  entryStory,
  type StoryBucket,
  type StoryItem,
  storyBackground,
  storyTextColor,
} from "./storyUtils";

const PHOTO_MS = 5000;
const QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😡"];

/**
 * `/stories/<storyId>`: Facebook's full-screen story viewer. The left panel
 * lists your story and everyone else's (blue ring = unseen); the stage plays
 * one person's stories in order with progress segments, then moves on to the
 * next person. Moving between stories replaces the URL, so Back closes it.
 */
export function StoryViewerPage({ storyId }: { storyId: string }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const router = useRouter();
  const tray = useQ(api.stories.tray, {});
  const inTray = tray?.find((b) => b.stories.some((s) => s._id === storyId));
  // Deep links to a story outside the tray: a muted person, a public story, or your archive.
  const direct = useQ(api.stories.get, tray && !inTray ? { storyId } : "skip");
  const archive = useQ(api.stories.archive, direct?.archived ? {} : "skip");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const buckets: StoryBucket[] = inTray ? (tray ?? []) : direct ? [direct.bucket] : [];
  const bucket = inTray ?? direct?.bucket;
  const storyIdx = bucket ? bucket.stories.findIndex((s) => s._id === storyId) : -1;
  const story = bucket?.stories[storyIdx];
  const archived = !inTray && !!direct?.archived;

  const close = useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/" });
  }, [router, navigate]);

  const show = useCallback(
    (id: Id<"stories">) =>
      void navigate({ to: "/stories/$storyId", params: { storyId: id }, replace: true }),
    [navigate],
  );

  // Where Next and Previous go from here (null = past the end / at the start).
  let nextId: Id<"stories"> | null = null;
  let prevId: Id<"stories"> | null = null;
  if (bucket && story) {
    if (archived && archive) {
      const i = archive.findIndex((s) => s._id === story._id);
      nextId = archive[i + 1]?._id ?? null;
      prevId = i > 0 ? archive[i - 1]._id : null;
    } else {
      const b = buckets.indexOf(bucket);
      nextId =
        bucket.stories[storyIdx + 1]?._id ??
        (buckets[b + 1] ? entryStory(buckets[b + 1])._id : null);
      prevId =
        storyIdx > 0
          ? bucket.stories[storyIdx - 1]._id
          : b > 0
            ? buckets[b - 1].stories[buckets[b - 1].stories.length - 1]._id
            : null;
    }
  }
  const next = useCallback(() => (nextId ? show(nextId) : close()), [nextId, show, close]);
  const prev = useCallback(() => prevId && show(prevId), [prevId, show]);

  // The next person's first story, for "Mute" (their stories leave the list).
  const b = bucket ? buckets.indexOf(bucket) : -1;
  const afterBucket = b >= 0 && buckets[b + 1] ? entryStory(buckets[b + 1])._id : null;

  const own = tray?.find((x) => x.author._id === viewer._id);
  const others = tray?.filter((x) => x.author._id !== viewer._id) ?? [];
  const loading = tray === undefined || (!inTray && direct === undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stories"
      // Above the header and chat dock (z-40/z-30), below header popovers and modals.
      className="fixed inset-0 z-[45] flex bg-black"
    >
      <aside className="hidden w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_0_var(--divider)] min-[900px]:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 px-4">
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5a5b5c] text-white transition hover:brightness-110"
          >
            <X size={22} strokeWidth={2.4} />
          </button>
          <Link to="/" aria-label="Facebook">
            <FacebookLogo size={40} />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <h1 className="px-2 pt-3 font-bold text-[24px] text-primary leading-7">Stories</h1>
          <p className="px-2 pt-1 text-[15px] text-link">
            <Link to="/stories/archive" className="hover:underline">
              Archive
            </Link>
            <span className="text-secondary"> · </span>
            <button type="button" onClick={() => setSettingsOpen(true)} className="hover:underline">
              Settings
            </button>
          </p>
          <h2 className="px-2 pt-5 pb-2 font-semibold text-[17px] text-primary">Your story</h2>
          {own ? (
            <BucketRow bucket={own} active={bucket?.author._id === own.author._id} own />
          ) : (
            <Link
              to="/stories/create"
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
            >
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-btn text-fb">
                <Plus size={26} strokeWidth={2.5} />
              </span>
              <span>
                <span className="block font-semibold text-[15px] text-primary">Create a story</span>
                <span className="block text-[13px] text-secondary">
                  Share a photo or write something.
                </span>
              </span>
            </Link>
          )}
          {others.length > 0 && (
            <h2 className="px-2 pt-5 pb-2 font-semibold text-[17px] text-primary">All stories</h2>
          )}
          {others.map((x) => (
            <BucketRow key={x.author._id} bucket={x} active={bucket?.author._id === x.author._id} />
          ))}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center">
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2">
          <HeaderActions />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="absolute top-2 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 min-[900px]:hidden"
        >
          <X size={22} />
        </button>

        {loading ? (
          <Spinner size={32} className="text-white" />
        ) : bucket && story ? (
          <StoryStage
            key={story._id}
            bucket={bucket}
            index={storyIdx}
            archived={archived}
            hasPrev={prevId !== null}
            onNext={next}
            onPrev={prev}
            onClose={close}
            onSkipBucket={() => (afterBucket ? show(afterBucket) : close())}
            onOpenSettings={() => setSettingsOpen(true)}
            settingsOpen={settingsOpen}
          />
        ) : (
          <div className="max-w-sm px-6 text-center text-white">
            <p className="font-bold text-[20px]">This story is no longer available</p>
            <p className="mt-2 text-[15px] text-white/70">
              Stories disappear after 24 hours, or the person may have deleted it or changed who can
              see it.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-5 rounded-md bg-white/20 px-4 py-2 font-semibold text-[15px] hover:bg-white/30"
            >
              Close
            </button>
          </div>
        )}
      </div>
      <StorySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ViewerCornerVeils />
    </div>
  );
}

/** A person in the left panel: ring (blue unseen, grey seen), name, "N new · 3h". */
function BucketRow({
  bucket,
  active,
  own,
}: {
  bucket: StoryBucket;
  active: boolean;
  own?: boolean;
}) {
  const latest = bucket.stories[bucket.stories.length - 1];
  const fresh = bucket.stories.filter((s) => !s.seen).length;
  return (
    <Link
      to="/stories/$storyId"
      params={{ storyId: entryStory(bucket)._id }}
      replace
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
        active ? "bg-hover" : "hover:bg-hover",
      )}
    >
      <StoryRing src={bucket.author.avatar} seen={bucket.seen && !own} size={60} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[15px] text-primary">
          {own ? "Your story" : bucket.author.name}
        </span>
        <span className="block text-[13px] text-secondary">
          {fresh > 0 && <span className="font-semibold text-fb">{fresh} new · </span>}
          {shortAge(latest.createdAt)}
        </span>
      </span>
    </Link>
  );
}

export function StoryRing({ src, seen, size }: { src: string; seen: boolean; size: number }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full p-[3px]",
        seen ? "bg-[var(--divider)]" : "bg-fb",
      )}
      style={{ width: size, height: size }}
    >
      <span className="block h-full w-full rounded-full bg-card p-[2px]">
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
    </span>
  );
}

/* ---------------- Stage ---------------- */

function StoryStage({
  bucket,
  index,
  archived,
  hasPrev,
  onNext,
  onPrev,
  onClose,
  onSkipBucket,
  onOpenSettings,
  settingsOpen,
}: {
  bucket: StoryBucket;
  index: number;
  archived: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkipBucket: () => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
}) {
  const viewer = useViewer();
  const story = bucket.stories[index];
  const own = bucket.author._id === viewer._id;
  const isVideo = story.media.kind === "video" && !!story.media.url;
  const markSeen = useM(api.stories.markSeen);

  const [userPaused, setUserPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState({ menu: false, reply: false, sheet: false, dialog: false });
  const [hidden, setHidden] = useState(() => document.hidden);
  const [muted, setMuted] = useState(() => readMuted());
  const paused =
    userPaused || holding || hidden || settingsOpen || Object.values(busy).some(Boolean);
  const setBusyFlag = useCallback(
    (k: keyof typeof busy, v: boolean) => setBusy((b) => (b[k] === v ? b : { ...b, [k]: v })),
    [],
  );

  const fill = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const elapsed = useRef(0);
  const nextRef = useRef(onNext);
  nextRef.current = onNext;

  // Seen as soon as it's shown (the ring turns grey for this viewer).
  useEffect(() => {
    if (!own && !story.seen && !archived) void markSeen({ storyId: story._id });
  }, [own, story._id, story.seen, archived, markSeen]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Photo and text stories run for 5s; videos for their length.
  useEffect(() => {
    if (isVideo) {
      const el = video.current;
      if (!el) return;
      if (paused) el.pause();
      else
        el.play().catch(() => {
          // Autoplay with sound can be refused; fall back to muted playback.
          el.muted = true;
          setMuted(true);
          void el.play().catch(() => {});
        });
      return;
    }
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      if (fill.current)
        fill.current.style.width = `${Math.min(1, elapsed.current / PHOTO_MS) * 100}%`;
      if (elapsed.current >= PHOTO_MS) return nextRef.current();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, isVideo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, [contenteditable=true]")) return;
      // A menu, popover or dialog on top handles its own keys (Escape closes it first).
      if (
        document.querySelector(
          "[data-radix-popper-content-wrapper], [role=dialog][data-state=open]",
        )
      )
        return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setUserPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev, onClose]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    writeMuted(m);
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 py-4">
      <div className="flex min-h-0 flex-1 items-center gap-6">
        <NavButton label="Previous card" hidden={!hasPrev} onClick={onPrev} side="left" />
        <div
          className="relative aspect-[9/16] h-full max-h-[calc(100vh-104px)] overflow-hidden rounded-lg bg-[#1c1c1d]"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button, a, input")) return;
            setHolding(true);
          }}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
        >
          <StoryMedia
            story={story}
            videoRef={video}
            muted={muted}
            onVideoEnd={onNext}
            fill={fill}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="absolute inset-x-2 top-2 flex gap-1">
            {bucket.stories.map((s, i) => (
              <span key={s._id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  ref={i === index ? fill : undefined}
                  className="block h-full bg-white"
                  style={{ width: i < index ? "100%" : "0%" }}
                />
              </span>
            ))}
          </div>
          <div className="absolute inset-x-3 top-5 flex items-center gap-2">
            <Link
              to="/$username"
              params={{ username: bucket.author.username }}
              className="shrink-0"
            >
              <Avatar src={bucket.author.avatar} size={40} />
            </Link>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              <Link
                to="/$username"
                params={{ username: bucket.author.username }}
                className="truncate font-semibold text-[15px] hover:underline"
              >
                {bucket.author.name}
              </Link>
              <span className="shrink-0 text-[13px] text-white/85">
                {shortAge(story.createdAt)}
              </span>
              <span className="shrink-0 text-white/85" title={audienceTitle(bucket.audience)}>
                {bucket.audience === "public" ? (
                  <GlobeIcon size={12} />
                ) : (
                  <FriendsAudienceIcon size={12} />
                )}
              </span>
            </span>
            <CardIcon
              label={userPaused ? "Play" : "Pause"}
              onClick={() => setUserPaused((p) => !p)}
            >
              {userPaused ? (
                <Play size={20} fill="currentColor" />
              ) : (
                <Pause size={20} fill="currentColor" />
              )}
            </CardIcon>
            {isVideo && (
              <CardIcon label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </CardIcon>
            )}
            <StoryMenu
              bucket={bucket}
              story={story}
              own={own}
              onOpenChange={(o) => setBusyFlag("menu", o)}
              onDialog={(o) => setBusyFlag("dialog", o)}
              onSkipBucket={onSkipBucket}
              onDeleted={onNext}
              onOpenSettings={onOpenSettings}
            />
          </div>

          {own && (
            <ViewersButton
              story={story}
              archived={archived}
              onOpenChange={(o) => setBusyFlag("sheet", o)}
            />
          )}
        </div>
        <NavButton label="Next card" onClick={onNext} side="right" />
      </div>
      {!own && !archived ? (
        <ReplyBar
          story={story}
          firstName={bucket.author.firstName}
          onActive={(a) => setBusyFlag("reply", a)}
        />
      ) : (
        // Keep the card where it sits for everyone else's stories.
        <div aria-hidden className="h-11 shrink-0" />
      )}
    </div>
  );
}

function audienceTitle(a: StoryBucket["audience"]) {
  return a === "public" ? "Public" : a === "custom" ? "Custom" : "Friends";
}

/** The story itself; photos that aren't 9:16 sit on a blurred fill of themselves. */
function StoryMedia({
  story,
  videoRef,
  muted,
  onVideoEnd,
  fill,
}: {
  story: StoryItem;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted: boolean;
  onVideoEnd: () => void;
  fill: React.RefObject<HTMLSpanElement | null>;
}) {
  if (story.background || !story.media.url)
    return (
      <div
        className="flex h-full w-full items-center justify-center p-8 text-center font-bold text-[26px] leading-8"
        style={{
          background: storyBackground(story.background),
          color: storyTextColor(story.background),
        }}
      >
        <span className="whitespace-pre-wrap break-words">{story.text}</span>
      </div>
    );
  const backdrop = (
    <img
      src={story.media.url}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.7]"
    />
  );
  return (
    <>
      {story.media.kind === "video" ? (
        <>
          <video
            aria-hidden
            src={story.media.url}
            muted
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.7]"
          />
          <video
            ref={videoRef}
            src={story.media.url}
            poster={story.media.poster}
            muted={muted}
            playsInline
            onEnded={onVideoEnd}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (fill.current && v.duration)
                fill.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
            }}
            className="relative h-full w-full object-contain"
          />
        </>
      ) : (
        <>
          {backdrop}
          <img
            src={story.media.url}
            alt={story.media.alt ?? ""}
            className="relative h-full w-full object-contain"
          />
        </>
      )}
      {story.text && (
        <p className="-translate-y-1/2 pointer-events-none absolute inset-x-6 top-[62%] whitespace-pre-wrap break-words text-center font-bold text-[24px] text-white leading-[30px] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
          {story.text}
        </p>
      )}
    </>
  );
}

function CardIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function NavButton({
  label,
  onClick,
  side,
  hidden,
}: {
  label: string;
  onClick: () => void;
  side: "left" | "right";
  hidden?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e4e6eb] text-[#050505] shadow-base transition hover:bg-white",
        hidden && "invisible",
      )}
    >
      {side === "left" ? <ChevronLeft size={28} /> : <ChevronRight size={28} />}
    </button>
  );
}

/* ---------------- "…" menu ---------------- */

const REPORT_REASONS = [
  "Nudity or sexual activity",
  "Violence or dangerous organizations",
  "Bullying or harassment",
  "Suicide or self-injury",
  "False information",
  "Scam or fraud",
  "Hate speech or symbols",
  "Intellectual property violation",
  "Something else",
];

function StoryMenu({
  bucket,
  story,
  own,
  onOpenChange,
  onDialog,
  onSkipBucket,
  onDeleted,
  onOpenSettings,
}: {
  bucket: StoryBucket;
  story: StoryItem;
  own: boolean;
  onOpenChange: (o: boolean) => void;
  onDialog: (o: boolean) => void;
  onSkipBucket: () => void;
  onDeleted: () => void;
  onOpenSettings: () => void;
}) {
  const setMuted = useM(api.stories.setMuted);
  const remove = useM(api.stories.remove);
  const [dialog, setDialog] = useState<null | "report" | "delete" | "mute">(null);
  const [reported, setReported] = useState(false);
  const first = bucket.author.firstName;

  const openDialog = (d: typeof dialog) => {
    setDialog(d);
    onDialog(d !== null);
  };

  return (
    <>
      <Menu modal={false} onOpenChange={onOpenChange}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Story options"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <MoreHorizontal size={22} />
          </button>
        </MenuTrigger>
        <MenuContent width={300}>
          {own ? (
            <>
              <MenuItem
                icon={<Trash2 size={20} />}
                label={story.media.url && !story.background ? "Delete photo" : "Delete story"}
                onSelect={() => openDialog("delete")}
              />
              <MenuItem
                icon={<Settings size={20} />}
                label="Story privacy"
                onSelect={onOpenSettings}
              />
            </>
          ) : (
            <>
              <MenuItem
                icon={<MuteIcon />}
                label={`Mute ${first}`}
                sub={`Stop seeing stories from ${first}.`}
                onSelect={() => openDialog("mute")}
              />
              <MenuItem
                icon={<Flag size={20} />}
                label="Find support or report story"
                onSelect={() => {
                  setReported(false);
                  openDialog("report");
                }}
              />
            </>
          )}
        </MenuContent>
      </Menu>

      <Modal
        open={dialog === "mute"}
        onOpenChange={(o) => !o && openDialog(null)}
        title={`Mute ${first}?`}
        width={548}
      >
        <p className="px-4 py-4 text-[15px] text-primary leading-5">
          You'll stop seeing their stories at the top of Feed. You'll still see their posts, and
          you'll still be friends. You can unmute them in Stories → Settings.
        </p>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="link" onClick={() => openDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="min-w-[100px]"
            onClick={() => {
              openDialog(null);
              onSkipBucket();
              void setMuted({ authorId: bucket.author._id, muted: true });
            }}
          >
            Mute
          </Button>
        </div>
      </Modal>

      <Modal
        open={dialog === "delete"}
        onOpenChange={(o) => !o && openDialog(null)}
        title="Delete story?"
        width={548}
      >
        <p className="px-4 py-4 text-[15px] text-primary leading-5">
          Are you sure you want to delete this story? It will be removed from your story and your
          archive. This can't be undone.
        </p>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="link" onClick={() => openDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="min-w-[100px]"
            onClick={() => {
              openDialog(null);
              onDeleted();
              void remove({ storyId: story._id });
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Modal
        open={dialog === "report"}
        onOpenChange={(o) => !o && openDialog(null)}
        title="Report"
        width={548}
      >
        {reported ? (
          <div className="px-4 py-6 text-center">
            <p className="font-semibold text-[17px] text-primary">Thanks for letting us know</p>
            <p className="mt-1 text-[15px] text-secondary">
              Your feedback helps us keep Facebook safe. We won't let {first} know who reported
              this.
            </p>
            <Button
              variant="primary"
              className="mt-4 min-w-[120px]"
              onClick={() => openDialog(null)}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="p-2">
            <p className="px-2 pt-2 pb-1 font-semibold text-[17px] text-primary">
              Why are you reporting this story?
            </p>
            <p className="px-2 pb-2 text-[13px] text-secondary">
              If someone is in immediate danger, get help before reporting to Facebook. Don't wait.
            </p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReported(true)}
                className="flex w-full items-center justify-between rounded-md px-2 py-3 text-left font-medium text-[15px] text-primary hover:bg-hover"
              >
                {r}
                <ChevronRight size={20} className="text-secondary" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function MuteIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M4.7 15.3 15.3 4.7" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- Own story: viewers ---------------- */

function ViewersButton({
  story,
  archived,
  onOpenChange,
}: {
  story: StoryItem;
  archived: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const viewers = useQ(api.stories.viewers, { storyId: story._id });
  const count = viewers?.length ?? story.viewerCount ?? 0;
  const set = (o: boolean) => {
    setOpen(o);
    onOpenChange(o);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => set(!open)}
        className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 font-semibold text-[13px] text-white hover:bg-black/60"
      >
        <Eye size={16} />
        {count === 0
          ? archived
            ? "No viewers"
            : "No viewers yet"
          : `${count} ${count === 1 ? "viewer" : "viewers"}`}
      </button>
      {open && (
        <div className="absolute inset-x-0 bottom-0 flex max-h-[60%] flex-col rounded-t-xl bg-card text-primary shadow-elevated">
          <div className="flex items-center justify-between border-divider border-b px-4 py-3">
            <p className="font-bold text-[17px]">Story details</p>
            <button
              type="button"
              aria-label="Close story details"
              onClick={() => set(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-btn hover:brightness-95"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto p-2">
            <p className="px-2 pb-1 font-semibold text-[15px]">
              {count === 0 ? "No viewers yet" : `${count} ${count === 1 ? "viewer" : "viewers"}`}
            </p>
            {count === 0 && (
              <p className="px-2 pb-3 text-[13px] text-secondary">
                As people view your story, you'll see details here.
              </p>
            )}
            {viewers?.map(({ user, viewedAt }) => (
              <Link
                key={user._id}
                to="/$username"
                params={{ username: user.username }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover"
              >
                <Avatar src={user.avatar} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[15px]">{user.name}</span>
                  <span className="block text-[13px] text-secondary">{shortAge(viewedAt)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Reply ---------------- */

/** "Reply…" plus the quick reactions: both land in the author's Messenger thread. */
function ReplyBar({
  story,
  firstName,
  onActive,
}: {
  story: StoryItem;
  firstName: string;
  onActive: (active: boolean) => void;
}) {
  const reply = useM(api.stories.reply);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; emoji: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => onActive(focused || text.length > 0), [focused, text, onActive]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  };

  const send = async (body: string) => {
    try {
      await reply({ storyId: story._id, text: body });
      flash("Sent");
    } catch (e) {
      flash(e instanceof ConvexError ? String(e.data) : "Couldn't send. Try again.");
    }
  };

  const react = (emoji: string) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, emoji }]);
    void send(emoji);
  };

  return (
    <div className="relative flex w-[min(560px,calc(100vw-420px))] min-w-[340px] shrink-0 items-center gap-2">
      {toast && (
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-full bg-[#3a3b3c] px-4 py-2 font-semibold text-[15px] text-white shadow-elevated">
          {toast}
        </span>
      )}
      {floats.map((f) => (
        <FloatingEmoji
          key={f.id}
          emoji={f.emoji}
          onDone={() => setFloats((all) => all.filter((x) => x.id !== f.id))}
        />
      ))}
      <form
        className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-white/60 px-4 focus-within:border-white"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          void send(body);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Reply…"
          aria-label={`Reply to ${firstName}`}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/80"
        />
        {text.trim() && (
          <button type="submit" aria-label="Send" className="ml-2 text-white hover:opacity-80">
            <SendHorizontal size={20} />
          </button>
        )}
      </form>
      {!text && (
        <div className="flex items-center">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`React with ${e}`}
              onClick={() => react(e)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[28px] leading-none transition-transform hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A quick reaction drifting up over the story after it's sent. */
function FloatingEmoji({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dx = Math.round(Math.random() * 80 - 40);
    const a = el.animate(
      [
        { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
        { transform: "translate(-50%, -60px) scale(1.4)", opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx}px), -360px) scale(1.8)`, opacity: 0 },
      ],
      { duration: 1600, easing: "ease-out" },
    );
    a.onfinish = () => done.current();
    return () => a.cancel();
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-1/2 text-[44px] opacity-0"
    >
      {emoji}
    </span>
  );
}

/* ---------------- Video sound preference ---------------- */

const MUTE_KEY = "fb-clone:storiesMuted";
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
}

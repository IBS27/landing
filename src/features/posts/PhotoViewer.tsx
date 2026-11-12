import { ChevronLeft, ChevronRight, Maximize, Minimize, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { FacebookLogo } from "@/icons";
import { HeaderActions } from "@/layout/HeaderActions";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Spinner } from "@/ui/primitives";
import { ActionBar } from "./ActionBar";
import { CommentComposer, CommentList } from "./CommentsSection";
import { PostContent, PostHeader } from "./PostCard";
import type { PostView } from "./types";
import { VIEWER_ATTR, ViewerCornerVeils } from "./ViewerVeil";

const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

/**
 * Facebook's photo "theater": a black stage (close + logo top-left; zoom and
 * full screen top-right; arrows across the post's photos) and a 360px panel
 * with the header actions, the post and its comments.
 *
 * Pass `onIndexChange` to control the index (the routed theater keeps it in
 * the URL); otherwise `index` is only the starting photo.
 */
export function PhotoViewer({
  post,
  index: indexProp,
  onIndexChange,
  onClose,
}: {
  post: PostView;
  index: number;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}) {
  const [localIndex, setLocalIndex] = useState(indexProp);
  const n = post.media.length;
  const index = Math.min(Math.max(onIndexChange ? indexProp : localIndex, 0), Math.max(n - 1, 0));
  const setIndex = onIndexChange ?? setLocalIndex;
  const item = post.media[index];

  const go = (d: number) => setIndex((index + d + n) % n);
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowLeft") goRef.current(-1);
      if (e.key === "ArrowRight") goRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TheaterShell label={`Photo from ${post.author.name}'s post`} onClose={onClose}>
      <Stage resetKey={index} onClose={onClose} arrows={n > 1} onStep={go}>
        {item?.kind === "video" ? (
          // biome-ignore lint/a11y/useMediaCaption: user videos have no caption track
          <video src={item.url} controls autoPlay className="h-full w-full object-contain" />
        ) : (
          <img
            src={item?.url}
            alt={item?.alt ?? ""}
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
        )}
      </Stage>
      <TheaterPostPanel post={post} />
    </TheaterShell>
  );
}

/**
 * The theater's 360px right panel: header actions, the post (author, text,
 * reactions, labelled Like/Comment/Share row), its comments and a pinned
 * comment composer. Shared by the photo and video theaters.
 */
export function TheaterPostPanel({ post }: { post: PostView }) {
  const [focusKey, setFocusKey] = useState(0);
  return (
    <aside className="flex w-[360px] shrink-0 flex-col bg-card text-primary">
      <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-4">
        <HeaderActions />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-divider border-t">
        <div className="pt-1">
          <PostHeader post={post} />
        </div>
        <PostContent
          post={{ ...post, background: null, media: [], attachments: [], shared: null }}
          expanded
          smallText
        />
        <ActionBar
          variant="labelled"
          post={post}
          onComment={() => setFocusKey((k) => k + 1)}
          className="mx-3"
        />
        <CommentList postId={post._id} />
      </div>
      <div className="border-divider border-t px-3 pt-2 pb-3">
        <CommentComposer postId={post._id} focusKey={focusKey} />
      </div>
    </aside>
  );
}

/** The theater while its post loads, or when it's gone. */
export function PhotoViewerPlaceholder({
  unavailable,
  label = "Photo",
  onClose,
}: {
  unavailable?: boolean;
  label?: string;
  onClose: () => void;
}) {
  return (
    <TheaterShell label={label} onClose={onClose}>
      <Stage onClose={onClose} tools={false}>
        {unavailable ? (
          <div className="max-w-md px-6 text-center text-white">
            <p className="font-bold text-[20px]">This content isn't available right now</p>
            <p className="mt-2 text-[15px] text-white/70">
              When this happens, it's usually because the owner only shared it with a small group of
              people, changed who can see it or it's been deleted.
            </p>
          </div>
        ) : (
          <Spinner size={32} className="text-white" />
        )}
      </Stage>
      <aside className="flex w-[360px] shrink-0 flex-col bg-card">
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-4">
          <HeaderActions />
        </div>
      </aside>
    </TheaterShell>
  );
}

export function TheaterShell({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Content
          aria-describedby={undefined}
          {...{ [VIEWER_ATTR]: "" }}
          // Above the header and chat dock (z-40/z-30), below header popovers and modals.
          className="fixed inset-0 z-[45] flex bg-black outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <D.Title className="sr-only">{label}</D.Title>
          {children}
          <ViewerCornerVeils />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * The black stage: close + logo, zoom (with drag-to-pan), full screen, and the
 * photo arrows. Videos bring their own player controls, so they pass `tools={false}`.
 */
export function Stage({
  children,
  onClose,
  arrows,
  onStep,
  resetKey,
  tools = true,
}: {
  children: ReactNode;
  onClose: () => void;
  /** Zoom and full screen (photos only). */
  tools?: boolean;
  /** Zoom resets whenever this changes (the shown photo). */
  resetKey?: number;
  arrows?: boolean;
  onStep?: (d: number) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const scale = ZOOM_STEPS[zoom];

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the photo changes.
  useEffect(() => {
    setZoom(0);
    setPan({ x: 0, y: 0 });
  }, [resetKey]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (document.fullscreenElement === stage.current) void document.exitFullscreen();
    };
  }, []);

  const setStep = (z: number) => {
    setZoom(z);
    if (z === 0) setPan({ x: 0, y: 0 });
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (scale === 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x) / scale, y: d.py + (e.clientY - d.y) / scale });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div ref={stage} className="relative flex min-w-0 flex-1 bg-black">
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden",
          scale > 1 && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="flex h-full w-full items-center justify-center transition-transform duration-150"
          style={{ transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          {children}
        </div>
      </div>

      <div className="absolute top-2 left-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3a3b3c]/80 text-white transition-colors hover:bg-[#4e4f50]"
        >
          <X size={24} />
        </button>
        <FacebookLogo size={40} />
      </div>

      {tools && (
        <div className="absolute top-2 right-4 flex items-center gap-1">
          <StageTool
            label="Zoom in"
            disabled={zoom === ZOOM_STEPS.length - 1}
            onClick={() => setStep(zoom + 1)}
          >
            <ZoomIn size={22} />
          </StageTool>
          <StageTool label="Zoom out" disabled={zoom === 0} onClick={() => setStep(zoom - 1)}>
            <ZoomOut size={22} />
          </StageTool>
          <StageTool
            label={fullscreen ? "Exit full screen" : "Enter full screen"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </StageTool>
        </div>
      )}

      {arrows && onStep && (
        <>
          <StageArrow side="left" onClick={() => onStep(-1)} />
          <StageArrow side="right" onClick={() => onStep(1)} />
        </>
      )}
    </div>
  );
}

function StageTool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function StageArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#3a3b3c]/80 text-white transition-colors hover:bg-[#4e4f50]",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon size={30} />
    </button>
  );
}

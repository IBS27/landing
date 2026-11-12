import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PhotoViewer, PhotoViewerPlaceholder } from "./PhotoViewer";

/** The open theater rides in history state so the page beneath stays mounted. */
type TheaterState = { postId: string; index: number };

declare module "@tanstack/history" {
  interface HistoryState {
    photo?: TheaterState;
  }
}

/**
 * Opens a post's photo in the theater like Facebook: the address bar shows
 * `/photo/<postId>?i=<n>` (a real route for reloads and shared links) while
 * the current page stays mounted underneath, so Back or Close returns to it
 * at the same scroll position.
 */
export function usePhotoTheater() {
  const navigate = useNavigate();
  return useCallback(
    (postId: string, index: number, replace = false) =>
      void navigate({
        to: ".",
        search: (prev) => prev,
        params: (prev) => prev,
        state: (prev) => ({ ...prev, photo: { postId, index } }),
        mask: { to: "/photo/$postId", params: { postId }, search: index ? { i: index } : {} },
        replace,
        resetScroll: false,
      }),
    [navigate],
  );
}

/** Close a routed theater: back to the page it opened over, or Home for a direct link. */
function useCloseTheater() {
  const router = useRouter();
  const navigate = useNavigate();
  return useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/" });
  }, [router, navigate]);
}

/** Mounted once in the root layout: renders the theater opened by `usePhotoTheater`. */
export function PhotoTheaterHost() {
  const photo = useRouterState({ select: (s) => s.location.state.photo });
  if (!photo) return null;
  return <OverlayTheater photo={photo} />;
}

function OverlayTheater({ photo }: { photo: TheaterState }) {
  const open = usePhotoTheater();
  const close = useCloseTheater();
  return (
    <Theater
      postId={photo.postId}
      index={photo.index}
      onIndexChange={(i) => open(photo.postId, i, true)}
      onClose={close}
    />
  );
}

/** `/photo/<postId>?i=<n>` opened directly (a shared link or a reload without history). */
export function PhotoTheaterPage({ postId, index }: { postId: string; index: number }) {
  const navigate = useNavigate();
  const close = useCloseTheater();
  return (
    <Theater
      postId={postId}
      index={index}
      onIndexChange={(i) =>
        void navigate({
          to: "/photo/$postId",
          params: { postId },
          search: i ? { i } : {},
          replace: true,
        })
      }
      onClose={close}
    />
  );
}

function Theater({
  postId,
  index,
  onIndexChange,
  onClose,
}: {
  postId: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const post = useQ(api.posts.get, { postId: postId as Id<"posts"> });

  // The page beneath must not scroll while the theater covers it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (post === undefined) return <PhotoViewerPlaceholder onClose={onClose} />;
  if (post === null || post.media.length === 0)
    return <PhotoViewerPlaceholder unavailable onClose={onClose} />;
  return <PhotoViewer post={post} index={index} onIndexChange={onIndexChange} onClose={onClose} />;
}

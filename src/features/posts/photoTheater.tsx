import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useQ } from "@/app/viewer";
import { PageUnavailable } from "@/layout/PageUnavailable";
import { api } from "../../../convex/_generated/api";
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

/**
 * Close a routed theater: back to the page it opened over, or `fallback`
 * (Home) for a direct link.
 */
export function useCloseTheater(fallback: "/" | "/watch" = "/") {
  const router = useRouter();
  const navigate = useNavigate();
  return useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: fallback });
  }, [router, navigate, fallback]);
}

/** The page beneath must not scroll while a theater covers it. */
export function useLockBodyScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
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
      direct
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
  direct,
  onIndexChange,
  onClose,
}: {
  postId: string;
  index: number;
  /** Opened from its URL: a missing photo is Facebook's "This Page Isn't Available". */
  direct?: boolean;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  // The id comes from the URL, so it may be malformed or from another table.
  const post = useQ(api.posts.getFromUrl, { postId });
  useLockBodyScroll();

  if (post === undefined) return <PhotoViewerPlaceholder onClose={onClose} />;
  if (post === null || post.media.length === 0)
    return direct ? <PageUnavailable /> : <PhotoViewerPlaceholder unavailable onClose={onClose} />;
  return <PhotoViewer post={post} index={index} onIndexChange={onIndexChange} onClose={onClose} />;
}

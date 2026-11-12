import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/** The open video theater rides in history state so the page beneath stays mounted. */
export type VideoTheaterState = { postId: string; time: number };

declare module "@tanstack/history" {
  interface HistoryState {
    video?: VideoTheaterState;
  }
}

/** An inline player the theater can take over: its element and a way to pause it for good. */
export type InlinePlayer = { el: HTMLVideoElement; hold: () => void };

const inline = new Map<string, InlinePlayer>();

/** Called by inline players that belong to a post; returns the unregister function. */
export function registerInlinePlayer(postId: string, player: InlinePlayer) {
  inline.set(postId, player);
  return () => {
    if (inline.get(postId) === player) inline.delete(postId);
  };
}

export function inlinePlayer(postId: string) {
  return inline.get(postId);
}

/**
 * Opens a post's video in the theater like Facebook: the address bar shows
 * `/watch?v=<postId>` (a real route for reloads and shared links) while the
 * current page stays mounted underneath. Playback continues from where the
 * inline player was, and the inline player pauses.
 */
export function useVideoTheater() {
  const navigate = useNavigate();
  const router = useRouter();
  return useCallback(
    (postId: string) => {
      // Already showing this video (the theater's own timestamp).
      const loc = router.state.location;
      if (
        loc.state.video?.postId === postId ||
        (loc.pathname === "/watch" && (loc.search as { v?: string }).v === postId)
      )
        return;
      const p = inline.get(postId);
      const time = p && !p.el.ended ? p.el.currentTime : 0;
      p?.hold();
      void navigate({
        to: ".",
        search: (prev) => prev,
        params: (prev) => prev,
        state: (prev) => ({ ...prev, video: { postId, time } }),
        mask: { to: "/watch", search: { v: postId } },
        resetScroll: false,
      });
    },
    [navigate, router],
  );
}

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { Avatar } from "@/ui/primitives";
import type { PostView } from "./types";

/** Facebook's red "LIVE" pill. */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded bg-[#F02849] px-1.5 font-bold text-[13px] text-white uppercase leading-none tracking-wide",
        className,
      )}
    >
      Live
    </span>
  );
}

/** Seconds since `since`, ticking once a second. */
export function useElapsed(since: number, running = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return Math.max(0, Math.floor((now - since) / 1000));
}

export function formatElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * A live broadcast in the feed. The clone has no media server, so viewers see
 * the broadcaster's card (blurred cover of their photo, LIVE pill and a
 * running timer) rather than the stream; once the host ends it, the same box
 * reads "Live video ended". Updates arrive in real time from Convex.
 */
export function LivePostMedia({
  post,
}: {
  post: PostView & { live: NonNullable<PostView["live"]> };
}) {
  const ended = post.live.endedAt !== null;
  const elapsed = useElapsed(post.live.startedAt, !ended);
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black">
      <img
        src={post.author.avatar}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
      />
      <div className="relative flex flex-col items-center px-6 text-center text-white">
        <span className={cn("rounded-full p-1", !ended && "ring-[3px] ring-[#F02849]")}>
          <Avatar src={post.author.avatar} size={96} />
        </span>
        <p className="mt-4 font-bold text-[20px] leading-6">
          {ended ? "Live video ended" : `${post.author.name} is live now`}
        </p>
      </div>
      {!ended && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <LiveBadge />
          <span className="inline-flex h-6 items-center rounded bg-black/55 px-1.5 font-semibold text-[13px] text-white tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        </div>
      )}
    </div>
  );
}

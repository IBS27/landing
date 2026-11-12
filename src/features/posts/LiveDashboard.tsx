import { Activity, Clock, Users } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatElapsed, useElapsed } from "./LivePost";
import { MAX_RECORDING_MS, type Recording } from "./useLiveRecording";
import type { BroadcastStats } from "./useLiveStream";

/**
 * The Live Producer's on-air dashboard under the stream preview, like
 * Facebook's: stream health (bitrate, frame rate and resolution from the
 * viewers' WebRTC connections, or the recorder and camera before anyone
 * joins), viewers (now and peak) and duration (with the replay recording).
 */

type Health = "Excellent" | "Good" | "Poor";

type HealthSample = {
  health: Health;
  kbps: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
};

const SAMPLE_MS = 2000;

function rate(fps: number | null, loss: number, limited: boolean, signal: boolean): Health {
  if (!signal || (fps !== null && fps < 15) || loss > 0.05) return "Poor";
  if ((fps !== null && fps < 24) || loss > 0.01 || limited) return "Good";
  return "Excellent";
}

function useStreamHealth(
  stream: MediaStream | null,
  stats: () => Promise<BroadcastStats | null>,
  recording: () => Recording | null,
) {
  const [sample, setSample] = useState<HealthSample | null>(null);
  const lastBytes = useRef<{ bytes: number; at: number } | null>(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      const s = await stats();
      const rec = recording();
      const now = performance.now();
      const bytes = rec?.bytes() ?? null;
      const prev = lastBytes.current;
      lastBytes.current = bytes === null ? null : { bytes, at: now };
      const recKbps =
        bytes !== null && prev && now > prev.at
          ? ((bytes - prev.bytes) * 8) / (now - prev.at)
          : null;
      const track = stream?.getVideoTracks()[0];
      const signal = !!track && track.readyState === "live";
      const settings = track?.getSettings();
      const fps = s?.fps ?? settings?.frameRate ?? null;
      if (!live) return;
      setSample({
        health: rate(fps, s?.loss ?? 0, s?.limited ?? false, signal),
        kbps: s?.kbps ?? (rec?.active() ? recKbps : null),
        fps,
        width: s?.width ?? settings?.width ?? null,
        height: s?.height ?? settings?.height ?? null,
      });
    };
    void tick();
    const id = window.setInterval(() => void tick(), SAMPLE_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [stream, stats, recording]);
  return sample;
}

export function OnAirDashboard({
  postId,
  startedAt,
  stream,
  stats,
  recording,
}: {
  postId: Id<"posts">;
  startedAt: number;
  stream: MediaStream | null;
  stats: () => Promise<BroadcastStats | null>;
  recording: () => Recording | null;
}) {
  const sample = useStreamHealth(stream, stats, recording);
  return (
    <div className="grid shrink-0 grid-cols-[1.25fr_1fr_1fr] gap-3">
      <HealthCard sample={sample} />
      <ViewersCard postId={postId} />
      <DurationCard startedAt={startedAt} recording={recording} />
    </div>
  );
}

function DashCard({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg bg-card px-4 py-3 shadow-base">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate font-semibold text-[15px] text-primary leading-5">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const HEALTH_STYLE: Record<Health, string> = {
  Excellent: "bg-[#E6F4EA] text-[#1E8E3E] dark:bg-[#1E8E3E]/25 dark:text-[#81C995]",
  Good: "bg-[#FEF7E0] text-[#B06000] dark:bg-[#F9AB00]/20 dark:text-[#FDD663]",
  Poor: "bg-[#FCE8E6] text-[#D93025] dark:bg-[#D93025]/25 dark:text-[#F28B82]",
};

function HealthCard({ sample }: { sample: HealthSample | null }) {
  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-2 text-[13px] leading-5">
      <span className="text-secondary">{label}</span>
      <span className="font-semibold text-primary tabular-nums">{value}</span>
    </div>
  );
  return (
    <DashCard
      icon={<Activity size={16} />}
      title="Stream health"
      aside={
        sample && (
          <span
            role="status"
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-semibold text-[12px] leading-4",
              HEALTH_STYLE[sample.health],
            )}
          >
            {sample.health}
          </span>
        )
      }
    >
      {row(
        "Bitrate",
        sample?.kbps != null ? `${Math.round(sample.kbps).toLocaleString()} Kbps` : "—",
      )}
      {row("Frame rate", sample?.fps != null ? `${Math.round(sample.fps)} fps` : "—")}
      {row("Resolution", sample?.width && sample.height ? `${sample.width}×${sample.height}` : "—")}
    </DashCard>
  );
}

function ViewersCard({ postId }: { postId: Id<"posts"> }) {
  const stats = useQ(api.live.stats, { postId });
  const now = stats?.viewers ?? 0;
  const [peak, setPeak] = useState(0);
  useEffect(() => setPeak((p) => Math.max(p, now)), [now]);
  return (
    <DashCard icon={<Users size={16} />} title="Viewers">
      <p className="font-bold text-[24px] text-primary tabular-nums leading-7">
        {now.toLocaleString()}
      </p>
      <p className="text-[13px] text-secondary leading-4">
        Watching now · Peak {peak.toLocaleString()}
      </p>
    </DashCard>
  );
}

function DurationCard({
  startedAt,
  recording,
}: {
  startedAt: number;
  recording: () => Recording | null;
}) {
  const elapsed = useElapsed(startedAt);
  const recActive = recording()?.active() ?? false;
  const capped = !recActive && elapsed * 1000 >= MAX_RECORDING_MS;
  return (
    <DashCard icon={<Clock size={16} />} title="Duration">
      <p className="font-bold text-[24px] text-primary tabular-nums leading-7">
        {formatElapsed(elapsed)}
      </p>
      <p className="flex items-center gap-1.5 text-[13px] text-secondary leading-4">
        {recActive && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#F02849]" />}
        <span className="truncate">
          {recActive
            ? "Recording for your profile"
            : capped
              ? "Recording stopped at 15:00"
              : "Not recording"}
        </span>
      </p>
    </DashCard>
  );
}

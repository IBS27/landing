import { useCallback, useEffect, useRef } from "react";
import { useM } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Records a live broadcast for its replay. The host's MediaRecorder output is
 * uploaded to Convex storage in ~30-second parts while on air, so ending only
 * waits for the last one; `finish` then has the parts joined into the post's
 * video (`live.finishRecording`). Recording stops after 15 minutes; the
 * broadcast goes on. If an upload fails the recording is dropped and the post
 * keeps its "Live video ended" card.
 */

const PART_MS = 30_000;
export const MAX_RECORDING_MS = 15 * 60_000;
const VIDEO_BPS = 1_500_000;
const AUDIO_BPS = 96_000;
/** MP4 first (it carries its own duration), then WebM. */
const TYPES = [
  "video/mp4;codecs=avc1,opus",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

type Api = {
  uploadUrl: (args: { postId: Id<"posts"> }) => Promise<string>;
  addPart: (args: {
    postId: Id<"posts">;
    take: string;
    seq: number;
    storageId: Id<"_storage">;
    width?: number;
    height?: number;
  }) => Promise<null>;
  finish: (args: {
    postId: Id<"posts">;
    take: string;
    parts: number;
    posterStorageId?: Id<"_storage">;
    width: number;
    height: number;
    duration: number;
  }) => Promise<null>;
  discard: (args: { postId: Id<"posts">; take: string }) => Promise<null>;
};

export type Recording = {
  /** Stops the recorder (the last frames are kept). */
  stop: () => Promise<void>;
  /** Stops, uploads what's left and turns the post into the replay. False if anything failed. */
  finish: () => Promise<boolean>;
  /** Encoded bytes so far (the producer's bitrate when nobody is watching yet). */
  bytes: () => number;
  /** Still recording (false once stopped or capped at 15 minutes). */
  active: () => boolean;
};

/** Uploads `blob` to Convex storage (a fresh upload URL per try; three tries). */
async function upload(getUrl: () => Promise<string>, blob: Blob) {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetch(await getUrl(), {
        method: "POST",
        // Storage takes the bare media type ("video/mp4", not its codecs).
        headers: { "Content-Type": blob.type.split(";")[0] },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    } catch (e) {
      if (tries >= 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (tries + 1)));
    }
  }
}

/** One frame of `stream` as a JPEG (the replay's poster). */
async function grabFrame(stream: MediaStream): Promise<Blob | null> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  try {
    await v.play();
    await new Promise((r) => setTimeout(r, 250));
    if (!v.videoWidth) return null;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    v.srcObject = null;
  }
}

function startRecording(postId: Id<"posts">, stream: MediaStream, api: Api): Recording | null {
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  let rec: MediaRecorder;
  try {
    const options: MediaRecorderOptions & { videoKeyFrameIntervalDuration?: number } = {
      mimeType,
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
      // Chrome's MP4 writer only hands data over at keyframes.
      videoKeyFrameIntervalDuration: 2000,
    };
    rec = new MediaRecorder(stream, options);
  } catch {
    return null;
  }
  const take = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const type = rec.mimeType || mimeType || "video/webm";
  const settings = stream.getVideoTracks()[0]?.getSettings();
  const size = { width: settings?.width ?? 1280, height: settings?.height ?? 720 };
  const startedAt = Date.now();
  let stoppedAt = 0;
  let pending: Blob[] = [];
  let pendingSince = startedAt;
  let total = 0;
  let seq = 0;
  let failed = false;
  let uploads = Promise.resolve();
  let poster: Promise<Id<"_storage"> | undefined> = Promise.resolve(undefined);

  const flush = () => {
    if (pending.length === 0) return;
    const blob = new Blob(pending, { type });
    pending = [];
    pendingSince = Date.now();
    const n = seq++;
    uploads = uploads.then(async () => {
      if (failed) return;
      try {
        const storageId = await upload(() => api.uploadUrl({ postId }), blob);
        await api.addPart({ postId, take, seq: n, storageId, ...size });
      } catch (e) {
        console.warn("Live recording upload failed", e);
        failed = true;
      }
    });
  };

  rec.ondataavailable = (e) => {
    if (e.data.size === 0) return;
    pending.push(e.data);
    total += e.data.size;
    if (Date.now() - pendingSince >= PART_MS) flush();
  };
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => {
      stoppedAt ||= Date.now();
      flush();
      resolve();
    };
  });
  rec.onerror = () => {
    if (rec.state !== "inactive") rec.stop();
  };
  rec.start(1000);

  const cap = window.setTimeout(() => {
    if (rec.state !== "inactive") rec.stop();
  }, MAX_RECORDING_MS);
  // A frame a few seconds in becomes the replay's poster.
  const posterTimer = window.setTimeout(() => {
    poster = grabFrame(stream).then(async (jpeg) => {
      if (!jpeg) return undefined;
      return upload(() => api.uploadUrl({ postId }), jpeg).catch(() => undefined);
    });
  }, 3000);

  const stop = () => {
    window.clearTimeout(cap);
    window.clearTimeout(posterTimer);
    if (rec.state !== "inactive") {
      stoppedAt = Date.now();
      rec.stop();
    }
    return stopped;
  };

  let finishing: Promise<boolean> | null = null;
  const finish = () => {
    finishing ??= (async () => {
      await stop();
      await uploads;
      if (failed || seq === 0) {
        await api.discard({ postId, take }).catch(() => {});
        return false;
      }
      try {
        await api.finish({
          postId,
          take,
          parts: seq,
          posterStorageId: await poster,
          ...size,
          duration: Math.round((stoppedAt - startedAt) / 100) / 10,
        });
        return true;
      } catch {
        return false;
      }
    })();
    return finishing;
  };

  return { stop, finish, bytes: () => total, active: () => rec.state === "recording" };
}

/**
 * Records `stream` while the broadcast `postId` is on (null when not live).
 * Leaving the producer finishes the recording in the background.
 */
export function useLiveRecording(postId: Id<"posts"> | null, stream: MediaStream | null) {
  const uploadUrl = useM(api.live.recordingUploadUrl);
  const addPart = useM(api.live.addRecordingPart);
  const finish = useM(api.live.finishRecording);
  const discard = useM(api.live.discardRecording);
  const current = useRef<Recording | null>(null);
  const apiRef = useRef<Api>({ uploadUrl, addPart, finish, discard });
  apiRef.current = { uploadUrl, addPart, finish, discard };

  useEffect(() => {
    if (!postId || !stream || typeof MediaRecorder === "undefined") return;
    // Bound late so the latest mutation functions are used.
    const r = startRecording(postId, stream, {
      uploadUrl: (a) => apiRef.current.uploadUrl(a),
      addPart: (a) => apiRef.current.addPart(a),
      finish: (a) => apiRef.current.finish(a),
      discard: (a) => apiRef.current.discard(a),
    });
    current.current = r;
    return () => {
      if (current.current === r) current.current = null;
      void r?.finish();
    };
  }, [postId, stream]);

  return useCallback(() => current.current, []);
}

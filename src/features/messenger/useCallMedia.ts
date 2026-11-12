import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The local side of a Messenger call: one mic track and at most one outgoing
 * video track, which is either the camera or a shared screen. Turning the
 * camera off releases it (the camera light goes off) rather than sending black
 * frames; muting the mic keeps the track and disables it.
 */

export type VideoSource = "camera" | "screen";
export type DeviceKind = "audioinput" | "audiooutput" | "videoinput";
export type DevicePrefs = Partial<Record<DeviceKind, string>>;

const PREFS_KEY = "fb-clone:callDevices";

function loadPrefs(): DevicePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? (v as DevicePrefs) : {};
  } catch {
    return {};
  }
}

function savePrefs(p: DevicePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private windows can refuse storage; the choice still applies to this call.
  }
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true };
const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
const pick = (base: MediaTrackConstraints, deviceId?: string): MediaTrackConstraints =>
  deviceId ? { ...base, deviceId: { ideal: deviceId } } : base;

async function capture(kind: "audio" | "video", deviceId?: string) {
  const s = await navigator.mediaDevices.getUserMedia({
    [kind]: pick(kind === "audio" ? AUDIO : VIDEO, deviceId),
  });
  return s.getTracks()[0] ?? null;
}

/** Adopts a track unless the call already ended, in which case it's released. */
function keep(state: { alive: boolean }, t: MediaStreamTrack | null) {
  if (t && !state.alive) {
    t.stop();
    return null;
  }
  return t;
}

export type CallMedia = ReturnType<typeof useCallMedia>;

export function useCallMedia(kind: "audio" | "video", joined: boolean) {
  const [audio, setAudio] = useState<MediaStreamTrack | null>(null);
  const [video, setVideo] = useState<MediaStreamTrack | null>(null);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [settled, setSettled] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [camBlocked, setCamBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<DevicePrefs>(loadPrefs);

  // Mirrors for the async helpers, which outlive renders.
  const cur = useRef({ audio, video, source, prefs, alive: false, cameraWanted: false });
  cur.current.audio = audio;
  cur.current.video = video;
  cur.current.source = source;
  cur.current.prefs = prefs;

  // Ask for the mic (and the camera on video calls) once this person is in the call.
  useEffect(() => {
    if (!joined) return;
    // Per run: a StrictMode replay or quick leave/rejoin must not adopt an earlier run's capture.
    let cancelled = false;
    const state = cur.current;
    state.alive = true;
    state.cameraWanted = kind === "video";
    const md = navigator.mediaDevices;
    const p = state.prefs;
    const ask = async () => {
      if (!md?.getUserMedia) return { a: null, v: null };
      if (kind === "video") {
        try {
          const s = await md.getUserMedia({
            audio: pick(AUDIO, p.audioinput),
            video: pick(VIDEO, p.videoinput),
          });
          return { a: s.getAudioTracks()[0] ?? null, v: s.getVideoTracks()[0] ?? null };
        } catch {
          // No camera, or it was refused: try the mic alone.
        }
      }
      try {
        return { a: await capture("audio", p.audioinput), v: null };
      } catch {
        return { a: null, v: null };
      }
    };
    void ask().then(({ a: track, v: cam }) => {
      if (cancelled) {
        track?.stop();
        cam?.stop();
        return;
      }
      setAudio(track);
      setVideo(cam);
      setSource(cam ? "camera" : null);
      setMicBlocked(!track);
      setCamBlocked(kind === "video" && !cam);
      setSettled(true);
    });
    return () => {
      cancelled = true;
      state.alive = false;
      state.audio?.stop();
      state.video?.stop();
      setAudio(null);
      setVideo(null);
      setSource(null);
      setSettled(false);
    };
  }, [kind, joined]);

  const run = useCallback(async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  }, []);

  /** Camera on/off. While sharing the screen, turning the camera on ends the share. */
  const setCamera = useCallback(
    (on: boolean) =>
      run(async () => {
        const state = cur.current;
        state.cameraWanted = on;
        if (!on) {
          state.video?.stop();
          setVideo(null);
          setSource(null);
          return;
        }
        let cam: MediaStreamTrack | null = null;
        try {
          cam = keep(state, await capture("video", state.prefs.videoinput));
        } catch {
          setCamBlocked(true);
          state.cameraWanted = false;
          return;
        }
        if (!cam) return;
        state.video?.stop();
        setCamBlocked(false);
        setVideo(cam);
        setSource("camera");
      }),
    [run],
  );

  const stopScreen = useCallback(() => {
    const state = cur.current;
    if (state.source !== "screen") return;
    state.video?.stop();
    setVideo(null);
    setSource(null);
    // Back to the camera if it was on before the share.
    if (state.cameraWanted) void setCamera(true);
  }, [setCamera]);

  const shareScreen = useCallback(
    () =>
      run(async () => {
        const md = navigator.mediaDevices;
        if (!md?.getDisplayMedia) return;
        let screen: MediaStreamTrack | null = null;
        try {
          const s = await md.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
          screen = keep(cur.current, s.getVideoTracks()[0] ?? null);
        } catch {
          return; // Picker cancelled.
        }
        if (!screen) return;
        const state = cur.current;
        // The browser's own "Stop sharing" bar ends the track.
        screen.addEventListener("ended", () => {
          if (cur.current.video === screen) stopScreen();
        });
        if (state.source === "camera") state.video?.stop();
        setVideo(screen);
        setSource("screen");
      }),
    [run, stopScreen],
  );

  /** Switches the mic or camera to another device (and remembers the choice). */
  const setDevice = useCallback(
    (kind: DeviceKind, deviceId: string) =>
      run(async () => {
        const state = cur.current;
        const next = { ...state.prefs, [kind]: deviceId };
        state.prefs = next;
        setPrefs(next);
        savePrefs(next);
        if (kind === "audioinput" && state.alive) {
          try {
            const t = keep(state, await capture("audio", deviceId));
            if (!t) return;
            if (state.audio) t.enabled = state.audio.enabled;
            state.audio?.stop();
            setAudio(t);
            setMicBlocked(false);
          } catch {
            // Keep the current mic.
          }
        }
        if (kind === "videoinput" && state.alive && state.source === "camera") {
          try {
            const t = keep(state, await capture("video", deviceId));
            if (!t) return;
            state.video?.stop();
            setVideo(t);
          } catch {
            // Keep the current camera.
          }
        }
      }),
    [run],
  );

  return {
    audio,
    video,
    source,
    settled,
    micBlocked,
    camBlocked,
    busy,
    prefs,
    setCamera,
    shareScreen,
    stopScreen,
    setDevice,
    canShare: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia,
  };
}

/** Mics, speakers and cameras, refreshed when one is plugged in or removed. */
export function useMediaDevices(enabled: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!enabled || !md?.enumerateDevices) return;
    let live = true;
    const load = () =>
      void md
        .enumerateDevices()
        .then((d) => live && setDevices(d))
        .catch(() => {});
    load();
    md.addEventListener("devicechange", load);
    return () => {
      live = false;
      md.removeEventListener("devicechange", load);
    };
  }, [enabled]);
  return devices;
}

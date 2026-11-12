import { useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { ICE_SERVERS } from "@/features/messenger/useCallPeers";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Live video over WebRTC, one-to-many, with Convex as the signaling channel
 * (the same ICE servers as Messenger calls).
 *
 * Every open player registers a viewer session (`live.join`). The host's Live
 * Producer keeps one send-only RTCPeerConnection per session and offers it the
 * camera and microphone; the viewer answers, and ICE candidates follow. Each
 * connection has a session id (`sid`) that its signals carry, so signals from
 * a replaced connection are ignored. The host re-offers a connection that
 * fails, and a reloaded producer re-offers every open session; a viewer whose
 * connection stays down rejoins with a new session.
 */

type SignalData = {
  sid?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

/** Works outside secure contexts too, where `crypto.randomUUID` is missing. */
const newSid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Runs async signaling steps one at a time, in order. */
function useSerialQueue(label: string) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  return useCallback(
    (job: () => Promise<void>) => {
      queue.current = queue.current.then(job).catch((e: unknown) => {
        console.warn(`${label} signaling step failed`, e);
      });
    },
    [label],
  );
}

/* ------------------------------------------------------------------ */
/* Host                                                                */
/* ------------------------------------------------------------------ */

type HostPeer = {
  pc: RTCPeerConnection;
  sid: string;
  /** Candidates gathered before the offer went out, and remote ones before the answer. */
  outIce: RTCIceCandidateInit[];
  offerSent: boolean;
  pendingIce: RTCIceCandidateInit[];
  retry?: number;
};

/**
 * The Live Producer's side: streams `stream` to every open viewer session of
 * the broadcast `postId` (null when not live).
 */
export function useLiveBroadcast(postId: Id<"posts"> | null, stream: MediaStream | null) {
  const sessions = useQ(api.live.sessions, postId ? { postId } : "skip");
  const signals = useQ(api.live.hostSignals, postId ? { postId } : "skip");
  const signalViewer = useM(api.live.signalViewer);
  const enqueue = useSerialQueue("Live broadcast");

  const peers = useRef(new Map<Id<"liveViewers">, HostPeer>());
  const handled = useRef(new Set<string>());
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const wanted = useRef(new Set<Id<"liveViewers">>());
  const sessionKey = (sessions ?? []).map((s) => s._id).join(",");

  const send = useCallback(
    (sessionId: Id<"liveViewers">, type: "offer" | "ice", payload: SignalData) =>
      signalViewer({ sessionId, type, payload: JSON.stringify(payload) }).catch(() => {}),
    [signalViewer],
  );

  const close = useCallback((id: Id<"liveViewers">) => {
    const p = peers.current.get(id);
    if (!p) return;
    window.clearTimeout(p.retry);
    p.pc.onicecandidate = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    peers.current.delete(id);
  }, []);

  const offer = useCallback(
    (id: Id<"liveViewers">) => {
      const media = streamRef.current;
      if (!media) return;
      close(id);
      const sid = newSid();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: HostPeer = { pc, sid, outIce: [], offerSent: false, pendingIce: [] };
      peers.current.set(id, peer);
      for (const track of media.getTracks())
        pc.addTransceiver(track, { direction: "sendonly", streams: [media] });
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const candidate = e.candidate.toJSON();
        if (peer.offerSent) void send(id, "ice", { sid, candidate });
        else peer.outIce.push(candidate);
      };
      // A dropped connection gets a fresh offer while the viewer is still there.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== "failed") return;
        peer.retry = window.setTimeout(() => {
          if (peers.current.get(id) === peer && wanted.current.has(id))
            enqueue(async () => offer(id));
        }, 1500);
      };
      enqueue(async () => {
        if (peers.current.get(id) !== peer) return;
        await pc.setLocalDescription();
        await send(id, "offer", { sid, sdp: pc.localDescription?.toJSON() });
        peer.offerSent = true;
        for (const candidate of peer.outIce.splice(0)) void send(id, "ice", { sid, candidate });
      });
    },
    [close, send, enqueue],
  );

  // One connection per open session: offer to new ones, close ones that left.
  const hasStream = stream !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionKey stands in for sessions
  useEffect(() => {
    if (!postId || !hasStream || !sessions) return;
    const want = new Set(sessions.map((s) => s._id));
    wanted.current = want;
    for (const id of [...peers.current.keys()]) if (!want.has(id)) close(id);
    for (const id of want) if (!peers.current.has(id)) offer(id);
  }, [postId, hasStream, sessionKey, offer, close]);

  // Tear everything down when the broadcast ends or the producer closes.
  useEffect(() => {
    if (!postId || !hasStream) return;
    const map = peers.current;
    const seen = handled.current;
    return () => {
      for (const id of [...map.keys()]) close(id);
      seen.clear();
    };
  }, [postId, hasStream, close]);

  // A new camera or microphone (after "Try again") replaces the outgoing tracks in place.
  useEffect(() => {
    if (!stream) return;
    for (const { pc } of peers.current.values())
      for (const tr of pc.getTransceivers()) {
        const kind = tr.receiver.track.kind;
        const next = stream.getTracks().find((t) => t.kind === kind) ?? null;
        if (tr.sender.track !== next) void tr.sender.replaceTrack(next).catch(() => {});
      }
  }, [stream]);

  // Answers and ICE candidates from viewers.
  useEffect(() => {
    if (!postId || !hasStream || !signals) return;
    for (const s of signals) {
      if (handled.current.has(s._id)) continue;
      handled.current.add(s._id);
      enqueue(async () => {
        const peer = peers.current.get(s.sessionId);
        const data = JSON.parse(s.payload) as SignalData;
        if (!peer || peer.sid !== data.sid) return;
        if (s.type === "answer" && data.sdp && peer.pc.signalingState === "have-local-offer") {
          await peer.pc.setRemoteDescription(data.sdp);
          for (const c of peer.pendingIce.splice(0))
            await peer.pc.addIceCandidate(c).catch(() => {});
        } else if (s.type === "ice" && data.candidate) {
          if (peer.pc.remoteDescription)
            await peer.pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pendingIce.push(data.candidate);
        }
      });
    }
  }, [postId, hasStream, signals, enqueue]);
}

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */

export type LiveConnection = "idle" | "connecting" | "connected" | "reconnecting";

type ViewerPeer = { pc: RTCPeerConnection; sid: string; pendingIce: RTCIceCandidateInit[] };

/** How often an open player tells Convex it's still watching. */
const PING_MS = 10_000;
/** A connection that stays down this long is abandoned for a new session. */
const REJOIN_MS = 8_000;

/**
 * A player's side: while `enabled`, joins the broadcast and receives the
 * host's camera and microphone. `stream` is replaced on each new connection.
 */
export function useLiveViewer(postId: Id<"posts">, enabled: boolean) {
  const join = useM(api.live.join);
  const ping = useM(api.live.ping);
  const leave = useM(api.live.leave);
  const signalHost = useM(api.live.signalHost);
  const enqueue = useSerialQueue("Live viewer");

  const [sessionId, setSessionId] = useState<Id<"liveViewers"> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<LiveConnection>("idle");
  const signals = useQ(api.live.viewerSignals, sessionId ? { sessionId } : "skip");

  const peer = useRef<ViewerPeer | null>(null);
  const earlyIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const handled = useRef(new Set<string>());
  const everConnected = useRef(false);
  const rejoin = useCallback(() => setAttempt((n) => n + 1), []);

  const closePeer = useCallback(() => {
    const p = peer.current;
    if (!p) return;
    p.pc.ontrack = null;
    p.pc.onicecandidate = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    peer.current = null;
  }, []);

  // Register a session while enabled; leave on unmount, when disabled, or to rejoin.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` rejoins with a new session.
  useEffect(() => {
    if (!enabled) {
      setState("idle");
      everConnected.current = false;
      return;
    }
    let cancelled = false;
    let id: Id<"liveViewers"> | null = null;
    setState(everConnected.current ? "reconnecting" : "connecting");
    join({ postId })
      .then((sid) => {
        if (cancelled) {
          if (sid) void leave({ sessionId: sid }).catch(() => {});
          return;
        }
        id = sid;
        setSessionId(sid);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      closePeer();
      handled.current.clear();
      earlyIce.current.clear();
      setSessionId(null);
      if (id) void leave({ sessionId: id }).catch(() => {});
    };
  }, [enabled, postId, attempt, join, leave, closePeer]);

  // Keep the session alive; a session that was dropped (a long sleep) rejoins.
  useEffect(() => {
    if (!sessionId) return;
    const beat = () =>
      void ping({ sessionId })
        .then((ok) => !ok && rejoin())
        .catch(() => {});
    const t = window.setInterval(beat, PING_MS);
    return () => window.clearInterval(t);
  }, [sessionId, ping, rejoin]);

  // Report whether the stream is reaching this player (the host's viewer count).
  useEffect(() => {
    if (!sessionId) return;
    void ping({ sessionId, connected: state === "connected" }).catch(() => {});
  }, [sessionId, state, ping]);

  // A connection that stays down (or never arrives after a drop) starts over.
  useEffect(() => {
    if (state !== "reconnecting" || !sessionId) return;
    const t = window.setTimeout(rejoin, REJOIN_MS);
    return () => window.clearTimeout(t);
  }, [state, sessionId, rejoin]);

  // The host's offer and ICE candidates.
  useEffect(() => {
    if (!sessionId) return;
    if (signals === null) {
      // The session was dropped server-side.
      rejoin();
      return;
    }
    if (!signals) return;
    for (const s of signals) {
      if (handled.current.has(s._id)) continue;
      handled.current.add(s._id);
      enqueue(() => handle(s.type, JSON.parse(s.payload) as SignalData));
    }

    async function handle(type: string, data: SignalData) {
      const sid = data.sid;
      if (!sid || !sessionId) return;
      if (type === "offer" && data.sdp) {
        // Every offer is a fresh connection (a new host page or a retry).
        closePeer();
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const p: ViewerPeer = { pc, sid, pendingIce: [] };
        peer.current = p;
        const media = new MediaStream();
        pc.ontrack = (e) => {
          if (!media.getTrackById(e.track.id)) media.addTrack(e.track);
          setStream(media);
        };
        pc.onicecandidate = (e) => {
          if (e.candidate)
            void signalHost({
              sessionId,
              type: "ice",
              payload: JSON.stringify({ sid, candidate: e.candidate.toJSON() }),
            }).catch(() => {});
        };
        pc.onconnectionstatechange = () => {
          if (peer.current !== p) return;
          const cs = pc.connectionState;
          if (cs === "connected") {
            everConnected.current = true;
            setState("connected");
          } else if (cs === "failed" || cs === "disconnected")
            setState(everConnected.current ? "reconnecting" : "connecting");
        };
        await pc.setRemoteDescription(data.sdp);
        const early = earlyIce.current.get(sid) ?? [];
        earlyIce.current.delete(sid);
        for (const c of early) await pc.addIceCandidate(c).catch(() => {});
        await pc.setLocalDescription();
        await signalHost({
          sessionId,
          type: "answer",
          payload: JSON.stringify({ sid, sdp: pc.localDescription?.toJSON() }),
        });
        return;
      }
      if (type === "ice" && data.candidate) {
        const p = peer.current;
        if (p && p.sid === sid) await p.pc.addIceCandidate(data.candidate).catch(() => {});
        else {
          const list = earlyIce.current.get(sid) ?? [];
          list.push(data.candidate);
          earlyIce.current.set(sid, list);
        }
      }
    }
  }, [sessionId, signals, enqueue, closePeer, signalHost, rejoin]);

  // Nothing to show once the player stops.
  useEffect(() => {
    if (!enabled) setStream(null);
  }, [enabled]);

  return { stream, state };
}

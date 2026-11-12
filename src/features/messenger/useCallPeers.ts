import { useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * WebRTC for a Messenger call, with Convex as the signaling channel.
 *
 * One RTCPeerConnection per other person in the call (a mesh). The caller
 * creates the connection to everyone; between two callees the lower id does.
 * Every connection has a session id (`sid`) that its offers, answers and ICE
 * candidates carry, so signals from a torn-down connection are ignored.
 *
 * Connections renegotiate in place ("perfect negotiation": the side that
 * created the connection is impolite, the other side yields on glare), so an
 * audio call upgrades to video when someone turns their camera on, and a
 * screen share swaps the outgoing video track. Mic/camera/screen state travels
 * as "media" signals so the other side can swap a camera that's off for the
 * avatar.
 */

/**
 * ICE servers. Defaults to Google's public STUN, which connects most home and
 * office networks directly. Calls between strict NATs also need a TURN relay:
 * set `VITE_ICE_SERVERS` to a JSON `RTCIceServer[]`, for example
 * `[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]`.
 * (No free public TURN relay works without signing up, so none is built in.)
 */
const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

function iceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (!raw) return DEFAULT_ICE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => s && typeof s === "object" && "urls" in s))
      return parsed as RTCIceServer[];
  } catch {
    // Fall through to the default.
  }
  console.warn("VITE_ICE_SERVERS isn't a JSON RTCIceServer[]; using public STUN only.");
  return DEFAULT_ICE;
}

const ICE_SERVERS = iceServers();

export type MediaState = { mic: boolean; cam: boolean; screen: boolean };
export type RemotePeer = {
  stream: MediaStream | null;
  media: MediaState | null;
  state: RTCPeerConnectionState;
  /** Bumps when tracks are added to `stream` or start flowing. */
  version: number;
};

type Peer = {
  pc: RTCPeerConnection;
  sid: string;
  /** Yields to the other side's offer on glare. */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingIce: RTCIceCandidateInit[];
  stream: MediaStream;
};

/** Works outside secure contexts too, where `crypto.randomUUID` is missing. */
const newSid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type Signal = { _id: string; fromId: Id<"users">; type: string; payload: string };

const transceiverFor = (pc: RTCPeerConnection, kind: "audio" | "video") =>
  pc.getTransceivers().find((t) => t.direction !== "stopped" && t.receiver.track.kind === kind);

/**
 * Puts this side's current tracks on a connection. Reusing a transceiver is a
 * plain track swap; a new kind of media (the first video in an audio call)
 * adds a transceiver, which triggers renegotiation.
 */
async function syncSenders(
  pc: RTCPeerConnection,
  tracks: { audio: MediaStreamTrack | null; video: MediaStreamTrack | null },
) {
  if (pc.signalingState === "closed") return;
  for (const kind of ["audio", "video"] as const) {
    const track = tracks[kind];
    const tr = transceiverFor(pc, kind);
    if (!tr) {
      if (track) pc.addTransceiver(track, { direction: "sendrecv" });
      continue;
    }
    if (tr.sender.track !== track) await tr.sender.replaceTrack(track);
    if (track && tr.direction !== "sendrecv") tr.direction = "sendrecv";
  }
}

export function useCallPeers({
  callId,
  me,
  callerId,
  kind,
  peers,
  active,
  audio,
  video,
  localSettled,
  media,
}: {
  callId: Id<"calls">;
  me: Id<"users">;
  callerId: Id<"users">;
  kind: "audio" | "video";
  /** Everyone else currently in the call. */
  peers: Id<"users">[];
  active: boolean;
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
  localSettled: boolean;
  media: MediaState;
}) {
  const sendSignal = useM(api.calls.signal);
  const ready = active && localSettled;
  const signals = useQ(api.calls.signals, ready ? { callId } : "skip");
  const [remote, setRemote] = useState<Record<string, RemotePeer>>({});

  const peersRef = useRef(new Map<Id<"users">, Peer>());
  const handled = useRef(new Set<string>());
  const earlyIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const tracksRef = useRef({ audio, video });
  tracksRef.current = { audio, video };
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const peerKey = peers.join(",");
  const peerList = useRef(peers);
  peerList.current = peers;

  const send = useCallback(
    (toId: Id<"users">, type: "offer" | "answer" | "ice" | "media", payload: unknown) =>
      sendSignal({ callId, toId, type, payload: JSON.stringify(payload) }).catch(() => {}),
    [sendSignal, callId],
  );
  const patch = useCallback((id: string, p: Partial<RemotePeer>) => {
    setRemote((prev) => {
      const cur = prev[id] ?? { stream: null, media: null, state: "new", version: 0 };
      return { ...prev, [id]: { ...cur, ...p } };
    });
  }, []);
  const bump = useCallback((id: string) => {
    setRemote((prev) => {
      const cur = prev[id];
      return cur ? { ...prev, [id]: { ...cur, version: cur.version + 1 } } : prev;
    });
  }, []);
  /** Signaling steps run one at a time, in order. */
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch((e: unknown) => {
      console.warn("Call signaling step failed", e);
    });
  }, []);

  const closePeer = useCallback((id: Id<"users">) => {
    const p = peersRef.current.get(id);
    if (!p) return;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.onnegotiationneeded = null;
    p.pc.close();
    peersRef.current.delete(id);
  }, []);

  const createPeer = useCallback(
    (id: Id<"users">, sid: string, polite: boolean) => {
      closePeer(id);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: Peer = {
        pc,
        sid,
        polite,
        makingOffer: false,
        ignoreOffer: false,
        pendingIce: [],
        stream: new MediaStream(),
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(id, "ice", { sid, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (!peer.stream.getTrackById(e.track.id)) peer.stream.addTrack(e.track);
        // A track that was swapped in later starts muted and unmutes when frames arrive.
        e.track.onunmute = () => bump(id);
        e.track.onmute = () => bump(id);
        patch(id, { stream: peer.stream });
        bump(id);
      };
      pc.onconnectionstatechange = () => patch(id, { state: pc.connectionState });
      pc.onnegotiationneeded = () =>
        enqueue(async () => {
          if (peersRef.current.get(id) !== peer || pc.signalingState !== "stable") return;
          try {
            peer.makingOffer = true;
            await pc.setLocalDescription();
            await send(id, "offer", { sid, sdp: pc.localDescription?.toJSON() });
          } finally {
            peer.makingOffer = false;
          }
        });
      peersRef.current.set(id, peer);
      patch(id, { stream: peer.stream, state: pc.connectionState });
      void send(id, "media", mediaRef.current);
      return peer;
    },
    [closePeer, patch, bump, send, enqueue],
  );

  const flushIce = useCallback(async (peer: Peer) => {
    const early = earlyIce.current.get(peer.sid) ?? [];
    earlyIce.current.delete(peer.sid);
    for (const c of [...early, ...peer.pendingIce])
      await peer.pc.addIceCandidate(c).catch(() => {});
    peer.pendingIce = [];
  }, []);

  // Connect to the people this side is responsible for; drop people who left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: peerKey stands in for peers
  useEffect(() => {
    if (!ready) return;
    const want = new Set(peerList.current);
    for (const id of [...peersRef.current.keys()]) if (!want.has(id)) closePeer(id);
    for (const id of want) {
      if (peersRef.current.has(id)) continue;
      const iOffer = me === callerId || (id !== callerId && me < id);
      if (!iOffer) continue;
      const { pc } = createPeer(id, newSid(), false);
      const { audio: mic, video: cam } = tracksRef.current;
      // Always offer to receive audio; video calls also offer video, so a
      // camera-less caller still sees theirs. The first track added fires
      // negotiationneeded, which sends the offer.
      pc.addTransceiver(mic ?? "audio", { direction: "sendrecv" });
      if (kind === "video" || cam) pc.addTransceiver(cam ?? "video", { direction: "sendrecv" });
    }
  }, [ready, peerKey, me, callerId, kind, createPeer, closePeer]);

  // Tear everything down when the call stops (or the component unmounts).
  useEffect(() => {
    if (!ready) return;
    const map = peersRef.current;
    const seen = handled.current;
    return () => {
      for (const id of [...map.keys()]) closePeer(id);
      seen.clear();
      earlyIce.current.clear();
      setRemote({});
    };
  }, [ready, closePeer]);

  // Apply incoming signals in order.
  useEffect(() => {
    if (!ready || !signals) return;
    for (const s of signals as Signal[]) {
      if (handled.current.has(s._id)) continue;
      handled.current.add(s._id);
      enqueue(() => handleSignal(s));
    }

    async function handleSignal(s: Signal) {
      const from = s.fromId;
      const data = JSON.parse(s.payload) as {
        sid?: string;
        sdp?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
        mic?: boolean;
        cam?: boolean;
        screen?: boolean;
      };
      if (s.type === "media") {
        patch(from, {
          media: { mic: Boolean(data.mic), cam: Boolean(data.cam), screen: Boolean(data.screen) },
        });
        return;
      }
      if (!data.sid || !peerList.current.includes(from)) return;
      let peer = peersRef.current.get(from);

      if (s.type === "offer" && data.sdp) {
        // A new session replaces the connection; the same session renegotiates it.
        if (!peer || peer.sid !== data.sid) peer = createPeer(from, data.sid, true);
        const { pc } = peer;
        const collision = peer.makingOffer || pc.signalingState !== "stable";
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(data.sdp); // Rolls back our own offer on glare.
        await syncSenders(pc, tracksRef.current);
        await flushIce(peer);
        await pc.setLocalDescription();
        await send(from, "answer", { sid: data.sid, sdp: pc.localDescription?.toJSON() });
        return;
      }
      if (s.type === "answer" && data.sdp) {
        if (!peer || peer.sid !== data.sid || peer.pc.signalingState !== "have-local-offer") return;
        await peer.pc.setRemoteDescription(data.sdp);
        await flushIce(peer);
        return;
      }
      if (s.type === "ice" && data.candidate) {
        if (peer && peer.sid === data.sid) {
          if (peer.pc.remoteDescription)
            await peer.pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pendingIce.push(data.candidate);
        } else {
          const list = earlyIce.current.get(data.sid) ?? [];
          list.push(data.candidate);
          earlyIce.current.set(data.sid, list);
        }
      }
    }
  }, [ready, signals, enqueue, createPeer, flushIce, patch, send]);

  // New or swapped local tracks (camera on/off, screen share, another device).
  useEffect(() => {
    if (!ready) return;
    for (const peer of peersRef.current.values())
      enqueue(() => syncSenders(peer.pc, { audio, video }));
  }, [ready, audio, video, enqueue]);

  // Mic mute keeps the track and silences it.
  useEffect(() => {
    if (audio) audio.enabled = media.mic;
  }, [audio, media.mic]);

  // Tell everyone about mic / camera / screen changes.
  const { mic, cam, screen } = media;
  useEffect(() => {
    if (!ready) return;
    for (const id of peersRef.current.keys()) void send(id, "media", { mic, cam, screen });
  }, [mic, cam, screen, ready, send]);

  return remote;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * WebRTC for a Messenger call, with Convex as the signaling channel.
 *
 * One RTCPeerConnection per other person in the call (a mesh). The caller
 * offers to everyone; between two callees the lower id offers. Every offer
 * carries a session id (`sid`); answers and ICE candidates echo it, so
 * signals from a torn-down connection (a remount, a renegotiation) are
 * ignored. Mic/camera state travels as "media" signals so the other side can
 * swap a muted camera for the avatar.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type MediaState = { mic: boolean; cam: boolean };
export type RemotePeer = {
  stream: MediaStream | null;
  media: MediaState | null;
  state: RTCPeerConnectionState;
  /** Bumps when tracks are added to `stream`. */
  version: number;
};

type Peer = {
  pc: RTCPeerConnection;
  sid: string;
  remoteSet: boolean;
  pendingIce: RTCIceCandidateInit[];
  stream: MediaStream;
};

/** Works outside secure contexts too, where `crypto.randomUUID` is missing. */
const newSid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type Signal = { _id: string; fromId: Id<"users">; type: string; payload: string };

/** Camera + mic for the call. Falls back to mic only, then to no devices at all. */
export function useLocalMedia(kind: "audio" | "video", enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let got: MediaStream | null = null;
    const md = navigator.mediaDevices;
    const ask = async () => {
      if (!md?.getUserMedia) return null;
      if (kind === "video") {
        try {
          return await md.getUserMedia({
            audio: true,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          // No camera, or it was refused: try the mic alone.
        }
      }
      try {
        return await md.getUserMedia({ audio: true });
      } catch {
        return null;
      }
    };
    void ask().then((s) => {
      got = s;
      if (!live) {
        for (const t of s?.getTracks() ?? []) t.stop();
        return;
      }
      setStream(s);
      setSettled(true);
    });
    return () => {
      live = false;
      for (const t of got?.getTracks() ?? []) t.stop();
      setStream(null);
      setSettled(false);
    };
  }, [kind, enabled]);
  return { stream, settled };
}

export function useCallPeers({
  callId,
  me,
  callerId,
  kind,
  peers,
  active,
  local,
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
  local: MediaStream | null;
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
  const localRef = useRef(local);
  localRef.current = local;
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
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  const closePeer = useCallback((id: Id<"users">) => {
    const p = peersRef.current.get(id);
    if (!p) return;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    peersRef.current.delete(id);
  }, []);

  const createPeer = useCallback(
    (id: Id<"users">, sid: string) => {
      closePeer(id);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: Peer = { pc, sid, remoteSet: false, pendingIce: [], stream: new MediaStream() };
      const stream = localRef.current;
      if (stream) for (const t of stream.getTracks()) pc.addTrack(t, stream);
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(id, "ice", { sid, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        peer.stream.addTrack(e.track);
        setRemote((prev) => {
          const cur = prev[id] ?? {
            stream: null,
            media: null,
            state: pc.connectionState,
            version: 0,
          };
          return { ...prev, [id]: { ...cur, stream: peer.stream, version: cur.version + 1 } };
        });
      };
      pc.onconnectionstatechange = () => patch(id, { state: pc.connectionState });
      peersRef.current.set(id, peer);
      patch(id, { stream: peer.stream, state: pc.connectionState });
      void send(id, "media", mediaRef.current);
      return peer;
    },
    [closePeer, patch, send],
  );

  const flushIce = useCallback(async (peer: Peer) => {
    const early = earlyIce.current.get(peer.sid) ?? [];
    earlyIce.current.delete(peer.sid);
    for (const c of [...early, ...peer.pendingIce])
      await peer.pc.addIceCandidate(c).catch(() => {});
    peer.pendingIce = [];
  }, []);

  // Offer to the people this side is responsible for; drop people who left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: peerKey stands in for peers
  useEffect(() => {
    if (!ready) return;
    const want = new Set(peerList.current);
    for (const id of [...peersRef.current.keys()]) if (!want.has(id)) closePeer(id);
    for (const id of want) {
      if (peersRef.current.has(id)) continue;
      const iOffer = me === callerId || (id !== callerId && me < id);
      if (!iOffer) continue;
      const peer = createPeer(id, newSid());
      const stream = localRef.current;
      // Ask to receive what this side doesn't send, so a camera-less caller still sees video.
      if (!stream?.getAudioTracks().length)
        peer.pc.addTransceiver("audio", { direction: "recvonly" });
      if (kind === "video" && !stream?.getVideoTracks().length)
        peer.pc.addTransceiver("video", { direction: "recvonly" });
      enqueue(async () => {
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        await send(id, "offer", { sid: peer.sid, sdp: peer.pc.localDescription?.toJSON() });
      });
    }
  }, [ready, peerKey, me, callerId, kind, createPeer, closePeer, enqueue, send]);

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
      };
      if (s.type === "media") {
        patch(from, { media: { mic: Boolean(data.mic), cam: Boolean(data.cam) } });
        return;
      }
      if (!data.sid || !peerList.current.includes(from)) return;
      if (s.type === "offer" && data.sdp) {
        const peer = createPeer(from, data.sid);
        await peer.pc.setRemoteDescription(data.sdp);
        peer.remoteSet = true;
        await flushIce(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        await send(from, "answer", { sid: data.sid, sdp: peer.pc.localDescription?.toJSON() });
        return;
      }
      const peer = peersRef.current.get(from);
      if (s.type === "answer" && data.sdp) {
        if (!peer || peer.sid !== data.sid || peer.remoteSet) return;
        await peer.pc.setRemoteDescription(data.sdp);
        peer.remoteSet = true;
        await flushIce(peer);
        return;
      }
      if (s.type === "ice" && data.candidate) {
        if (peer && peer.sid === data.sid) {
          if (peer.remoteSet) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pendingIce.push(data.candidate);
        } else {
          const list = earlyIce.current.get(data.sid) ?? [];
          list.push(data.candidate);
          earlyIce.current.set(data.sid, list);
        }
      }
    }
  }, [ready, signals, enqueue, createPeer, flushIce, patch, send]);

  // Mic / camera toggles: mute the local tracks and tell everyone.
  const { mic, cam } = media;
  useEffect(() => {
    for (const t of local?.getAudioTracks() ?? []) t.enabled = mic;
    for (const t of local?.getVideoTracks() ?? []) t.enabled = cam;
    if (!ready) return;
    for (const id of peersRef.current.keys()) void send(id, "media", { mic, cam });
  }, [local, mic, cam, ready, send]);

  return remote;
}

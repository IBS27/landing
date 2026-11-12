import { ConvexError } from "convex/values";
import { useEffect, useSyncExternalStore } from "react";
import { useM, useQ } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CallScreen } from "./CallScreen";
import { RINGBACK, useTone } from "./callTones";
import { IncomingCalls } from "./IncomingCall";
import type { ConversationDetail } from "./util";

/**
 * Starting and receiving Messenger calls from the main Facebook tab.
 *
 * Like Facebook, a call runs in its own pop-up window (/call/<id>). If the
 * browser blocks the pop-up, the same call screen opens in an in-page dialog.
 * The tab that opened a pop-up hangs up for it if the window is closed.
 */

const POPUP_NAME = "fb-call";
const POPUP_FEATURES = "width=420,height=640";

type Kind = "audio" | "video";
type State = { modalCallId: string | null; notice: string | null; popupIds: string[] };

let state: State = { modalCallId: null, notice: null, popupIds: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};
const useCallState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

/** Pop-ups this tab opened, by call id. */
const popups = new Map<string, Window>();
let starter: ((conversationId: Id<"conversations">, kind: Kind) => Promise<Id<"calls">>) | null =
  null;

const isBlank = (w: Window) => {
  try {
    return w.location.href === "about:blank";
  } catch {
    return false;
  }
};

function errorText(e: unknown) {
  return e instanceof ConvexError && typeof e.data === "string"
    ? e.data
    : "Something went wrong. Please try again.";
}

/** Shows a call in its pop-up (opened during the click, so it isn't blocked), or in-page. */
function show(callId: string, w: Window | null) {
  if (!w || w.closed) {
    set({ modalCallId: callId });
    return;
  }
  const path = `/call/${callId}`;
  if (w.location.pathname !== path) w.location.replace(path);
  popups.set(callId, w);
  set({ popupIds: [...popups.keys()] });
  w.focus();
}

/** Voice / video call buttons hide for chats that can't be called. */
export function canCall(c: Pick<ConversationDetail, "others">) {
  return c.others.length > 0;
}

/** Call everyone else in a chat. Must run inside the click handler so the pop-up is allowed. */
export function startCall(target: Pick<ConversationDetail, "_id">, kind: Kind) {
  const start = starter;
  if (!start) return;
  // Reuses the call window when one is already open (without navigating it).
  const w = window.open("", POPUP_NAME, POPUP_FEATURES);
  const fresh = !!w && isBlank(w);
  start(target._id, kind)
    .then((id) => show(id, w))
    .catch((e: unknown) => {
      if (w && fresh) w.close();
      else w?.focus();
      set({ notice: errorText(e) });
    });
}

/** Answer from the incoming-call card. */
function answerCall(callId: Id<"calls">) {
  show(callId, window.open(`/call/${callId}`, POPUP_NAME, POPUP_FEATURES));
}

/**
 * Mounted once per page (by the chat dock, or the Messenger page which
 * replaces it): incoming-call cards, the blocked-pop-up fallback dialog, and
 * the pop-up watcher.
 */
export function CallLayer() {
  const { modalCallId, notice, popupIds } = useCallState();
  const start = useM(api.calls.start);
  const leave = useM(api.calls.leave);

  useEffect(() => {
    const fn = (conversationId: Id<"conversations">, kind: Kind) => start({ conversationId, kind });
    starter = fn;
    return () => {
      if (starter === fn) starter = null;
    };
  }, [start]);

  // A pop-up closed with the window's own X button hangs up.
  useEffect(() => {
    const t = setInterval(() => {
      for (const [id, w] of popups)
        if (w.closed) {
          popups.delete(id);
          set({ popupIds: [...popups.keys()] });
          void leave({ callId: id as Id<"calls"> }).catch(() => {});
        }
    }, 1000);
    return () => clearInterval(t);
  }, [leave]);

  return (
    <>
      <IncomingCalls onAnswer={answerCall} />
      {popupIds.map((id) => (
        <OpenerRingback key={id} callId={id} />
      ))}
      {modalCallId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
          <CallScreen
            key={modalCallId}
            callId={modalCallId}
            variant="modal"
            onClose={() => set({ modalCallId: null })}
            onCallAgain={(conversationId, kind) =>
              void start({ conversationId, kind })
                .then((id) => set({ modalCallId: id }))
                .catch((e: unknown) => set({ notice: errorText(e) }))
            }
          />
        </div>
      )}
      <Modal
        open={!!notice}
        onOpenChange={(o) => !o && set({ notice: null })}
        title="Can't start call"
      >
        <div className="p-4">
          <p className="text-[15px] text-primary leading-5">{notice}</p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => set({ notice: null })}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * A fresh pop-up has had no click yet, so browsers keep it silent: the tab
 * that placed the call plays the ringback instead.
 */
function OpenerRingback({ callId }: { callId: string }) {
  const call = useQ(api.calls.get, { callId });
  useTone(RINGBACK, call?.status === "ringing" && call.role === "caller");
  return null;
}

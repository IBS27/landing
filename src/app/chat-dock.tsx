import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useViewerContext } from "./viewer";

/** Facebook shows up to three open chat windows; older ones collapse to bubbles. */
const MAX_OPEN = 3;
/** Bubbles stacked above the "New message" button. */
const MAX_BUBBLES = 6;

type ConversationId = Id<"conversations">;

type ChatDockState = {
  /** Open windows, rightmost first. */
  open: ConversationId[];
  /** Minimized chats shown as bubbles, newest first. */
  minimized: ConversationId[];
  /** The window that most recently got attention (its header turns blue). */
  focused: ConversationId | null;
  openChat: (id: ConversationId) => void;
  closeChat: (id: ConversationId) => void;
  minimizeChat: (id: ConversationId) => void;
  focusChat: (id: ConversationId | null) => void;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
};

type Persisted = { open: ConversationId[]; minimized: ConversationId[] };

const ChatDockContext = createContext<ChatDockState | null>(null);

const storageKey = (viewerId: string) => `fb-clone:chat-dock:${viewerId}`;

function load(viewerId: string | null): Persisted {
  if (!viewerId) return { open: [], minimized: [] };
  try {
    const raw = localStorage.getItem(storageKey(viewerId));
    if (!raw) return { open: [], minimized: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      open: Array.isArray(parsed.open) ? parsed.open.slice(0, MAX_OPEN) : [],
      minimized: Array.isArray(parsed.minimized) ? parsed.minimized.slice(0, MAX_BUBBLES) : [],
    };
  } catch {
    return { open: [], minimized: [] };
  }
}

/** Chat windows persist per persona across reloads, like Facebook's dock. */
export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { viewerId } = useViewerContext();
  const [owner, setOwner] = useState<string | null>(viewerId);
  const [state, setState] = useState<Persisted>(() => load(viewerId));
  const [focused, setFocused] = useState<ConversationId | null>(null);
  const [composerOpen, setComposerOpenState] = useState(false);

  // Switching persona swaps in that persona's dock.
  if (owner !== viewerId) {
    setOwner(viewerId);
    setState(load(viewerId));
    setFocused(null);
    setComposerOpenState(false);
  }

  useEffect(() => {
    if (!viewerId) return;
    try {
      localStorage.setItem(storageKey(viewerId), JSON.stringify(state));
    } catch {
      // Storage unavailable: the dock simply won't survive a reload.
    }
  }, [state, viewerId]);

  const openChat = useCallback((id: ConversationId) => {
    setState(({ open, minimized }) => {
      const next = [id, ...open.filter((x) => x !== id)];
      const overflow = next.slice(MAX_OPEN);
      return {
        open: next.slice(0, MAX_OPEN),
        minimized: [
          ...overflow,
          ...minimized.filter((x) => x !== id && !overflow.includes(x)),
        ].slice(0, MAX_BUBBLES),
      };
    });
    setFocused(id);
    setComposerOpenState(false);
  }, []);

  const closeChat = useCallback((id: ConversationId) => {
    setState(({ open, minimized }) => ({
      open: open.filter((x) => x !== id),
      minimized: minimized.filter((x) => x !== id),
    }));
    setFocused((f) => (f === id ? null : f));
  }, []);

  const minimizeChat = useCallback((id: ConversationId) => {
    setState(({ open, minimized }) => ({
      open: open.filter((x) => x !== id),
      minimized: [id, ...minimized.filter((x) => x !== id)].slice(0, MAX_BUBBLES),
    }));
    setFocused((f) => (f === id ? null : f));
  }, []);

  const setComposerOpen = useCallback((o: boolean) => {
    setComposerOpenState(o);
    if (o) {
      // The composer takes a window slot.
      setState(({ open, minimized }) => {
        if (open.length < MAX_OPEN) return { open, minimized };
        const overflow = open.slice(MAX_OPEN - 1);
        return {
          open: open.slice(0, MAX_OPEN - 1),
          minimized: [...overflow, ...minimized.filter((x) => !overflow.includes(x))].slice(
            0,
            MAX_BUBBLES,
          ),
        };
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      open: state.open,
      minimized: state.minimized,
      focused,
      openChat,
      closeChat,
      minimizeChat,
      focusChat: setFocused,
      composerOpen,
      setComposerOpen,
    }),
    [state, focused, openChat, closeChat, minimizeChat, composerOpen, setComposerOpen],
  );
  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used inside ChatDockProvider");
  return ctx;
}

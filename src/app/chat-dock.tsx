import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

/** Facebook shows up to three open chat windows; older ones collapse to bubbles. */
const MAX_OPEN = 3;

type ChatDockState = {
  open: Id<"conversations">[];
  minimized: Id<"conversations">[];
  openChat: (id: Id<"conversations">) => void;
  closeChat: (id: Id<"conversations">) => void;
  minimizeChat: (id: Id<"conversations">) => void;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
};

const ChatDockContext = createContext<ChatDockState | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Id<"conversations">[]>([]);
  const [minimized, setMinimized] = useState<Id<"conversations">[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);

  const openChat = useCallback((id: Id<"conversations">) => {
    setMinimized((m) => m.filter((x) => x !== id));
    setOpen((o) => {
      const rest = o.filter((x) => x !== id);
      const next = [id, ...rest];
      if (next.length > MAX_OPEN) {
        const overflow = next.slice(MAX_OPEN);
        setMinimized((m) => [...overflow, ...m.filter((x) => !overflow.includes(x))]);
      }
      return next.slice(0, MAX_OPEN);
    });
    setComposerOpen(false);
  }, []);

  const closeChat = useCallback((id: Id<"conversations">) => {
    setOpen((o) => o.filter((x) => x !== id));
    setMinimized((m) => m.filter((x) => x !== id));
  }, []);

  const minimizeChat = useCallback((id: Id<"conversations">) => {
    setOpen((o) => o.filter((x) => x !== id));
    setMinimized((m) => [id, ...m.filter((x) => x !== id)]);
  }, []);

  const value = useMemo(
    () => ({ open, minimized, openChat, closeChat, minimizeChat, composerOpen, setComposerOpen }),
    [open, minimized, openChat, closeChat, minimizeChat, composerOpen],
  );
  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used inside ChatDockProvider");
  return ctx;
}

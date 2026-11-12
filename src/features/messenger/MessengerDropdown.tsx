import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useQ } from "@/app/viewer";
import { MessengerIcon } from "@/icons";
import { HeaderButton } from "@/layout/HeaderButton";
import { PopoverPanel, Tooltip } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import { ConversationList, type Filter, FilterChips, SearchMessenger } from "./ConversationList";
import { InboxMenu } from "./InboxMenu";
import { ComposeIcon, ExpandIcon } from "./icons";
import { PinGatePanel, usePinPrompt } from "./PinGate";

/** Header Messenger button: unread badge and the "Chats" panel. */
export function MessengerDropdown() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const unread = useQ(api.messenger.unreadCount, {}) ?? 0;
  const pinPrompt = usePinPrompt();

  // Facebook drops the Messenger button while you're on the Messenger page.
  if (path.startsWith("/messages")) return null;

  return (
    <PopoverPanel
      // Header panels share one right edge (16px from the window), not the button's.
      alignOffset={-96}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      trigger={
        <HeaderButton label="Messenger" active={open} count={unread}>
          <MessengerIcon size={20} />
        </HeaderButton>
      }
    >
      {pinPrompt ? (
        <PinGatePanel />
      ) : (
        <ChatsPanel
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          close={() => setOpen(false)}
        />
      )}
    </PopoverPanel>
  );
}

function ChatsPanel({
  filter,
  setFilter,
  query,
  setQuery,
  close,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  close: () => void;
}) {
  const dock = useChatDock();
  return (
    <>
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-2">
        <div className="flex h-9 items-center">
          <h1 className="flex-1 font-bold text-[24px] text-primary leading-7">Chats</h1>
          <div className="flex items-center gap-1">
            <InboxMenu size={32} ghost onNavigate={close} />
            <Tooltip content="See all in Messenger">
              <Link
                to="/messages"
                aria-label="See all in Messenger"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
              >
                <ExpandIcon size={20} />
              </Link>
            </Tooltip>
            <Tooltip content="New message">
              <button
                type="button"
                aria-label="New message"
                onClick={() => {
                  close();
                  dock.setComposerOpen(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
              >
                <ComposeIcon size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
        <SearchMessenger value={query} onChange={setQuery} autoFocus />
        <FilterChips value={filter} onChange={setFilter} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-1">
        <ConversationList
          filter={filter}
          query={query}
          onSelect={(id) => {
            close();
            setQuery("");
            dock.openChat(id);
          }}
        />
      </div>
      <div className="shrink-0 border-divider border-t py-3 text-center">
        <Link
          to="/messages"
          onClick={close}
          className="font-medium text-[15px] text-link hover:underline"
        >
          See all in Messenger
        </Link>
      </div>
    </>
  );
}

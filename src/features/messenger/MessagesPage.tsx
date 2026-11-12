import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CallLayer, canCall, startCall } from "./CallWindow";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationList, type Filter, FilterChips, SearchMessenger } from "./ConversationList";
import { type Folder, InboxMenu } from "./InboxMenu";
import { InfoPanel } from "./InfoPanel";
import { ComposeIcon, InfoIcon, NoChatsIllustration, PhoneIcon, VideoCallIcon } from "./icons";
import { NewMessage } from "./NewMessage";
import { PinDialog } from "./PinGate";
import { Thread } from "./Thread";
import { activeLabel, type ConversationDetail } from "./util";

const FOLDER_TITLES: Record<Folder, string> = {
  archived: "Archived chats",
  requests: "Message requests",
  restricted: "Restricted accounts",
};

/** Full-page Messenger frame: 360px chat list on the left, a card for the thread. */
function MessagesLayout({
  folder,
  activeId,
  draft,
  children,
}: {
  folder?: Folder;
  activeId?: Id<"conversations">;
  draft?: boolean;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <nav
        aria-label="Thread list"
        className="flex w-[360px] shrink-0 flex-col bg-card shadow-[inset_-1px_0_0_0_var(--shadow-1)] dark:shadow-[inset_-1px_0_0_0_var(--divider)]"
      >
        <div className="shrink-0 px-4 pt-[11px]">
          {folder ? (
            <div className="flex h-9 items-center gap-2">
              <Link
                to="/messages"
                aria-label="Back"
                className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-icon hover:bg-hover"
              >
                <ArrowLeft size={20} strokeWidth={2.4} />
              </Link>
              <h1 className="font-bold text-[20px] text-primary leading-6">
                {FOLDER_TITLES[folder]}
              </h1>
            </div>
          ) : (
            <div className="flex h-9 items-center">
              <h1 className="flex-1 pt-1">
                <Link to="/messages" className="font-bold text-[24px] text-primary leading-7">
                  Chats
                </Link>
              </h1>
              <div className="flex items-center gap-3">
                <InboxMenu />
                <Tooltip content="New message">
                  <Link
                    to="/messages/new"
                    aria-label="New message"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
                  >
                    <ComposeIcon size={20} />
                  </Link>
                </Tooltip>
              </div>
            </div>
          )}
          <div className="mt-[14px]">
            <SearchMessenger value={query} onChange={setQuery} />
          </div>
          {!folder && (
            <div className="mt-5">
              <FilterChips value={filter} onChange={setFilter} />
            </div>
          )}
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-2">
          <ConversationList
            link
            folder={folder}
            filter={folder ? "all" : filter}
            query={query}
            activeId={activeId}
            leading={
              draft ? (
                <div className="flex h-[72px] items-center gap-3 rounded-lg bg-highlight p-2">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-btn">
                    <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden>
                      <circle cx="28" cy="22" r="10" fill="var(--disabled-icon)" />
                      <path d="M8 52c2-11 10-16 20-16s18 5 20 16" fill="var(--disabled-icon)" />
                    </svg>
                  </span>
                  <span className="flex-1 font-medium text-[15px] text-primary">New message</span>
                  <Tooltip content="Delete message draft">
                    <button
                      type="button"
                      aria-label="Delete message draft"
                      onClick={() => void navigate({ to: "/messages" })}
                      className="mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-btn text-icon"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </Tooltip>
                </div>
              ) : undefined
            }
          />
        </div>
      </nav>
      <main className="min-w-0 flex-1 bg-wash p-4">
        <div className="flex h-full overflow-hidden rounded-lg bg-card shadow-base">{children}</div>
      </main>
      <PinDialog />
      <CallLayer />
    </div>
  );
}

function NoChatSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-8">
      <NoChatsIllustration />
      <p className="mt-10 font-bold text-[20px] text-primary leading-6">No chats selected</p>
    </div>
  );
}

/** /messages: jumps to the most recent chat, or shows a folder. */
export function MessagesIndexPage({ folder }: { folder?: Folder }) {
  const convs = useQ(api.messenger.list, folder ? "skip" : { limit: 1 });
  const navigate = useNavigate();
  const first = convs?.[0]?._id;
  useEffect(() => {
    if (first)
      void navigate({
        to: "/messages/t/$conversationId",
        params: { conversationId: first },
        replace: true,
      });
  }, [first, navigate]);
  return (
    <MessagesLayout folder={folder}>
      {!folder && (convs === undefined || first) ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <NoChatSelected />
      )}
    </MessagesLayout>
  );
}

/** /messages/new: "To:" picker; the thread opens at its own URL once it exists. */
export function NewMessagePage() {
  const navigate = useNavigate();
  return (
    <MessagesLayout draft>
      <div className="flex min-w-0 flex-1 flex-col">
        <NewMessage
          variant="page"
          onConversation={(id) =>
            void navigate({ to: "/messages/t/$conversationId", params: { conversationId: id } })
          }
        />
      </div>
    </MessagesLayout>
  );
}

/** /messages/t/$conversationId: thread with header, composer and the info panel. */
export function ConversationPage({ conversationId }: { conversationId: Id<"conversations"> }) {
  const detail = useQ(api.messenger.get, { conversationId });
  const [info, setInfo] = useState(true);
  return (
    <MessagesLayout activeId={conversationId}>
      {detail === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : detail === null ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-bold text-[20px] text-primary">This chat isn't available</p>
          <p className="mt-1 text-[15px] text-secondary">
            It may have been deleted, or you're no longer a member.
          </p>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <ThreadHeader c={detail} info={info} onToggleInfo={() => setInfo((v) => !v)} />
            <Thread key={detail._id} detail={detail} variant="page" active autoFocus />
          </div>
          {info && <InfoPanel key={detail._id} c={detail} />}
        </>
      )}
    </MessagesLayout>
  );
}

function ThreadHeader({
  c,
  info,
  onToggleInfo,
}: {
  c: ConversationDetail;
  info: boolean;
  onToggleInfo: () => void;
}) {
  const sub =
    c.kind === "marketplace" ? (c.others[0]?.name ?? null) : activeLabel(c.online, c.lastActiveAt);
  const person = c.kind === "dm" ? c.others[0] : undefined;
  const title = (
    <>
      <ConversationAvatar
        kind={c.kind}
        photo={c.photo}
        others={c.others}
        online={c.kind !== "marketplace" && c.online}
        size={40}
      />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[17px] text-primary leading-[22px]">
          {c.name}
        </span>
        {sub && <span className="block truncate text-[13px] text-secondary leading-4">{sub}</span>}
      </span>
    </>
  );
  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-divider border-b px-3">
      {person ? (
        <Link
          to="/$username"
          params={{ username: person.username }}
          className="flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 hover:bg-hover"
        >
          {title}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-2.5 p-1.5">{title}</div>
      )}
      <div className="flex-1" />
      {canCall(c) && (
        <>
          <HeaderIcon label="Start a voice call" onClick={() => startCall(c, "audio")}>
            <PhoneIcon size={20} />
          </HeaderIcon>
          <HeaderIcon label="Start a video call" onClick={() => startCall(c, "video")}>
            <VideoCallIcon size={22} />
          </HeaderIcon>
        </>
      )}
      <HeaderIcon label="Conversation information" active={info} onClick={onToggleInfo}>
        <InfoIcon size={22} />
      </HeaderIcon>
    </div>
  );
}

function HeaderIcon({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-fb transition-colors hover:bg-hover",
          active && "bg-highlight",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

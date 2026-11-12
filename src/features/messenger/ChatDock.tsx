import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/ui/overlays";
import { CountBadge, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConversationAvatar } from "./ConversationAvatar";
import { CloseIcon, ComposeIcon, MinimizeIcon, PhoneIcon, VideoCallIcon } from "./icons";
import { NewMessage } from "./NewMessage";
import { Thread } from "./Thread";
import { activeLabel, type ConversationDetail } from "./util";

const WINDOW_W = 328;
const WINDOW_H = 455;
const GAP = 10;
/** Windows sit left of the 48px bubble column (16px margin + 48 + 16). */
const RIGHT = 80;

/** Bottom-right Messenger dock: chat windows, minimized bubbles, "New message" button. */
export function ChatDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const dock = useChatDock();
  const { focusChat } = dock;
  const windowsRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere outside the chat windows blurs them (unread headers turn blue again).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (windowsRef.current?.contains(t)) return;
      if ((t as Element).closest?.("[data-radix-popper-content-wrapper],[role=dialog]")) return;
      focusChat(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [focusChat]);

  // The Messenger page replaces the dock.
  if (path.startsWith("/messages")) return null;
  // Facebook drops the floating "New message" button on Reels, listing pages and the listing
  // forms (it stays on the /marketplace/create type picker).
  const showCompose =
    !path.startsWith("/reel") &&
    !path.startsWith("/marketplace/item/") &&
    !/^\/marketplace\/create\/./.test(path);

  const slots: ({ kind: "composer" } | { kind: "chat"; id: Id<"conversations"> })[] = [
    ...(dock.composerOpen ? [{ kind: "composer" as const }] : []),
    ...dock.open.map((id) => ({ kind: "chat" as const, id })),
  ];

  return (
    <>
      <div ref={windowsRef}>
        {slots.map((s, i) => (
          <div
            key={s.kind === "chat" ? s.id : "composer"}
            className="fixed bottom-0 z-30 flex flex-col overflow-hidden rounded-t-lg bg-card shadow-[0_12px_28px_0_var(--shadow-2),0_2px_4px_0_var(--shadow-2)] dark:shadow-[0_12px_28px_0_var(--shadow-2),0_2px_4px_0_var(--shadow-2),0_0_0_1px_var(--divider)]"
            style={{ width: WINDOW_W, height: WINDOW_H, right: RIGHT + i * (WINDOW_W + GAP) }}
          >
            {s.kind === "chat" ? (
              <ChatWindow id={s.id} />
            ) : (
              <ComposerWindow onClose={() => dock.setComposerOpen(false)} />
            )}
          </div>
        ))}
      </div>
      <div className="fixed right-4 bottom-4 z-30 flex flex-col-reverse items-center gap-2.5">
        {showCompose && (
          <Tooltip content="New message" side="left">
            <button
              type="button"
              aria-label="New message"
              onClick={() => dock.setComposerOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-btn-floating text-icon shadow-[0_2px_4px_var(--shadow-1),0_12px_28px_var(--shadow-2)] transition-[filter] hover:brightness-95 dark:hover:brightness-125"
            >
              <ComposeIcon size={20} />
            </button>
          </Tooltip>
        )}
        {dock.minimized.map((id) => (
          <Bubble key={id} id={id} />
        ))}
      </div>
    </>
  );
}

function Bubble({ id }: { id: Id<"conversations"> }) {
  const { openChat, closeChat } = useChatDock();
  const c = useQ(api.messenger.get, { conversationId: id });
  useEffect(() => {
    if (c === null) closeChat(id);
  }, [c, id, closeChat]);
  if (!c) return null;
  return (
    <div className="group/bubble relative">
      <Tooltip
        side="left"
        content={
          <span className="block max-w-[220px]">
            <span className="block font-semibold">{c.name}</span>
            {c.preview && <span className="block truncate">{c.preview.text}</span>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={`Open chat with ${c.name}`}
          onClick={() => openChat(id)}
          className="relative block rounded-full shadow-[0_2px_4px_var(--shadow-1),0_12px_28px_var(--shadow-2)]"
        >
          <ConversationAvatar
            kind={c.kind}
            photo={c.photo}
            others={c.others}
            online={c.kind !== "marketplace" && c.online}
            size={48}
          />
        </button>
      </Tooltip>
      {c.unread && (
        <CountBadge count={1} className="pointer-events-none absolute -top-1 -right-1" />
      )}
      <button
        type="button"
        aria-label="Close chat"
        onClick={() => closeChat(id)}
        className="absolute -top-1 -left-1 hidden h-5 w-5 items-center justify-center rounded-full bg-card text-icon-secondary shadow-[0_0_0_1px_var(--shadow-1),0_2px_4px_var(--shadow-2)] group-hover/bubble:flex"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

function HeaderButton({
  label,
  onClick,
  children,
  tone,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  tone: string;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-hover",
          tone,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ChatWindow({ id }: { id: Id<"conversations"> }) {
  const { closeChat, minimizeChat, focusChat, focused } = useChatDock();
  const c = useQ(api.messenger.get, { conversationId: id });
  const isFocused = focused === id;
  useEffect(() => {
    if (c === null) closeChat(id);
  }, [c, id, closeChat]);

  const unreadTint = !!c?.unread && !isFocused;
  const tone = unreadTint ? "text-fb" : "text-fb";

  return (
    <div
      className="flex h-full flex-col"
      onPointerDownCapture={() => {
        if (!isFocused) focusChat(id);
      }}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-0.5 pr-1 pl-1 shadow-[0_1px_2px_var(--shadow-1)]",
          unreadTint && "bg-fb",
        )}
      >
        {c ? (
          <ChatTitle c={c} tint={unreadTint} />
        ) : (
          <div className="flex-1 px-2">
            <span className="block h-3 w-28 animate-pulse rounded bg-btn" />
          </div>
        )}
        <div className={cn("flex items-center", unreadTint && "[&_button]:text-white")}>
          <HeaderButton label="Start a voice call" tone={tone}>
            <PhoneIcon size={18} />
          </HeaderButton>
          <HeaderButton label="Start a video call" tone={tone}>
            <VideoCallIcon size={20} />
          </HeaderButton>
          <HeaderButton label="Minimize chat" tone={tone} onClick={() => minimizeChat(id)}>
            <MinimizeIcon size={20} />
          </HeaderButton>
          <HeaderButton label="Close chat" tone={tone} onClick={() => closeChat(id)}>
            <CloseIcon size={20} />
          </HeaderButton>
        </div>
      </div>
      {c ? (
        <>
          {c.kind === "marketplace" && c.listing && <ListingStrip c={c} />}
          <Thread detail={c} variant="dock" active={isFocused} autoFocus={isFocused} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}

function ChatTitle({ c, tint }: { c: ConversationDetail; tint: boolean }) {
  const navigate = useNavigate();
  const setMuted = useM(api.messenger.setMuted);
  const { closeChat } = useChatDock();
  const sub =
    c.kind === "marketplace" ? (c.others[0]?.name ?? null) : activeLabel(c.online, c.lastActiveAt);
  const person = c.kind !== "group" ? c.others[0] : undefined;
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 pl-1 text-left transition-colors",
            tint ? "hover:bg-white/10" : "hover:bg-hover",
          )}
        >
          <ConversationAvatar
            kind={c.kind}
            photo={c.photo}
            others={c.others}
            online={c.kind !== "marketplace" && c.online}
            size={32}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-0.5">
              <span
                className={cn(
                  "truncate font-semibold text-[15px] leading-5",
                  tint ? "text-white" : "text-primary",
                )}
              >
                {c.name}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={3}
                className={cn("shrink-0", tint ? "text-white" : "text-fb")}
              />
            </span>
            {sub && (
              <span
                className={cn(
                  "block truncate text-[12px] leading-4",
                  tint ? "text-white/90" : "text-secondary",
                )}
              >
                {sub}
              </span>
            )}
          </span>
        </button>
      </MenuTrigger>
      <MenuContent width={300} align="start">
        <MenuItem
          label="Open in Messenger"
          onSelect={() => {
            closeChat(c._id);
            void navigate({
              to: "/messages/t/$conversationId",
              params: { conversationId: c._id },
            });
          }}
        />
        {person && (
          <MenuItem
            label="View profile"
            onSelect={() =>
              void navigate({ to: "/$username", params: { username: person.username } })
            }
          />
        )}
        <MenuSeparator />
        <MenuItem
          label={c.muted ? "Unmute conversation" : "Mute conversation"}
          onSelect={() => void setMuted({ conversationId: c._id, muted: !c.muted })}
        />
      </MenuContent>
    </Menu>
  );
}

function ListingStrip({ c }: { c: ConversationDetail }) {
  const l = c.listing;
  if (!l) return null;
  return (
    <Link
      to="/marketplace/item/$listingId"
      params={{ listingId: l._id }}
      className="flex shrink-0 items-center gap-2 border-divider border-b px-3 py-2 hover:bg-hover"
    >
      {l.photo && <img src={l.photo} alt="" className="h-9 w-9 rounded-md object-cover" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[13px] text-primary">{l.title}</span>
        <span className="block truncate text-[12px] text-secondary">
          {l.price === 0 ? "Free" : `$${l.price.toLocaleString("en-US")}`}
          {l.status !== "active" && ` · ${l.status === "sold" ? "Sold" : "Pending"}`}
        </span>
      </span>
    </Link>
  );
}

function ComposerWindow({ onClose }: { onClose: () => void }) {
  const { openChat } = useChatDock();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center pr-1 pl-4">
        <span className="flex-1 font-medium text-[15px] text-primary">New message</span>
        <Tooltip content="Close tab" side="top">
          <button
            type="button"
            aria-label="Close tab"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#A033FF] hover:bg-hover dark:text-[#C77DFF]"
          >
            <CloseIcon size={20} />
          </button>
        </Tooltip>
      </div>
      <NewMessage variant="dock" onConversation={(id) => openChat(id)} />
    </div>
  );
}

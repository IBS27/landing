import { Link } from "@tanstack/react-router";
import { Popover as P, Tooltip as T } from "radix-ui";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { StoryReplyAttachment } from "@/features/feed/StoryReplyAttachment";
import { useViewerPaginated } from "@/features/posts";
import { cn, price } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal, Tooltip } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { MESSAGE_REPORT_REASONS, ReportDialog } from "@/ui/ReportDialog";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatCallDuration } from "../../../convex/lib/callFormat";
import { startCall } from "./CallWindow";
import { ConversationAvatar } from "./ConversationAvatar";
import {
  DotsVerticalIcon,
  PhoneIcon,
  ReplyIcon,
  SentIcon,
  SmileOutlineIcon,
  ThumbIcon,
  VideoCallIcon,
} from "./icons";
import {
  type ConversationDetail,
  isBigEmoji,
  MESSAGE_REACTIONS,
  type Member,
  type Message,
  reactionEmoji,
  SEPARATOR_GAP,
  separatorTime,
} from "./util";

type Variant = "dock" | "page";

const TYPING_KEYFRAMES =
  "@keyframes typing-dot{0%,60%,100%{opacity:.45;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}";
type Pos = "single" | "first" | "middle" | "last";

type Item =
  | { kind: "sep"; key: string; ts: number }
  | {
      kind: "msg";
      key: string;
      m: Message;
      pos: Pos;
      showAvatar: boolean;
      showName: boolean;
      readers: Member[];
    };

const isCall = (m: Message) => m.attachments.some((a) => a.kind === "call");

/** Chronological render items with time separators, bubble grouping and read receipts. */
function buildItems(messages: Message[], members: Member[], viewerId: Id<"users">): Item[] {
  const items: Item[] = [];
  const readersAt = new Map<Id<"messages">, Member[]>();
  for (const mem of members) {
    if (mem._id === viewerId) continue;
    let last: Message | undefined;
    for (const m of messages) if (m.status === "sent" && m.createdAt <= mem.lastReadAt) last = m;
    if (last && last.senderId !== mem._id)
      readersAt.set(last._id, [...(readersAt.get(last._id) ?? []), mem]);
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sepBefore = !prev || m.createdAt - prev.createdAt > SEPARATOR_GAP;
    const sepAfter = !next || next.createdAt - m.createdAt > SEPARATOR_GAP;
    if (sepBefore) items.push({ kind: "sep", key: `sep-${m._id}`, ts: m.createdAt });
    // Call logs stand alone, like Facebook's call cards.
    const joinsPrev =
      !sepBefore && prev.senderId === m.senderId && !m.replyTo && !isCall(m) && !isCall(prev);
    const joinsNext =
      !sepAfter && next.senderId === m.senderId && !next.replyTo && !isCall(m) && !isCall(next);
    const pos: Pos = joinsPrev ? (joinsNext ? "middle" : "last") : joinsNext ? "first" : "single";
    items.push({
      kind: "msg",
      key: m._id,
      m,
      pos,
      showAvatar: m.senderId !== viewerId && !joinsNext,
      showName: m.senderId !== viewerId && !joinsPrev,
      readers: readersAt.get(m._id) ?? [],
    });
  }
  return items;
}

/** 18px bubbles; the corners facing the sender's side tighten inside a run. */
function radius(pos: Pos, mine: boolean) {
  const tight = 4;
  const top = pos === "middle" || pos === "last" ? tight : 18;
  const bottom = pos === "middle" || pos === "first" ? tight : 18;
  return mine ? `18px ${top}px ${bottom}px 18px` : `${top}px 18px 18px ${bottom}px`;
}

export function MessageList({
  conversationId,
  detail,
  variant,
  onReply,
}: {
  conversationId: Id<"conversations">;
  detail: ConversationDetail;
  variant: Variant;
  onReply: (m: Message) => void;
}) {
  const viewer = useViewer();
  const { results, status, loadMore } = useViewerPaginated(
    api.messenger.messages,
    { conversationId },
    30,
  );
  const typing = useQ(api.messenger.typing, { conversationId });
  const [now, setNow] = useState(() => Date.now());
  const active = (typing ?? []).filter((t) => t.until > now);
  useEffect(() => {
    if (!typing?.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [typing]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && status === "CanLoadMore") loadMore(30);
      },
      { root, rootMargin: "300px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore]);

  // New messages keep the view pinned to the bottom when it already was.
  const newest = results[0]?._id;
  useEffect(() => {
    const root = scrollRef.current;
    if (root && newest && root.scrollTop > -120) root.scrollTop = 0;
  }, [newest]);

  const memberMap = new Map(detail.members.map((m) => [m._id, m]));
  const chronological = [...results].reverse();
  const items = buildItems(chronological, detail.members, viewer._id);
  const lastMine = [...chronological].reverse().find((m) => m.senderId === viewer._id);
  const isGroup = detail.kind === "group";
  const avatarSize = 28;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overflow-x-hidden",
        variant === "dock" ? "px-2 pt-2" : "px-4 pt-4",
      )}
    >
      <div className="flex flex-col pb-2">
        {status === "Exhausted" && <ThreadIntro detail={detail} variant={variant} />}
        {status === "LoadingMore" || status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-3">
            <Spinner size={20} />
          </div>
        ) : null}
        {items.map((it) =>
          it.kind === "sep" ? (
            <div
              key={it.key}
              className="px-4 pt-4 pb-2.5 text-center font-medium text-[12px] text-secondary leading-4"
            >
              {separatorTime(it.ts)}
            </div>
          ) : (
            <Fragment key={it.key}>
              <MessageRow
                m={it.m}
                pos={it.pos}
                mine={it.m.senderId === viewer._id}
                viewerId={viewer._id}
                sender={memberMap.get(it.m.senderId)}
                members={memberMap}
                showAvatar={it.showAvatar}
                showName={isGroup && it.showName}
                avatarSize={avatarSize}
                variant={variant}
                onReply={onReply}
                onCall={(media) => startCall(detail, media)}
              />
              {it.readers.length > 0 ? (
                <div className="flex justify-end gap-0.5 pt-0.5 pr-0.5 pb-1">
                  {it.readers.slice(0, 8).map((r) => (
                    <Tooltip key={r._id} content={`Seen by ${r.name}`} side="left">
                      <img
                        src={r.avatar}
                        alt=""
                        className="h-3.5 w-3.5 rounded-full object-cover"
                      />
                    </Tooltip>
                  ))}
                </div>
              ) : (
                it.m._id === lastMine?._id &&
                it.m._id === chronological[chronological.length - 1]?._id &&
                it.m.status === "sent" && (
                  <div className="flex justify-end pt-0.5 pr-0.5 pb-1 text-icon-secondary">
                    <Tooltip content="Sent" side="left">
                      <span>
                        <SentIcon size={14} />
                      </span>
                    </Tooltip>
                  </div>
                )
              )}
            </Fragment>
          ),
        )}
        {active.length > 0 && <style>{TYPING_KEYFRAMES}</style>}
        {active.map((t) => (
          <div key={t.user._id} className="mt-1 flex items-end gap-2">
            <Avatar src={t.user.avatar} size={avatarSize} />
            <div className="flex h-9 items-center gap-1 rounded-[18px] bg-chat-in px-3.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-[typing-dot_1.2s_ease-in-out_infinite] rounded-full bg-icon-secondary"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={topRef} className="h-px shrink-0" />
    </div>
  );
}

function ThreadIntro({ detail, variant }: { detail: ConversationDetail; variant: Variant }) {
  const person = detail.kind === "dm" ? detail.others[0] : undefined;
  const size = variant === "dock" ? 60 : 72;
  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-4 text-center">
      <ConversationAvatar
        kind={detail.kind}
        photo={detail.photo}
        others={detail.others}
        size={size}
      />
      <p className="mt-2 font-semibold text-[17px] text-primary leading-5">{detail.name}</p>
      <p className="mt-0.5 text-[13px] text-secondary leading-4">
        {detail.kind === "group"
          ? `${detail.memberCount} members`
          : detail.kind === "marketplace" && detail.listing
            ? `${price(detail.listing.price)} · ${detail.listing.city}`
            : "Facebook"}
      </p>
      {detail.kind === "dm" && (
        <p className="text-[13px] text-secondary leading-4">You're friends on Facebook</p>
      )}
      {person && (
        <Link
          to="/$username"
          params={{ username: person.username }}
          className="mt-3 inline-flex h-8 items-center rounded-md bg-btn px-3 font-semibold text-[13px] text-btn-text hover:brightness-95"
        >
          View profile
        </Link>
      )}
      {detail.kind === "marketplace" && detail.listing && (
        <Link
          to="/marketplace/item/$listingId"
          params={{ listingId: detail.listing._id }}
          className="mt-3 inline-flex h-8 items-center rounded-md bg-btn px-3 font-semibold text-[13px] text-btn-text hover:brightness-95"
        >
          View listing
        </Link>
      )}
    </div>
  );
}

function MessageRow({
  m,
  pos,
  mine,
  viewerId,
  sender,
  members,
  showAvatar,
  showName,
  avatarSize,
  variant,
  onReply,
  onCall,
}: {
  m: Message;
  pos: Pos;
  mine: boolean;
  viewerId: Id<"users">;
  sender: Member | undefined;
  members: Map<Id<"users">, Member>;
  showAvatar: boolean;
  showName: boolean;
  avatarSize: number;
  variant: Variant;
  onReply: (m: Message) => void;
  onCall: (media: "audio" | "video") => void;
}) {
  const [hoverLock, setHoverLock] = useState(false);
  const draft = m.status !== "sent";
  const big = !m.unsent && m.attachments.length === 0 && isBigEmoji(m.text);
  const maxW = variant === "dock" ? "max-w-[208px]" : "max-w-[min(564px,62%)]";
  const hasReactions = m.reactions.length > 0;
  const first = sender?.firstName ?? "Someone";

  let replyLabel: string | null = null;
  if (m.replyTo) {
    const target = m.replyTo.senderId;
    const whom =
      target === m.senderId
        ? mine
          ? "yourself"
          : "themself"
        : target === viewerId
          ? "you"
          : (members.get(target)?.firstName ?? "a message");
    replyLabel = `${mine ? "You" : first} replied to ${whom}`;
  }

  const body: ReactNode[] = [];
  for (const [i, a] of m.attachments.entries()) {
    if (a.kind === "image")
      body.push(
        <a key={`a${i}`} href={a.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={a.url}
            alt=""
            width={a.width}
            height={a.height}
            className={cn(
              "block max-h-[240px] w-auto max-w-full border border-[var(--media-inner-border)] object-cover",
              variant === "dock" ? "max-w-[208px]" : "max-w-[300px]",
            )}
            style={{ borderRadius: radius(pos, mine) }}
          />
        </a>,
      );
    else if (a.kind === "sticker")
      body.push(
        a.emoji === "👍" ? (
          <ThumbIcon key={`a${i}`} size={40} className="my-1 text-fb" />
        ) : (
          <span key={`a${i}`} className="block py-1 text-[44px] leading-[52px]">
            {a.emoji}
          </span>
        ),
      );
    else if (a.kind === "call")
      body.push(
        <CallLog
          key={`a${i}`}
          media={a.media}
          outcome={a.outcome}
          durationMs={a.durationMs}
          mine={mine}
          radius={radius(pos, mine)}
          onCall={() => onCall(a.media)}
        />,
      );
    else if (a.kind === "listing")
      body.push(
        <Link
          key={`a${i}`}
          to="/marketplace/item/$listingId"
          params={{ listingId: a.listingId }}
          className="block w-[208px] overflow-hidden rounded-[18px] bg-chat-in"
        >
          {a.photo && <img src={a.photo} alt="" className="h-[140px] w-full object-cover" />}
          <span className="block px-3 py-2">
            <span className="block truncate font-semibold text-[15px] text-primary">{a.title}</span>
            <span className="block text-[13px] text-secondary">
              {price(a.price)} · {a.city}
            </span>
          </span>
        </Link>,
      );
    else if (a.kind === "story")
      body.push(
        <StoryReplyAttachment key={`a${i}`} story={a} mine={mine} senderFirstName={first} />,
      );
    else if (a.kind === "post")
      body.push(
        <Link
          key={`a${i}`}
          to="/$username/posts/$postId"
          params={{ username: a.author?.username ?? "_", postId: a.postId }}
          className="block w-[208px] overflow-hidden rounded-[18px] bg-chat-in"
        >
          {a.image && <img src={a.image} alt="" className="h-[140px] w-full object-cover" />}
          <span className="block px-3 py-2">
            <span className="flex items-center gap-1.5">
              {a.author && <Avatar src={a.author.avatar} size={20} />}
              <span className="truncate font-semibold text-[13px] text-primary">
                {a.author?.name ?? "Post"}
              </span>
            </span>
            {a.text && (
              <span className="mt-1 line-clamp-2 text-[13px] text-secondary leading-4">
                {a.text}
              </span>
            )}
          </span>
        </Link>,
      );
  }

  let textNode: ReactNode = null;
  if (m.unsent)
    textNode = (
      <div
        className="border border-divider px-3 py-2 text-[15px] text-secondary leading-5"
        style={{ borderRadius: radius(pos, mine) }}
      >
        {mine ? "You" : first} unsent a message
      </div>
    );
  else if (big) textNode = <div className="py-0.5 text-[32px] leading-10">{m.text}</div>;
  else if (m.text)
    textNode = (
      <div
        className={cn(
          "whitespace-pre-wrap break-words px-3 py-2 text-[15px] leading-5",
          mine ? "bg-fb text-white" : "bg-chat-in text-primary",
          draft && "opacity-60",
        )}
        style={{ borderRadius: radius(pos, mine) }}
      >
        <Linkified text={m.text} mine={mine} />
      </div>
    );

  const stamp = separatorTime(m.createdAt);
  const canAct = !m.unsent && !draft;

  return (
    <div
      id={`msg-${m._id}`}
      className={cn(
        "group/msg flex flex-col transition-colors",
        mine ? "items-end" : "items-start",
        pos === "first" || pos === "single" ? "mt-2" : "mt-0.5",
        hasReactions && "mb-3.5",
      )}
    >
      {showName && !m.replyTo && (
        <span
          className="pb-0.5 text-[12px] text-secondary leading-4"
          style={{ paddingLeft: avatarSize + 8 + 12 }}
        >
          {first}
        </span>
      )}
      {m.replyTo && (
        <div
          className={cn("flex w-full flex-col", mine ? "items-end" : "items-start")}
          style={{ paddingLeft: mine ? 0 : avatarSize + 8 }}
        >
          <span className="flex items-center gap-1 px-1 pb-1 text-[12px] text-secondary leading-4">
            <ReplyIcon size={12} />
            {replyLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(`msg-${m.replyTo?._id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              el?.animate(
                [{ backgroundColor: "var(--text-highlight)" }, { backgroundColor: "transparent" }],
                { duration: 1200 },
              );
            }}
            className={cn(
              "-mb-3 block rounded-[18px] bg-chat-in px-3 pt-2 pb-5 text-left opacity-60",
              maxW,
            )}
          >
            {m.replyTo.unsent ? (
              <span className="text-[13px] text-secondary">Message unsent</span>
            ) : m.replyTo.image ? (
              <img src={m.replyTo.image} alt="" className="h-16 rounded-lg object-cover" />
            ) : (
              <span className="block max-h-8 overflow-hidden break-words text-[13px] text-primary leading-4">
                {m.replyTo.text ?? m.replyTo.sticker ?? "Attachment"}
              </span>
            )}
          </button>
        </div>
      )}
      <div className={cn("relative flex w-full items-end gap-2", mine && "flex-row-reverse")}>
        {!mine && (
          <span className="shrink-0" style={{ width: avatarSize }}>
            {showAvatar && sender && (
              <Tooltip content={sender.name} side="left">
                <span>
                  <Avatar src={sender.avatar} size={avatarSize} />
                </span>
              </Tooltip>
            )}
          </span>
        )}
        <StampTooltip stamp={stamp} side={mine ? "left" : "right"} offset={canAct ? 92 : 8}>
          <div
            className={cn(
              "relative flex min-w-0 flex-col gap-0.5",
              mine ? "items-end" : "items-start",
              maxW,
            )}
          >
            {body}
            {textNode}
            {hasReactions && <ReactionBadge m={m} members={members} mine={mine} />}
          </div>
        </StampTooltip>
        {canAct && (
          <div
            className={cn(
              "flex shrink-0 items-center self-center text-icon-secondary opacity-0 group-hover/msg:opacity-100",
              hoverLock && "opacity-100",
              mine ? "flex-row-reverse" : "flex-row",
            )}
          >
            <ReactButton m={m} onOpenChange={setHoverLock} />
            <ActionButton label="Reply" onClick={() => onReply(m)}>
              <ReplyIcon size={16} />
            </ActionButton>
            <MoreButton m={m} mine={mine} onOpenChange={setHoverLock} />
          </div>
        )}
      </div>
      {draft && (
        <span className="px-1 pt-0.5 text-[12px] text-secondary">
          Draft{m.author.kind === "agent" ? ` · ${m.author.agent}` : ""}
        </span>
      )}
    </div>
  );
}

/** Call log bubble: "Audio call · No answer" for the caller, "Missed video call" for the callee. */
function CallLog({
  media,
  outcome,
  durationMs,
  mine,
  radius,
  onCall,
}: {
  media: "audio" | "video";
  outcome: "no_answer" | "cancelled" | "answered" | "declined";
  durationMs?: number;
  mine: boolean;
  radius: string;
  onCall: () => void;
}) {
  const kind = media === "video" ? "video call" : "audio call";
  const answered = outcome === "answered";
  const missed = !mine && !answered;
  const title = missed ? `Missed ${kind}` : media === "video" ? "Video call" : "Audio call";
  const sub = answered
    ? formatCallDuration(durationMs ?? 0)
    : mine
      ? { no_answer: "No answer", cancelled: "Cancelled", declined: "Declined" }[outcome]
      : null;
  const Icon = media === "video" ? VideoCallIcon : PhoneIcon;
  return (
    <div className="w-[208px] bg-chat-in p-3" style={{ borderRadius: radius }}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            missed ? "bg-[#e41e3f] text-white" : "bg-[var(--hover-overlay)] text-primary",
          )}
        >
          <Icon size={media === "video" ? 20 : 18} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[15px] text-primary leading-5">{title}</span>
          {sub && <span className="block text-[13px] text-secondary leading-4">{sub}</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={onCall}
        className="mt-3 flex h-8 w-full items-center justify-center rounded-md bg-card font-semibold text-[15px] text-primary transition-[filter] hover:brightness-95 dark:hover:brightness-125"
      >
        {mine && !answered ? "Call again" : "Call back"}
      </button>
    </div>
  );
}

function Linkified({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            className={cn("underline", mine ? "text-white" : "text-primary")}
          >
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-hover"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ReactButton({ m, onOpenChange }: { m: Message; onOpenChange: (o: boolean) => void }) {
  const viewer = useViewer();
  const react = useM(api.reactions.react);
  const [open, setOpen] = useState(false);
  const mineType = m.reactions.find((r) => r.userId === viewer._id)?.type;
  const set = (o: boolean) => {
    setOpen(o);
    onOpenChange(o);
  };
  return (
    <P.Root open={open} onOpenChange={set}>
      <Tooltip content="React" side="top">
        <P.Trigger asChild>
          <button
            type="button"
            aria-label="React"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-hover"
          >
            <SmileOutlineIcon size={16} />
          </button>
        </P.Trigger>
      </Tooltip>
      <P.Portal>
        <P.Content
          side="top"
          sideOffset={4}
          collisionPadding={8}
          className="z-[70] flex items-center gap-0.5 rounded-full bg-popover p-1 shadow-elevated outline-none"
        >
          {MESSAGE_REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              aria-label={r.label}
              onClick={() => {
                set(false);
                void react({ targetType: "message", targetId: m._id, type: r.type });
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[26px] leading-none transition-transform hover:scale-125",
                mineType === r.type && "bg-btn",
              )}
            >
              {r.emoji}
            </button>
          ))}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function MoreButton({
  m,
  mine,
  onOpenChange,
}: {
  m: Message;
  mine: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const unsend = useM(api.messenger.unsend);
  const report = useM(api.reports.create);
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <Menu onOpenChange={onOpenChange} modal={false}>
        <Tooltip content="More" side="top">
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-hover"
            >
              <DotsVerticalIcon size={16} />
            </button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent width={200} align="center">
          {mine && <MenuItem label="Unsend" onSelect={() => setConfirm(true)} />}
          {m.text && (
            <MenuItem
              label="Copy"
              onSelect={() => void navigator.clipboard?.writeText(m.text ?? "")}
            />
          )}
          {!mine && <MenuItem label="Report" onSelect={() => setReporting(true)} />}
        </MenuContent>
      </Menu>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Who do you want to unsend this message for?"
        width={548}
      >
        <div className="p-4">
          <p className="font-semibold text-[15px] text-primary">Unsend for everyone</p>
          <p className="mt-1 text-[13px] text-secondary leading-4">
            This message will be unsent for everyone in the chat. Others may have already seen or
            forwarded it. Unsent messages can still be included in reports.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="link" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="px-8"
              onClick={() => {
                setConfirm(false);
                void unsend({ messageId: m._id });
              }}
            >
              Unsend
            </Button>
          </div>
        </div>
      </Modal>
      {reporting && (
        <ReportDialog
          noun="message"
          reasons={MESSAGE_REPORT_REASONS}
          onSubmit={(reason) => report({ targetType: "message", targetId: m._id, reason })}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  );
}

function ReactionBadge({
  m,
  members,
  mine,
}: {
  m: Message;
  members: Map<Id<"users">, Member>;
  mine: boolean;
}) {
  const viewer = useViewer();
  const react = useM(api.reactions.react);
  const [open, setOpen] = useState(false);
  const types = [...new Set(m.reactions.map((r) => r.type))].slice(0, 3);
  return (
    <>
      <button
        type="button"
        aria-label="See who reacted to this"
        onClick={() => setOpen(true)}
        className={cn(
          "absolute -bottom-4 z-[1] flex h-[20px] items-center gap-0.5 rounded-full bg-card px-1 text-[12px] text-secondary leading-none shadow-[0_1px_3px_var(--shadow-2)]",
          mine ? "right-1" : "right-1",
        )}
      >
        {types.map((t) => (
          <span key={t} className="text-[12px]">
            {reactionEmoji(t)}
          </span>
        ))}
        {m.reactions.length > 1 && <span className="pr-0.5">{m.reactions.length}</span>}
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Message reactions" width={548}>
        <div className="p-2">
          <div className="border-divider border-b px-2 pb-2">
            <span className="inline-flex h-9 items-center border-fb border-b-[3px] px-2 font-semibold text-[15px] text-fb">
              All {m.reactions.length}
            </span>
          </div>
          {m.reactions.map((r) => {
            const u = members.get(r.userId);
            if (!u) return null;
            const isMe = r.userId === viewer._id;
            return (
              <button
                key={r.userId}
                type="button"
                disabled={!isMe}
                onClick={() => {
                  setOpen(false);
                  void react({ targetType: "message", targetId: m._id, type: null });
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left enabled:hover:bg-hover"
              >
                <Avatar src={u.avatar} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[15px] text-primary">{u.name}</span>
                  {isMe && (
                    <span className="block text-[13px] text-secondary">Select to remove</span>
                  )}
                </span>
                <span className="text-[24px]">{reactionEmoji(r.type)}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

/** Timestamp beside a bubble, pushed past the hover actions so it doesn't cover them. */
function StampTooltip({
  stamp,
  side,
  offset,
  children,
}: {
  stamp: string;
  side: "left" | "right";
  offset: number;
  children: ReactNode;
}) {
  return (
    <T.Root delayDuration={500}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={offset}
          className="z-[100] rounded-lg bg-[rgba(0,0,0,0.8)] px-3 py-2 text-[13px] text-white leading-4 dark:bg-[rgba(228,230,235,0.95)] dark:text-[#050505]"
        >
          {stamp}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

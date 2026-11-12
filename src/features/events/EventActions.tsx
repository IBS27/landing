import { Bookmark, BookmarkMinus, ChevronDown, CircleCheck, Link2, Star, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { useM, useQ, useViewer } from "@/app/viewer";
import { type Audience, AudienceChip } from "@/features/posts/Audience";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cardDate } from "./format";

export type Response = "going" | "interested" | "invited" | null;

/* ---------- Snackbar (Facebook's bottom-left toast) ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg &&
        createPortal(
          <div
            role="status"
            className="fixed bottom-6 left-6 z-[70] flex max-w-sm items-center gap-3 rounded-lg bg-popover py-3 pr-2 pl-4 text-[15px] text-primary shadow-elevated"
          >
            <span className="flex-1">{msg}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setMsg(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-secondary hover:bg-hover"
            >
              <X size={18} />
            </button>
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function eventUrl(eventId: string) {
  return `${window.location.origin}/events/${eventId}`;
}

export function useCopyLink() {
  const toast = useToast();
  return (eventId: string) => {
    void navigator.clipboard
      ?.writeText(eventUrl(eventId))
      .then(() => toast("Link copied to clipboard."))
      .catch(() => toast("Couldn't copy the link."));
  };
}

/* ---------- Icons ---------- */

export function ShareArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M9.2 1.4a.75.75 0 0 1 .82.15l5.5 5.25a.75.75 0 0 1 0 1.09l-5.5 5.25A.75.75 0 0 1 8.75 12.6V10C5.6 10 3.5 11 1.9 13.4a.5.5 0 0 1-.9-.33C1.4 8.6 4.1 5.8 8.75 5.5V2.1a.75.75 0 0 1 .45-.69Z" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M1 4.25A2.25 2.25 0 0 1 3.25 2h9.5A2.25 2.25 0 0 1 15 4.25v.2L8 8.6 1 4.45v-.2Z" />
      <path d="M1 6.2v5.55A2.25 2.25 0 0 0 3.25 14h9.5A2.25 2.25 0 0 0 15 11.75V6.2L8.38 10.13a.75.75 0 0 1-.76 0L1 6.2Z" />
    </svg>
  );
}

export function StarIcon({ filled, size = 16 }: { filled?: boolean; size?: number }) {
  return <Star size={size} strokeWidth={2.2} fill={filled ? "currentColor" : "none"} />;
}

/* ---------- Interested toggle (cards) ---------- */

/** Card button: "☆ Interested" ↔ soft-blue "★ Interested" / "✓ Going". */
export function InterestedButton({
  eventId,
  status,
  className,
  compact,
}: {
  eventId: Id<"events">;
  status: Response;
  className?: string;
  /** Search rows: blue soft button without an icon. */
  compact?: boolean;
}) {
  const respond = useM(api.events.respond);
  const active = status === "going" || status === "interested";
  const going = status === "going";
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void respond({ eventId, status: status === "interested" ? "none" : "interested" });
  };
  if (going)
    return (
      <ResponseMenu eventId={eventId} status={status}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-btn-soft px-3 font-semibold text-[15px] text-btn-soft-text hover:brightness-95 dark:hover:brightness-125",
            className,
          )}
        >
          {!compact && <CircleCheck size={16} strokeWidth={2.4} />}
          Going
        </button>
      </ResponseMenu>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 font-semibold text-[15px] transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125",
        active || compact ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-btn-text",
        className,
      )}
    >
      {!compact && <StarIcon filled={active} />}
      Interested
    </button>
  );
}

/**
 * Card response control for invitations: one grey "☆ Interested ▾" button
 * whose menu offers Going / Interested / Can't go. Responded cards fall back
 * to InterestedButton (blue Interested toggle, or "✓ Going" with the menu).
 */
export function CardResponseButton({
  eventId,
  status,
  className,
}: {
  eventId: Id<"events">;
  status: Response;
  className?: string;
}) {
  if (status !== "invited")
    return <InterestedButton eventId={eventId} status={status} className={className} />;
  return (
    <ResponseMenu eventId={eventId} status={status}>
      <button
        type="button"
        aria-label="Respond to invitation"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125",
          className,
        )}
      >
        <StarIcon />
        Interested
        <ChevronDown size={16} strokeWidth={2.6} />
      </button>
    </ResponseMenu>
  );
}

/** Going / Interested / Can't go radio menu, opened from a response button. */
export function ResponseMenu({
  eventId,
  status,
  children,
  align = "start",
}: {
  eventId: Id<"events">;
  status: Response;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const respond = useM(api.events.respond);
  const opts = [
    { value: "going" as const, label: "Going" },
    { value: "interested" as const, label: "Interested" },
    { value: "none" as const, label: "Can't go" },
  ];
  const current = status === "invited" ? null : (status ?? "none");
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align} width={220}>
        {opts.map((o) => (
          <MenuItem
            key={o.value}
            onSelect={() => void respond({ eventId, status: o.value })}
            icon={
              o.value === "going" ? (
                <CircleCheck size={20} />
              ) : o.value === "interested" ? (
                <Star size={20} />
              ) : (
                <X size={20} />
              )
            }
            label={
              <span className="flex items-center justify-between">
                {o.label}
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    current === o.value ? "border-fb" : "border-secondary/60",
                  )}
                >
                  {current === o.value && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
                </span>
              </span>
            }
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

/* ---------- Share ---------- */

type ShareTarget = {
  _id: Id<"events">;
  title: string;
  cover: string;
  startAt: number;
  endAt: number | null;
  location: string;
};

/** "Share" sheet: post the event to Feed with a note, or copy its link. */
export function ShareEventDialog({ event, onClose }: { event: ShareTarget; onClose: () => void }) {
  const viewer = useViewer();
  const create = useM(api.posts.create);
  const copy = useCopyLink();
  const toast = useToast();
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<Audience>("friends");
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      await create({
        text: text || undefined,
        privacy: audience,
        attachments: [{ kind: "event", eventId: event._id }],
      });
      toast("Shared to your Feed.");
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Share" width={548}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Avatar src={viewer.avatar} size={40} />
          <div>
            <p className="font-semibold text-[15px] text-primary">{viewer.name}</p>
            <div className="mt-0.5 flex gap-1">
              <span className="inline-flex h-6 items-center rounded-md bg-btn px-2 font-semibold text-[13px] text-btn-text">
                Feed
              </span>
              <AudienceChip value={audience} onChange={setAudience} />
            </div>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something about this..."
          aria-label="Say something about this"
          className="mt-3 h-20 w-full resize-none bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
        <div className="overflow-hidden rounded-lg border border-divider">
          <img src={event.cover} alt="" className="aspect-[1.91/1] w-full object-cover" />
          <div className="bg-comment px-3 py-2.5">
            <p className="font-semibold text-[13px] text-negative uppercase leading-4">
              {cardDate(event.startAt, event.endAt)}
            </p>
            <p className="mt-0.5 truncate font-semibold text-[17px] text-primary leading-[22px]">
              {event.title}
            </p>
            <p className="truncate text-[15px] text-secondary leading-5">{event.location}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="secondary" icon={<Link2 size={18} />} onClick={() => copy(event._id)}>
            Copy link
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void share()} className="w-32">
            Share now
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Save toggle for "..." menus ---------- */

export function SaveMenuItem({ eventId }: { eventId: Id<"events"> }) {
  const saved = useQ(api.saved.isSaved, { kind: "event", refId: eventId });
  const toggle = useM(api.saved.toggle);
  const toast = useToast();
  return (
    <MenuItem
      icon={saved ? <BookmarkMinus size={20} /> : <Bookmark size={20} />}
      label={saved ? "Unsave event" : "Save event"}
      sub={saved ? undefined : "Add this to your saved items."}
      onSelect={() =>
        void toggle({ kind: "event", refId: eventId }).then((s) =>
          toast(s ? "Saved to your items." : "Removed from your saved items."),
        )
      }
    />
  );
}

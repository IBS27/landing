import { useNavigate } from "@tanstack/react-router";
import { Check, SquareX } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM } from "@/app/viewer";
import { DotsIcon } from "@/features/posts/icons";
import { FacebookLogo } from "@/icons";
import { cn, fullTimestamp, shortAge } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { KindBadge } from "./KindBadge";
import type { NotificationTarget, NotificationView } from "./types";

/** Bold the actor's name and any group/event/listing names inside the text. */
function NotificationText({ n }: { n: NotificationView }) {
  const parts: ReactNode[] = [];
  let rest = n.text;
  let key = 0;
  while (rest) {
    let hit: { at: number; s: string } | null = null;
    for (const s of n.emphasis) {
      const at = rest.indexOf(s);
      if (at >= 0 && (!hit || at < hit.at)) hit = { at, s };
    }
    if (!hit) {
      parts.push(rest);
      break;
    }
    if (hit.at > 0) parts.push(rest.slice(0, hit.at));
    parts.push(
      <strong key={key++} className="font-semibold">
        {hit.s}
      </strong>,
    );
    rest = rest.slice(hit.at + hit.s.length);
  }
  return (
    <span className="line-clamp-3 text-[15px] text-primary leading-5">
      {n.actor && (
        <>
          <strong className="font-semibold">{n.actor.name}</strong>{" "}
        </>
      )}
      {parts}
    </span>
  );
}

export function useOpenTarget() {
  const navigate = useNavigate();
  const { openChat } = useChatDock();
  return (t: NotificationTarget) => {
    switch (t.kind) {
      case "post":
        return void navigate({
          to: "/$username/posts/$postId",
          params: { username: t.username, postId: t.postId },
        });
      case "profile":
        return void navigate({ to: "/$username", params: { username: t.username } });
      case "group":
        return void navigate({ to: "/groups/$groupId", params: { groupId: t.slug } });
      case "event":
        return void navigate({ to: "/events/$eventId", params: { eventId: t.eventId } });
      case "listing":
        return void navigate({
          to: "/marketplace/item/$listingId",
          params: { listingId: t.listingId },
        });
      case "conversation":
        return openChat(t.conversationId);
    }
  };
}

export function NotificationRow({
  n,
  wide,
  onNavigate,
}: {
  n: NotificationView;
  /** The /notifications page uses a wider row. */
  wide?: boolean;
  onNavigate?: () => void;
}) {
  const setRead = useM(api.notifications.setRead);
  const remove = useM(api.notifications.remove);
  const accept = useM(api.friends.acceptRequest);
  const decline = useM(api.friends.declineRequest);
  const openTarget = useOpenTarget();
  const [menuOpen, setMenuOpen] = useState(false);

  const activate = () => {
    if (!n.read) void setRead({ id: n._id, read: true });
    onNavigate?.();
    openTarget(n.target);
  };
  const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

  return (
    <div className="group/row relative px-2">
      <div
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        className={cn(
          "flex min-h-[72px] w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-hover focus-visible:bg-hover",
          menuOpen && "bg-hover",
        )}
      >
        <span className="relative flex shrink-0 self-start">
          {n.actor ? (
            <Avatar src={n.actor.avatar} size={56} />
          ) : n.image ? (
            <Avatar src={n.image} size={56} />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card ring-1 ring-divider">
              <FacebookLogo size={48} />
            </span>
          )}
          <span className="absolute -right-1.5 -bottom-1.5">
            <KindBadge n={n} />
          </span>
        </span>
        <span className={cn("flex min-w-0 flex-1 flex-col", wide ? "pr-7" : "pr-1")}>
          <NotificationText n={n} />
          <Tooltip content={fullTimestamp(n.createdAt)}>
            <span
              className={cn(
                "mt-0.5 w-fit font-semibold text-[13px] leading-4",
                n.read ? "text-secondary" : "text-link",
              )}
            >
              {shortAge(n.createdAt)}
            </span>
          </Tooltip>
          {n.request === "pending" && (
            <span className="mt-2 flex gap-2">
              <Button
                variant="primary"
                className={cn(wide ? "w-[120px]" : "flex-1")}
                onClick={(e) => {
                  stop(e);
                  if (n.actor) void accept({ userId: n.actor._id });
                }}
              >
                Confirm
              </Button>
              <Button
                className={cn(wide ? "w-[120px]" : "flex-1")}
                onClick={(e) => {
                  stop(e);
                  if (n.actor) void decline({ userId: n.actor._id });
                }}
              >
                Delete
              </Button>
            </span>
          )}
          {n.request === "accepted" && (
            <span className="mt-1 text-[13px] text-secondary leading-4">Request accepted</span>
          )}
          {n.request === "removed" && (
            <span className="mt-1 text-[13px] text-secondary leading-4">Request removed</span>
          )}
        </span>
        <span className="flex w-5 shrink-0 items-center justify-center">
          {!n.read && <span className="h-3 w-3 rounded-full bg-link" />}
        </span>
      </div>

      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 transition-opacity",
          wide ? "right-9" : "right-2",
          menuOpen
            ? "opacity-100"
            : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
        )}
      >
        <Menu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Notification options"
              onClick={stop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-btn-floating text-icon-secondary shadow-[0_0_0_1px_var(--shadow-1),0_2px_6px_var(--shadow-1)] hover:brightness-95"
            >
              <DotsIcon size={20} />
            </button>
          </MenuTrigger>
          <MenuContent arrow>
            <MenuItem
              icon={<Check size={20} strokeWidth={2.2} />}
              label={n.read ? "Mark as unread" : "Mark as read"}
              onSelect={() => void setRead({ id: n._id, read: !n.read })}
            />
            <MenuItem
              icon={<SquareX size={20} strokeWidth={2} />}
              label="Remove this notification"
              onSelect={() => void remove({ id: n._id })}
            />
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

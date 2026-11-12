import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, Bell, BellOff, CircleUserRound, MailOpen, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/ui/overlays";
import { Avatar, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConversationAvatar } from "./ConversationAvatar";
import { BellOffIcon, DotsIcon } from "./icons";
import { type Conversation, chatAge } from "./util";

export type Filter = "all" | "unread" | "groups" | "communities";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
  { id: "communities", label: "Communities" },
];

export function SearchMessenger({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex h-9 items-center rounded-full bg-input pl-2.5">
      <Search size={16} strokeWidth={2.4} className="shrink-0 text-icon-secondary" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // biome-ignore lint/a11y/noAutofocus: the dropdown focuses search like Facebook
        autoFocus={autoFocus}
        placeholder="Search Messenger"
        aria-label="Search Messenger"
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 pt-[7px] pb-[9px] text-[15px] text-primary outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

export function FilterChips({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div role="tablist" className="flex h-9 items-center gap-1">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={value === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            "h-9 rounded-full px-3 font-semibold text-[15px] transition-colors",
            value === f.id ? "bg-btn-soft text-btn-soft-text" : "text-primary hover:bg-hover",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Inbox rows with search results. Shared by the header dropdown (rows open a
 * chat window) and the Messenger page (rows link to the thread).
 */
export function ConversationList({
  filter,
  query,
  activeId,
  onSelect,
  link,
  leading,
  folder,
}: {
  folder?: "archived" | "requests" | "restricted";
  filter: Filter;
  query: string;
  activeId?: Id<"conversations">;
  onSelect?: (id: Id<"conversations">) => void;
  /** Rows link to /messages/t/$id instead of calling onSelect. */
  link?: boolean;
  leading?: ReactNode;
}) {
  const convs = useQ(api.messenger.list, folder === "archived" ? { archived: true } : {});
  const term = query.trim().toLowerCase();
  const people = useQ(api.messenger.searchPeople, term ? { q: term } : "skip");
  const getOrCreateDm = useM(api.messenger.getOrCreateDm);
  const navigate = useNavigate();

  if (convs === undefined)
    return (
      <div className="flex flex-col px-2">
        {leading}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );

  if (folder === "requests" || folder === "restricted")
    return (
      <div className="px-2">
        {leading}
        <Empty
          title={folder === "requests" ? "No message requests" : "No restricted accounts"}
          body={
            folder === "requests"
              ? "You don't have any message requests."
              : "When you restrict someone, you'll see them here."
          }
        />
      </div>
    );

  if (filter === "communities")
    return (
      <div className="px-2">
        {leading}
        <Empty title="No communities" body="Communities you join will show up here." />
      </div>
    );

  let rows = convs;
  if (filter === "unread") rows = rows.filter((c) => c.unread);
  if (filter === "groups") rows = rows.filter((c) => c.kind === "group");
  if (term) rows = rows.filter((c) => c.name.toLowerCase().includes(term));

  const dmIds = new Set(
    convs.filter((c) => c.kind === "dm").flatMap((c) => c.others.map((o) => o._id)),
  );
  const extraPeople = term ? (people?.people ?? []).filter((p) => !dmIds.has(p._id)) : [];

  const openPerson = async (userId: Id<"users">) => {
    const id = await getOrCreateDm({ userId });
    if (link) void navigate({ to: "/messages/t/$conversationId", params: { conversationId: id } });
    else onSelect?.(id);
  };

  return (
    <div className="flex flex-col px-2">
      {leading}
      {rows.map((c) => (
        <ConversationRow
          key={c._id}
          c={c}
          active={c._id === activeId}
          archived={folder === "archived"}
          link={link}
          onSelect={onSelect}
        />
      ))}
      {extraPeople.length > 0 && (
        <>
          <p className="px-2 pt-3 pb-1 font-semibold text-[15px] text-primary">More people</p>
          {extraPeople.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => void openPerson(p._id)}
              className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
            >
              <Avatar src={p.avatar} size={40} online={p.online} />
              <span className="truncate font-medium text-[15px] text-primary">{p.name}</span>
            </button>
          ))}
        </>
      )}
      {rows.length === 0 && extraPeople.length === 0 && (
        <Empty
          title={
            term
              ? "No results"
              : folder === "archived"
                ? "No archived chats"
                : filter === "unread"
                  ? "No unread chats"
                  : "No chats"
          }
          body={
            term
              ? `We couldn't find anything for "${query.trim()}".`
              : folder === "archived"
                ? "Chats you archive will show up here."
                : filter === "unread"
                  ? "You're all caught up."
                  : filter === "groups"
                    ? "Group chats you're in will show up here."
                    : "When you have chats, you'll see them here."
          }
        />
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-[252px] flex-col items-center pt-8 pb-6 text-center">
      <p className="font-semibold text-[15px] text-secondary">{title}</p>
      <p className="mt-1 text-[13px] text-secondary leading-4">{body}</p>
    </div>
  );
}

export function ConversationRow({
  c,
  active,
  archived,
  link,
  onSelect,
}: {
  c: Conversation;
  active?: boolean;
  archived?: boolean;
  link?: boolean;
  onSelect?: (id: Id<"conversations">) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const inner = (
    <>
      <ConversationAvatar
        kind={c.kind}
        photo={c.photo}
        others={c.others}
        online={c.kind !== "marketplace" && c.online}
        size={56}
      />
      <span className="min-w-0 flex-1 pr-6">
        <span
          className={cn(
            "block truncate text-[15px] text-primary leading-5",
            c.unread ? "font-semibold" : "font-medium",
          )}
        >
          {c.name}
        </span>
        {c.preview && (
          <span
            className={cn(
              "flex text-[13px] leading-4",
              c.unread ? "font-semibold text-primary" : "text-secondary",
            )}
          >
            <span className="min-w-0 truncate">{c.preview.text}</span>
            <span className="shrink-0 whitespace-pre"> · {chatAge(c.preview.at)}</span>
          </span>
        )}
      </span>
    </>
  );
  const rowClass = cn(
    "flex min-h-[72px] w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
    active ? "bg-highlight" : "hover:bg-hover",
  );
  return (
    <div className="group relative">
      {link ? (
        <Link
          to="/messages/t/$conversationId"
          params={{ conversationId: c._id }}
          className={rowClass}
        >
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={() => onSelect?.(c._id)} className={rowClass}>
          {inner}
        </button>
      )}
      <span className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
        {c.muted && <BellOffIcon size={14} className="text-icon-secondary" />}
        {c.unread && !menuOpen && (
          <span className="h-3 w-3 rounded-full bg-fb group-hover:invisible" />
        )}
      </span>
      <RowMenu c={c} archived={archived} open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}

function RowMenu({
  c,
  archived,
  open,
  onOpenChange,
}: {
  c: Conversation;
  archived?: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const markRead = useM(api.messenger.markRead);
  const markUnread = useM(api.messenger.markUnread);
  const setMuted = useM(api.messenger.setMuted);
  const archive = useM(api.messenger.archive);
  const navigate = useNavigate();
  const person = c.kind !== "group" ? c.others[0] : undefined;
  return (
    <Menu open={open} onOpenChange={onOpenChange} modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="More options"
          className={cn(
            "absolute top-1/2 right-6 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-card text-icon-secondary shadow-[0_0_0_1px_var(--shadow-1),0_2px_4px_var(--shadow-1)] transition-opacity hover:bg-[color-mix(in_srgb,var(--card),var(--primary-text)_5%)]",
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <DotsIcon size={18} />
        </button>
      </MenuTrigger>
      <MenuContent width={344}>
        <MenuItem
          icon={<MailOpen size={20} />}
          label={c.unread ? "Mark as read" : "Mark as unread"}
          onSelect={() => void (c.unread ? markRead : markUnread)({ conversationId: c._id })}
        />
        <MenuItem
          icon={c.muted ? <Bell size={20} /> : <BellOff size={20} />}
          label={c.muted ? "Unmute notifications" : "Mute notifications"}
          onSelect={() => void setMuted({ conversationId: c._id, muted: !c.muted })}
        />
        {person && (
          <MenuItem
            icon={<CircleUserRound size={20} />}
            label="View profile"
            onSelect={() =>
              void navigate({ to: "/$username", params: { username: person.username } })
            }
          />
        )}
        <MenuSeparator />
        <MenuItem
          icon={<Archive size={20} />}
          label={archived ? "Unarchive chat" : "Archive chat"}
          onSelect={() => void archive({ conversationId: c._id, archived: !archived })}
        />
      </MenuContent>
    </Menu>
  );
}

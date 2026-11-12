import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ChevronDown,
  CircleUserRound,
  FileText,
  Image as ImageIcon,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Pin,
  Search,
  SmilePlus,
} from "lucide-react";
import { Popover as P } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { ConversationAvatar } from "./ConversationAvatar";
import { activeLabel, type ConversationDetail, EMOJIS, separatorTime } from "./util";

type View = "main" | "media" | "files" | "links" | "search";

/** Right-hand conversation details panel on the Messenger page. */
export function InfoPanel({ c }: { c: ConversationDetail }) {
  const [view, setView] = useState<View>("main");
  return (
    <aside
      aria-label="Conversation information"
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-divider border-l"
    >
      {view === "main" && <Main c={c} setView={setView} />}
      {(view === "media" || view === "files" || view === "links") && (
        <MediaView c={c} tab={view} setView={setView} />
      )}
      {view === "search" && <SearchView c={c} onBack={() => setView("main")} />}
    </aside>
  );
}

function Main({ c, setView }: { c: ConversationDetail; setView: (v: View) => void }) {
  const setMuted = useM(api.messenger.setMuted);
  const navigate = useNavigate();
  const person = c.kind !== "group" ? c.others[0] : undefined;
  const sub =
    c.kind === "marketplace" && c.listing ? c.listing.title : activeLabel(c.online, c.lastActiveAt);
  const [pinned, setPinned] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const toggleMute = () => void setMuted({ conversationId: c._id, muted: !c.muted });

  return (
    <div className="px-2 pb-4">
      <div className="flex flex-col items-center px-2 pt-6 pb-2 text-center">
        <ConversationAvatar
          kind={c.kind}
          photo={c.photo}
          others={c.others}
          online={c.kind !== "marketplace" && c.online}
          size={72}
        />
        <p className="mt-3 font-semibold text-[17px] text-primary leading-[22px]">{c.name}</p>
        {sub && <p className="mt-0.5 text-[13px] text-secondary leading-4">{sub}</p>}
        {c.kind === "dm" && (
          <span className="mt-3 inline-flex h-6 items-center gap-1 rounded-full bg-btn px-2.5 text-[12px] text-secondary">
            <Lock size={12} strokeWidth={2.5} /> End-to-end encrypted
          </span>
        )}
      </div>

      <div className="flex justify-center gap-6 py-3">
        {person && (
          <Action
            label="Profile"
            icon={<CircleUserRound size={20} />}
            onClick={() =>
              void navigate({ to: "/$username", params: { username: person.username } })
            }
          />
        )}
        <Action
          label={c.muted ? "Unmute" : "Mute"}
          icon={c.muted ? <BellOff size={20} /> : <Bell size={20} />}
          onClick={toggleMute}
        />
        <Action label="Search" icon={<Search size={20} />} onClick={() => setView("search")} />
      </div>

      <Section title="Chat info">
        <Row
          icon={<Pin size={20} />}
          label="View pinned messages"
          onClick={() => setPinned(true)}
        />
        {c.kind === "marketplace" && c.listing && (
          <Link
            to="/marketplace/item/$listingId"
            params={{ listingId: c.listing._id }}
            className="flex h-11 items-center gap-3 rounded-md px-2 hover:bg-hover"
          >
            {c.listing.photo && (
              <img src={c.listing.photo} alt="" className="h-7 w-7 rounded object-cover" />
            )}
            <span className="truncate font-medium text-[15px] text-primary">View listing</span>
          </Link>
        )}
      </Section>
      <Section title="Customize chat">
        {c.kind === "group" && (
          <Row
            icon={<Pencil size={20} />}
            label="Change chat name"
            onClick={() => setRenaming(true)}
          />
        )}
        <EmojiRow c={c} />
      </Section>
      {c.kind === "group" && (
        <Section title="Chat members">
          {c.members.map((m) => (
            <Link
              key={m._id}
              to="/$username"
              params={{ username: m.username }}
              className="flex h-12 items-center gap-3 rounded-md px-2 hover:bg-hover"
            >
              <Avatar src={m.avatar} size={32} online={m.online} />
              <span className="truncate font-medium text-[15px] text-primary">{m.name}</span>
            </Link>
          ))}
        </Section>
      )}
      <Section title="Media & files">
        <Row icon={<ImageIcon size={20} />} label="Media" onClick={() => setView("media")} />
        <Row icon={<FileText size={20} />} label="Files" onClick={() => setView("files")} />
        <Row icon={<Link2 size={20} />} label="Links" onClick={() => setView("links")} />
      </Section>
      <Section title="Privacy & support">
        <Row
          icon={c.muted ? <Bell size={20} /> : <BellOff size={20} />}
          label={c.muted ? "Unmute notifications" : "Mute notifications"}
          onClick={toggleMute}
        />
        {c.kind === "group" && (
          <Row icon={<LogOut size={20} />} label="Leave group" onClick={() => setLeaving(true)} />
        )}
      </Section>

      <Modal open={pinned} onOpenChange={setPinned} title="Pinned messages" width={548}>
        <div className="px-6 py-10 text-center">
          <p className="font-semibold text-[17px] text-primary">No pinned messages</p>
          <p className="mt-1 text-[15px] text-secondary">
            Pin messages to make them easier to find later.
          </p>
        </div>
      </Modal>
      {c.kind === "group" && (
        <>
          <RenameModal c={c} open={renaming} onOpenChange={setRenaming} />
          <LeaveModal c={c} open={leaving} onOpenChange={setLeaving} />
        </>
      )}
    </div>
  );
}

function Action({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-14 flex-col items-center gap-1.5"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon group-hover:brightness-95 dark:group-hover:brightness-125">
        {icon}
      </span>
      <span className="text-[13px] text-primary leading-4">{label}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center rounded-md px-2 text-left hover:bg-hover"
      >
        <span className="flex-1 font-semibold text-[15px] text-primary">{title}</span>
        <ChevronDown
          size={20}
          className={cn("text-icon-secondary transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function Row({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-hover"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <span className="truncate font-medium text-[15px] text-primary">{label}</span>
    </button>
  );
}

function EmojiRow({ c }: { c: ConversationDetail }) {
  const setEmoji = useM(api.messenger.setEmoji);
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-hover"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn text-[16px]">
            {c.emoji === "👍" ? <SmilePlus size={20} className="text-icon" /> : c.emoji}
          </span>
          <span className="truncate font-medium text-[15px] text-primary">Change emoji</span>
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="left"
          sideOffset={8}
          collisionPadding={8}
          className="z-50 w-[300px] rounded-lg bg-popover p-2 shadow-elevated outline-none"
        >
          <p className="px-1 pb-2 font-semibold text-[15px] text-primary">Emoji</p>
          <div className="grid max-h-[240px] grid-cols-8 gap-0.5 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setOpen(false);
                  void setEmoji({ conversationId: c._id, emoji: e });
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-[22px] hover:bg-hover",
                  c.emoji === e && "bg-highlight",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function RenameModal({
  c,
  open,
  onOpenChange,
}: {
  c: ConversationDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const rename = useM(api.messenger.rename);
  const [name, setName] = useState(c.name);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Change chat name" width={548}>
      <form
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onOpenChange(false);
          void rename({ conversationId: c._id, title: name });
        }}
      >
        <p className="pb-3 text-[15px] text-secondary">
          Changing the name of a group chat changes it for everyone.
        </p>
        <label className="block rounded-md border border-divider px-3 pt-1.5 pb-2 focus-within:border-fb">
          <span className="block text-[12px] text-secondary">Chat name</span>
          <input
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-[15px] text-primary outline-none"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="link" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="px-8" disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LeaveModal({
  c,
  open,
  onOpenChange,
}: {
  c: ConversationDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const leave = useM(api.messenger.leaveGroup);
  const navigate = useNavigate();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Leave group chat?" width={548}>
      <div className="p-4">
        <p className="text-[15px] text-primary">
          You will stop receiving messages from this conversation and people will see that you left.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="link" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="px-8"
            onClick={() => {
              onOpenChange(false);
              void leave({ conversationId: c._id }).then(() => navigate({ to: "/messages" }));
            }}
          >
            Leave group
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-2">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full text-icon hover:bg-hover"
      >
        <ArrowLeft size={20} strokeWidth={2.4} />
      </button>
      <span className="font-semibold text-[17px] text-primary">{title}</span>
    </div>
  );
}

function MediaView({
  c,
  tab,
  setView,
}: {
  c: ConversationDetail;
  tab: "media" | "files" | "links";
  setView: (v: View) => void;
}) {
  const media = useQ(api.messenger.media, tab === "media" ? { conversationId: c._id } : "skip");
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "media", label: "Media" },
    { id: "files", label: "Files" },
    { id: "links", label: "Links" },
  ];
  return (
    <div className="flex flex-col">
      <SubHeader title="Media, files and links" onBack={() => setView("main")} />
      <div role="tablist" className="flex border-divider border-b px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setView(t.id)}
            className={cn(
              "relative h-10 flex-1 font-semibold text-[15px]",
              tab === t.id ? "text-fb" : "text-secondary hover:bg-hover",
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-fb" />
            )}
          </button>
        ))}
      </div>
      {tab === "media" ? (
        media === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : media.length === 0 ? (
          <Empty title="No media" />
        ) : (
          <div className="grid grid-cols-3 gap-1 p-2">
            {media.map((m) => (
              <a
                key={`${m.messageId}-${m.url}`}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="aspect-square overflow-hidden rounded"
              >
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )
      ) : (
        <Empty title={tab === "files" ? "No files" : "No links"} />
      )}
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return <p className="py-10 text-center font-semibold text-[15px] text-secondary">{title}</p>;
}

function SearchView({ c, onBack }: { c: ConversationDetail; onBack: () => void }) {
  const [q, setQ] = useState("");
  const results = useQ(api.messenger.search, q.trim() ? { conversationId: c._id, q } : "skip");
  return (
    <div className="flex flex-col">
      <SubHeader title="Search in conversation" onBack={onBack} />
      <div className="px-3 pb-2">
        <label className="flex h-9 items-center rounded-full bg-input pl-2.5">
          <Search size={16} strokeWidth={2.4} className="text-icon-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: opening search focuses its field
            autoFocus
            placeholder="Search"
            aria-label="Search in conversation"
            className="h-full flex-1 bg-transparent px-1.5 text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
      </div>
      {q.trim() &&
        (results === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : results.length === 0 ? (
          <Empty title="No results" />
        ) : (
          <ul className="px-2">
            {results.map((r) => (
              <li key={r._id}>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`msg-${r._id}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    el?.animate(
                      [
                        { backgroundColor: "var(--text-highlight)" },
                        { backgroundColor: "transparent" },
                      ],
                      { duration: 1500 },
                    );
                  }}
                  className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-hover"
                >
                  {r.sender && <Avatar src={r.sender.avatar} size={36} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1">
                      <span className="truncate font-semibold text-[13px] text-primary">
                        {r.sender?.name}
                      </span>
                      <span className="shrink-0 text-[12px] text-secondary">
                        {separatorTime(r.createdAt)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[13px] text-secondary leading-4">
                      {r.text}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

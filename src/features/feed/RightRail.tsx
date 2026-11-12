import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { MessageCircleQuestion, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useViewer } from "@/app/viewer";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal, Tooltip } from "@/ui/overlays";
import { Avatar, Button, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type RailsData = FunctionReturnType<typeof api.feed.rails>;

const ROW =
  "flex w-full min-h-[52px] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover";

function Heading({ children, actions }: { children: string; actions?: ReactNode }) {
  return (
    <div className="flex h-10 items-center justify-between px-2 pt-1">
      <h2 className="font-semibold text-[17px] text-secondary leading-5">{children}</h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

function SectionDivider() {
  return <div className="mx-2 my-2 h-px bg-divider" />;
}

/** FB's present-box birthday glyph. */
function GiftIcon() {
  return (
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden>
      <rect x="5" y="15" width="26" height="17" rx="2.5" fill="#1877F2" />
      <rect x="3" y="10" width="30" height="7" rx="2" fill="#4599FF" />
      <rect x="15.5" y="10" width="5" height="22" fill="#F7B928" />
      <path
        d="M18 10c-1.5-4-6.5-6.5-8.5-4.2-1.8 2 .8 4.2 8.5 4.2Zm0 0c1.5-4 6.5-6.5 8.5-4.2 1.8 2-.8 4.2-8.5 4.2Z"
        fill="#F7B928"
      />
    </svg>
  );
}

/** Home right rail: Sponsored, Birthdays, Contacts and Group conversations. */
export function RightRail({ data }: { data: RailsData | undefined }) {
  const { openChat } = useChatDock();
  const getOrCreateDm = useM(api.conversations.getOrCreateDm);
  const [opening, setOpening] = useState<Id<"users"> | null>(null);

  const openContact = async (userId: Id<"users">) => {
    setOpening(userId);
    try {
      openChat(await getOrCreateDm({ userId }));
    } finally {
      setOpening(null);
    }
  };

  const birthdays = data?.birthdays ?? [];
  // Contacts → "Search by name or group" filters contacts and group chats as you type.
  const [query, setQuery] = useState<string | null>(null);
  const term = query?.trim().toLowerCase() ?? "";
  // Like Facebook, match the start of the full name or of any later name (first/last), not mid-word.
  const matches = (name: string) => {
    const lower = name.toLowerCase();
    return lower.startsWith(term) || lower.split(/\s+/).some((w) => w.startsWith(term));
  };
  const contacts = (data?.contacts ?? []).filter((c) => matches(c.name));
  const groupChats = (data?.groupChats ?? []).filter(
    (g) => matches(g.title) || g.members.some((m) => matches(m.name)),
  );
  const noResults = term !== "" && data && contacts.length === 0 && groupChats.length === 0;

  return (
    <aside
      aria-label="Contacts and more"
      className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] min-w-[280px] shrink flex-col overflow-y-auto px-2 pt-2 pb-4 min-[1100px]:flex"
    >
      {data && data.sponsored.length > 0 && (
        <>
          <Heading>Sponsored</Heading>
          {data.sponsored.map((ad) => (
            <Link
              key={ad.postId}
              to="/$username/posts/$postId"
              params={{ username: ad.page.username, postId: ad.postId }}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
            >
              <img
                src={ad.image}
                alt=""
                className="h-[120px] w-[120px] shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0">
                <span className="line-clamp-2 font-medium text-[15px] text-primary leading-5">
                  {ad.title}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-secondary leading-4">
                  {ad.domain.toLowerCase()}
                </span>
              </span>
            </Link>
          ))}
          <SectionDivider />
        </>
      )}

      {birthdays.length > 0 && (
        <>
          <Heading>Birthdays</Heading>
          <Link to="/events/birthdays" className={ROW}>
            <GiftIcon />
            <span className="min-w-0 flex-1 text-[15px] text-primary leading-5">
              {birthdays.length === 1 ? (
                <>
                  <b className="font-semibold">{birthdays[0].name}</b>'s birthday is today.
                </>
              ) : (
                <>
                  <b className="font-semibold">{birthdays[0].name}</b> and{" "}
                  <b className="font-semibold">
                    {birthdays.length - 1} {birthdays.length === 2 ? "other" : "others"}
                  </b>{" "}
                  have birthdays today.
                </>
              )}
            </span>
          </Link>
          <SectionDivider />
        </>
      )}

      {query === null ? (
        <Heading
          actions={
            <>
              <Tooltip content="Search by name or group" side="top">
                <IconButton
                  label="Search by name or group"
                  size={32}
                  variant="ghost"
                  onClick={() => setQuery("")}
                >
                  <Search size={16} strokeWidth={2.5} className="text-icon-secondary" />
                </IconButton>
              </Tooltip>
              <ContactsOptions />
            </>
          }
        >
          Contacts
        </Heading>
      ) : (
        <div className="flex h-10 items-center gap-1 px-2 pt-1">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-input px-3">
            <Search size={16} strokeWidth={2.5} className="shrink-0 text-icon-secondary" />
            <input
              // biome-ignore lint/a11y/noAutofocus: opened by the search button
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery(null)}
              placeholder="Search by name or group"
              aria-label="Search by name or group"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
          <IconButton label="Close search" size={32} variant="ghost" onClick={() => setQuery(null)}>
            <X size={18} strokeWidth={2.5} className="text-icon-secondary" />
          </IconButton>
        </div>
      )}
      {noResults && (
        <p className="px-2 py-6 text-center text-[15px] text-secondary">No results found</p>
      )}
      <ul className="flex flex-col">
        {contacts.map((c) => (
          <li key={c._id}>
            <button
              type="button"
              disabled={opening === c._id}
              onClick={() => void openContact(c._id)}
              className={ROW}
            >
              <Avatar src={c.avatar} size={36} online={c.online} />
              <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5">
                {c.name}
              </span>
            </button>
          </li>
        ))}
        {data === undefined &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-2 py-2">
              <span className="h-9 w-9 animate-pulse rounded-full bg-btn" />
              <span className="h-3 w-32 animate-pulse rounded bg-btn" />
            </li>
          ))}
      </ul>

      {data && (term === "" || groupChats.length > 0) && (
        <>
          <SectionDivider />
          <Heading>Group conversations</Heading>
          <ul className="flex flex-col">
            {groupChats.map((g) => (
              <li key={g._id}>
                <button type="button" onClick={() => openChat(g._id)} className={ROW}>
                  <GroupChatAvatar photo={g.photo} members={g.members} />
                  <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5">
                    {g.title}
                  </span>
                </button>
              </li>
            ))}
            <li hidden={term !== ""}>
              <Link to="/messages" className={ROW}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                  <Plus size={20} strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5">
                  Create group chat
                </span>
              </Link>
            </li>
          </ul>
        </>
      )}
    </aside>
  );
}

/** Contacts "…" menu: active status and message requests. */
function ContactsOptions() {
  const viewer = useViewer();
  const setActiveStatus = useM(api.users.setActiveStatus);
  const navigate = useNavigate();
  const [confirmOff, setConfirmOff] = useState(false);
  const off = viewer.activeStatusOff === true;
  return (
    <>
      <Menu modal={false}>
        <Tooltip content="Options" side="top">
          <MenuTrigger asChild>
            <IconButton label="Options" size={32} variant="ghost">
              <MoreHorizontal size={18} strokeWidth={2.5} className="text-icon-secondary" />
            </IconButton>
          </MenuTrigger>
        </Tooltip>
        <MenuContent width={300}>
          <MenuItem
            icon={<ActiveStatusIcon />}
            label={off ? "Turn on active status" : "Turn off active status"}
            onSelect={() => (off ? void setActiveStatus({ on: true }) : setConfirmOff(true))}
          />
          <MenuItem
            icon={<MessageCircleQuestion size={20} />}
            label="Message requests"
            onSelect={() => void navigate({ to: "/messages", search: { folder: "requests" } })}
          />
        </MenuContent>
      </Menu>
      <Modal
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off active status"
        width={548}
      >
        <div className="p-4">
          <p className="text-[15px] text-primary leading-5">
            Your friends and contacts won't see when you're active or recently active on this
            profile. You'll still be able to use Messenger, but you won't see when your friends are
            active or recently active.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="link" className="px-3" onClick={() => setConfirmOff(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="px-8"
              onClick={() => {
                setConfirmOff(false);
                void setActiveStatus({ on: false });
              }}
            >
              Turn off
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Messenger's active-status glyph: a person with a green dot. */
function ActiveStatusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <circle cx="8.5" cy="6.5" r="3.5" />
      <path d="M1.5 17c0-3.6 3.1-6 7-6 1.4 0 2.7.3 3.8.9A4.5 4.5 0 0 0 12 17Z" />
      <circle cx="15.5" cy="14.5" r="3" className="fill-online" />
    </svg>
  );
}

function GroupChatAvatar({
  photo,
  members,
}: {
  photo: string | null;
  members: RailsData["groupChats"][number]["members"];
}) {
  if (photo || members.length < 2)
    return <Avatar src={photo ?? members[0]?.avatar ?? ""} size={36} />;
  return (
    <span className="relative h-9 w-9 shrink-0">
      <img
        src={members[0].avatar}
        alt=""
        className="absolute top-0 right-0 h-6 w-6 rounded-full object-cover"
      />
      <img
        src={members[1].avatar}
        alt=""
        className="absolute bottom-0 left-0 h-6 w-6 rounded-full border-2 border-wash object-cover"
      />
    </span>
  );
}

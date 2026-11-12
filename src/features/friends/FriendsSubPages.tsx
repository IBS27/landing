import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ, useViewer } from "@/app/viewer";
import { ProfilePreview } from "@/features/profile";
import { MessengerIcon } from "@/icons";
import { plural } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal } from "@/ui/overlays";
import { Avatar, Button, IconButton, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { MutualLine, type PersonCard, PersonRow } from "./cards";
import { UnfriendDialog } from "./FriendButton";
import { EmptyPane } from "./FriendsHome";
import { FriendsSubRail } from "./FriendsRail";
import {
  type Outcome,
  useFriendActions,
  useOutcomes,
  useRemovedSuggestions,
  useSticky,
} from "./hooks";
import { PersonXGlyph } from "./icons";

type SubPage = "/friends/requests" | "/friends/suggestions" | "/friends/list";

/** Rail on the left, selected person's profile (or an empty prompt) on the right. */
function Shell({
  rail,
  selected,
  empty,
}: {
  rail: ReactNode;
  selected: string | undefined;
  empty: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {rail}
      <main className="min-w-0 flex-1">
        {selected ? (
          <ProfilePreview key={selected} username={selected} />
        ) : (
          <EmptyPane text={empty} />
        )}
      </main>
    </div>
  );
}

function useSelect(page: SubPage) {
  const navigate = useNavigate();
  return (username: string) => navigate({ to: page, search: { profile: username } });
}

function RailHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pt-[18px] pb-[2px] font-semibold text-[17px] text-primary leading-5">
      {children}
    </h2>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-[60px] w-[60px] rounded-full" />
          <div className="flex-1 space-y-2 pt-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Friend requests ---------------- */

export function FriendRequestsPage({ profile }: { profile?: string }) {
  const requests = useQ(api.friends.requests, {});
  const actions = useFriendActions();
  const [outcomes, setOutcome] = useOutcomes();
  const keep = useMemo(() => new Set(Object.keys(outcomes)), [outcomes]);
  const rows = useSticky(requests, keep);
  const select = useSelect("/friends/requests");
  const [sentOpen, setSentOpen] = useState(false);

  const act = (id: string, o: Outcome, fn: () => Promise<unknown>) => {
    setOutcome(id, o);
    fn().catch(() => setOutcome(id, null));
  };
  const pending = requests?.length ?? 0;

  return (
    <Shell
      selected={profile}
      empty={
        rows && rows.length > 0
          ? "Select people's names to preview their profile."
          : "When you have friend requests or suggestions, you'll see them here."
      }
      rail={
        <FriendsSubRail
          title="Friend requests"
          header={
            <>
              <RailHeading>
                {pending > 0 ? plural(pending, "Friend request") : "Friend requests"}
              </RailHeading>
              <button
                type="button"
                onClick={() => setSentOpen(true)}
                className="self-start px-4 pt-[6px] pb-2 text-[13px] text-link hover:underline"
              >
                View sent requests
              </button>
              <SentRequestsDialog open={sentOpen} onOpenChange={setSentOpen} />
            </>
          }
        >
          {rows === undefined ? (
            <RowsSkeleton />
          ) : rows.length === 0 ? (
            <p className="px-2 pt-2 text-[13px] text-secondary">No new requests</p>
          ) : (
            rows.map((p) => {
              const o = outcomes[p._id];
              return (
                <PersonRow
                  key={p._id}
                  person={p}
                  selected={profile === p.username}
                  onSelect={() => select(p.username)}
                  meta={
                    o === "accepted" ? (
                      "Request accepted"
                    ) : o === "deleted" ? (
                      "Request removed"
                    ) : (
                      <MutualLine person={p} />
                    )
                  }
                  actions={
                    o ? undefined : (
                      <>
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => act(p._id, "accepted", () => actions.confirm(p._id))}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => act(p._id, "deleted", () => actions.decline(p._id))}
                        >
                          Delete
                        </Button>
                      </>
                    )
                  }
                />
              );
            })
          )}
        </FriendsSubRail>
      }
    />
  );
}

/** "Sent requests" dialog (from "View sent requests"). */
function SentRequestsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const sent = useQ(api.friends.sentRequests, open ? {} : "skip");
  const actions = useFriendActions();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Sent requests" width={548}>
      <div className="max-h-[480px] min-h-[160px] p-2">
        {sent === undefined ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : sent.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-secondary">No sent requests</p>
        ) : (
          <>
            <p className="px-2 pb-2 text-[15px] text-secondary">
              {plural(sent.length, "sent request")}
            </p>
            {sent.map((p) => (
              <div key={p._id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover">
                <Avatar src={p.avatar} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[15px] text-primary">{p.name}</div>
                  <div className="text-[13px] text-secondary">
                    <MutualLine person={p} />
                  </div>
                </div>
                <Button variant="secondary" onClick={() => void actions.cancel(p._id)}>
                  Cancel request
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Suggestions ---------------- */

export function SuggestionsPage({ profile }: { profile?: string }) {
  const suggestions = useQ(api.friends.suggestions, {});
  const { removed, remove } = useRemovedSuggestions();
  const actions = useFriendActions();
  const [outcomes, setOutcome] = useOutcomes();
  const keep = useMemo(() => new Set(Object.keys(outcomes)), [outcomes]);
  const visible = useMemo(
    () => suggestions?.filter((s) => !removed.has(s._id)),
    [suggestions, removed],
  );
  const rows = useSticky(visible, keep);
  const select = useSelect("/friends/suggestions");

  return (
    <Shell
      selected={profile}
      empty="Select people's names to preview their profile."
      rail={
        <FriendsSubRail title="Suggestions" header={<RailHeading>People you may know</RailHeading>}>
          {rows === undefined ? (
            <RowsSkeleton />
          ) : rows.length === 0 ? (
            <p className="px-2 pt-2 text-[13px] text-secondary">No suggestions right now</p>
          ) : (
            rows.map((p) => {
              const sent = outcomes[p._id] === "sent";
              return (
                <PersonRow
                  key={p._id}
                  person={p}
                  selected={profile === p.username}
                  onSelect={() => select(p.username)}
                  meta={
                    sent ? "Request sent" : p.mutualCount > 0 ? <MutualLine person={p} /> : null
                  }
                  actions={
                    sent ? (
                      <Button
                        variant="secondary"
                        className="w-[124px]"
                        onClick={() => {
                          setOutcome(p._id, null);
                          void actions.cancel(p._id);
                        }}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => {
                            setOutcome(p._id, "sent");
                            actions.add(p._id).catch(() => setOutcome(p._id, null));
                          }}
                        >
                          Add friend
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => remove(p._id)}
                        >
                          Remove
                        </Button>
                      </>
                    )
                  }
                />
              );
            })
          )}
        </FriendsSubRail>
      }
    />
  );
}

/* ---------------- All friends ---------------- */

export function AllFriendsPage({ profile }: { profile?: string }) {
  const counts = useQ(api.friends.counts, {});
  const viewer = useViewer();
  const friends = useQ(api.friends.list, { userId: viewer._id });
  const [q, setQ] = useState("");
  const select = useSelect("/friends/list");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = [...(friends ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return needle ? all.filter((f) => f.name.toLowerCase().includes(needle)) : all;
  }, [friends, q]);

  return (
    <Shell
      selected={profile}
      empty="Select people's names to preview their profile."
      rail={
        <FriendsSubRail
          title="All friends"
          header={
            <>
              <label className="mx-4 mt-3 flex h-9 items-center gap-2 rounded-full bg-input px-3">
                <Search size={16} strokeWidth={2.4} className="shrink-0 text-secondary" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search Friends"
                  aria-label="Search Friends"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
                />
              </label>
              <div className="mx-4 mt-4 h-px bg-divider" />
              <RailHeading>{counts ? plural(counts.friends, "friend") : "Friends"}</RailHeading>
            </>
          }
        >
          {friends === undefined ? (
            <RowsSkeleton />
          ) : rows.length === 0 ? (
            <p className="px-2 pt-2 text-[13px] text-secondary">
              {q ? "No results found" : "No friends to show"}
            </p>
          ) : (
            rows.map((p) => (
              <PersonRow
                key={p._id}
                person={p}
                selected={profile === p.username}
                onSelect={() => select(p.username)}
                meta={p.mutualCount > 0 ? plural(p.mutualCount, "mutual friend") : undefined}
                trailing={<FriendRowMenu person={p} />}
              />
            ))
          )}
        </FriendsSubRail>
      }
    />
  );
}

/** "…" on an All friends row: Message, Unfriend. */
function FriendRowMenu({ person }: { person: PersonCard }) {
  const actions = useFriendActions();
  const { openChat } = useChatDock();
  const getOrCreateDm = useM(api.conversations.getOrCreateDm);
  const [confirm, setConfirm] = useState(false);
  return (
    <div onClick={(e) => e.stopPropagation()} className="self-center">
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`More options for ${person.name}`} variant="ghost" size={36}>
            <MoreHorizontal size={20} className="text-secondary" />
          </IconButton>
        </MenuTrigger>
        <MenuContent width={260}>
          <MenuItem
            icon={<MessengerIcon size={20} />}
            label={`Message ${person.firstName}`}
            onSelect={async () => openChat(await getOrCreateDm({ userId: person._id }))}
          />
          <MenuItem
            icon={<PersonXGlyph size={20} />}
            label={`Unfriend ${person.firstName}`}
            onSelect={() => setConfirm(true)}
          />
        </MenuContent>
      </Menu>
      <UnfriendDialog
        open={confirm}
        onOpenChange={setConfirm}
        name={person.name}
        onConfirm={() => void actions.unfriend(person._id)}
      />
    </div>
  );
}

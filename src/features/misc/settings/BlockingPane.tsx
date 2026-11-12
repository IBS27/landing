import { ConvexError } from "convex/values";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CancelButton, Group } from "./controls";

type Person = {
  _id: Id<"users">;
  name: string;
  firstName: string;
  avatar: string;
  kind: "person" | "page";
};

type View =
  | { kind: "list" }
  | { kind: "search" }
  | { kind: "block"; person: Person; from: "list" | "search" }
  | { kind: "unblock"; person: Person; from: "list" | "search" };

/** Settings → Blocking: the blocked list, search to block, confirm dialogs. */
export function BlockingPane() {
  const blocked = useQ(api.settings.blocked, {});
  const [view, setView] = useState<View | null>(null);
  return (
    <Group>
      <div className="flex items-start gap-4 px-2 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[17px] text-primary leading-5">
            Blocked profiles and Pages
          </h3>
          <p className="pt-1 text-[15px] text-secondary leading-5">
            Once you block someone, that person can no longer see things you post on your profile,
            tag you, invite you to events or groups, start a conversation with you, or add you as a
            friend. This doesn't include apps, games or groups you both participate in.
          </p>
          <p className="pt-2 text-[15px] text-primary leading-5">
            {blocked === undefined
              ? " "
              : blocked.length === 0
                ? "You haven't blocked anyone."
                : `${blocked.length} blocked ${blocked.length === 1 ? "profile" : "profiles"}`}
          </p>
        </div>
        <Button onClick={() => setView({ kind: "list" })}>Edit</Button>
      </div>
      <BlockDialog view={view} setView={setView} />
    </Group>
  );
}

function BlockDialog({ view, setView }: { view: View | null; setView: (v: View | null) => void }) {
  // Kept here so the search survives the confirm step and Back.
  const [q, setQ] = useState("");
  const title =
    view?.kind === "search"
      ? "Block profiles"
      : view?.kind === "block"
        ? `Block ${view.person.name}?`
        : view?.kind === "unblock"
          ? `Unblock ${view.person.name}?`
          : "Blocked profiles and Pages";
  const back =
    view?.kind === "search"
      ? () => setView({ kind: "list" })
      : view?.kind === "block" || view?.kind === "unblock"
        ? () => setView({ kind: view.from })
        : undefined;
  return (
    <Modal
      open={view !== null}
      onOpenChange={(o) => !o && setView(null)}
      title={title}
      width={548}
      onBack={back}
    >
      {view?.kind === "list" && <BlockedList setView={setView} />}
      {view?.kind === "search" && <BlockSearch q={q} setQ={setQ} setView={setView} />}
      {(view?.kind === "block" || view?.kind === "unblock") && (
        <Confirm view={view} onDone={() => setView({ kind: view.from })} />
      )}
    </Modal>
  );
}

function BlockedList({ setView }: { setView: (v: View) => void }) {
  const blocked = useQ(api.settings.blocked, {});
  return (
    <div className="flex min-h-[200px] flex-col px-2 py-2">
      <button
        type="button"
        onClick={() => setView({ kind: "search" })}
        className="flex h-14 items-center gap-3 rounded-lg px-2 text-left hover:bg-hover"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn-soft">
          <Plus size={20} strokeWidth={2.5} className="text-btn-soft-text" />
        </span>
        <span className="font-medium text-[15px] text-link">Add to blocked list</span>
      </button>
      {blocked === undefined ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : blocked.length === 0 ? (
        <p className="px-2 py-8 text-center text-[15px] text-secondary">
          You haven't blocked anyone.
        </p>
      ) : (
        blocked.map((p) => (
          <PersonRow key={p._id} person={p} sub={p.kind === "page" ? "Page" : undefined}>
            <Button onClick={() => setView({ kind: "unblock", person: p, from: "list" })}>
              Unblock
            </Button>
          </PersonRow>
        ))
      )}
    </div>
  );
}

function BlockSearch({
  q,
  setQ,
  setView,
}: {
  q: string;
  setQ: (q: string) => void;
  setView: (v: View) => void;
}) {
  const results = useQ(api.settings.blockSearch, q.trim() ? { q } : "skip");
  return (
    <div className="flex min-h-[360px] flex-col px-2 py-3">
      <label className="mx-2 mb-2 flex h-10 items-center gap-2 rounded-full bg-input px-3">
        <Search size={16} strokeWidth={2.5} className="text-icon-secondary" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the dialog's only field
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name"
          aria-label="Search for a profile or Page to block"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
      </label>
      {!q.trim() ? (
        <p className="px-2 py-8 text-center text-[15px] text-secondary">
          Search for the profile or Page you want to block.
        </p>
      ) : results === undefined ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : results.length === 0 ? (
        <p className="px-2 py-8 text-center text-[15px] text-secondary">No results found</p>
      ) : (
        results.map((p) => (
          <PersonRow
            key={p._id}
            person={p}
            sub={
              p.kind === "page"
                ? "Page"
                : p.isFriend
                  ? "Friend"
                  : p.city
                    ? `Lives in ${p.city}`
                    : undefined
            }
          >
            {p.blocked ? (
              <Button onClick={() => setView({ kind: "unblock", person: p, from: "search" })}>
                Unblock
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setView({ kind: "block", person: p, from: "search" })}
              >
                Block
              </Button>
            )}
          </PersonRow>
        ))
      )}
    </div>
  );
}

function PersonRow({
  person,
  sub,
  children,
}: {
  person: Person;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 rounded-lg px-2 py-2">
      <Avatar src={person.avatar} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[15px] text-primary leading-5">
          {person.name}
        </span>
        {sub && <span className="block text-[13px] text-secondary leading-4">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

function Confirm({
  view,
  onDone,
}: {
  view: Extract<View, { kind: "block" | "unblock" }>;
  onDone: () => void;
}) {
  const block = useM(api.settings.block);
  const unblock = useM(api.settings.unblock);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = view.person;
  const first = p.kind === "page" ? p.name : p.firstName;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await (view.kind === "block" ? block : unblock)({ userId: p._id });
      onDone();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="px-4 pt-4 pb-2 text-[15px] text-primary leading-5">
        {view.kind === "block" ? (
          <>
            <p className="font-semibold">{first} will no longer be able to:</p>
            <ul className="list-disc py-2 pl-6">
              <li>See your posts on your profile</li>
              <li>Tag you</li>
              <li>Invite you to events or groups</li>
              <li>Message you</li>
              <li>Add you as a friend</li>
            </ul>
            {p.kind === "person" && (
              <p className="pb-2">If you're friends, blocking {first} will also unfriend them.</p>
            )}
            <p className="text-secondary">
              You'll also stop seeing {first}'s posts, comments and profile, and they won't show up
              in your search results or suggestions.
            </p>
          </>
        ) : (
          <>
            <p className="pb-2">
              If you unblock {first}, they may be able to see your profile or contact you, depending
              on your privacy settings.
            </p>
            <p className="text-secondary">
              If you were friends before, you'll need to add {first} as a friend again.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="pt-2 text-negative">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 px-4 pt-2 pb-4">
        <CancelButton onClick={onDone} />
        <Button variant="primary" className="min-w-[96px]" disabled={busy} onClick={run}>
          Confirm
        </Button>
      </div>
    </>
  );
}

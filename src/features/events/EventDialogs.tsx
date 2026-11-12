import { Link } from "@tanstack/react-router";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "./EventActions";

function focusOnMount(el: HTMLElement | null) {
  el?.focus();
}

const STATUS_LABEL = { going: "Going", interested: "Interested", invited: "Invited" } as const;

/** "Invite friends": searchable checkbox list → Send invitations. */
export function InviteDialog({ eventId, onClose }: { eventId: Id<"events">; onClose: () => void }) {
  const friends = useQ(api.events.inviteCandidates, { eventId });
  const invite = useM(api.events.invite);
  const toast = useToast();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<Id<"users">>>(new Set());
  const [busy, setBusy] = useState(false);
  const shown = useMemo(
    () => friends?.filter((f) => f.user.name.toLowerCase().includes(q.trim().toLowerCase())),
    [friends, q],
  );
  const toggle = (id: Id<"users">) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const send = async () => {
    setBusy(true);
    try {
      const n = await invite({ eventId, userIds: [...picked] });
      toast(n === 1 ? "Invitation sent." : `${n} invitations sent.`);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const pickedUsers = friends?.filter((f) => picked.has(f.user._id)) ?? [];

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Invite friends" width={700}>
      <div className="flex h-[min(520px,calc(100vh-200px))]">
        <div className="flex min-w-0 flex-1 flex-col border-divider border-r">
          <label className="mx-4 mt-3 mb-2 flex h-9 items-center gap-1.5 rounded-full bg-input pl-2.5 text-secondary">
            <Search size={16} strokeWidth={2.4} />
            <input
              ref={focusOnMount}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for friends by name"
              aria-label="Search for friends by name"
              className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[15px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
          <p className="px-4 pt-1 pb-1 font-semibold text-[15px] text-primary">Suggested</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {shown === undefined ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : shown.length === 0 ? (
              <p className="px-2 py-6 text-center text-[15px] text-secondary">No friends found</p>
            ) : (
              shown.map(({ user, status }) => {
                const disabled = status !== null;
                const on = picked.has(user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    disabled={disabled}
                    role="checkbox"
                    aria-checked={on || disabled}
                    aria-label={`Invite ${user.name}`}
                    onClick={() => toggle(user._id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover disabled:hover:bg-transparent"
                  >
                    <Avatar src={user.avatar} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[15px] text-primary">
                        {user.name}
                      </span>
                      {status && (
                        <span className="block text-[13px] text-secondary">
                          {STATUS_LABEL[status]}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2",
                        disabled
                          ? "border-transparent bg-btn text-disabled"
                          : on
                            ? "border-fb bg-fb text-white"
                            : "border-secondary/70",
                      )}
                    >
                      {(on || disabled) && <Check size={14} strokeWidth={3.5} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="hidden w-[260px] shrink-0 flex-col sm:flex">
          <p className="px-4 pt-4 pb-2 font-semibold text-[13px] text-secondary uppercase">
            {picked.size} friend{picked.size === 1 ? "" : "s"} selected
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {pickedUsers.map(({ user }) => (
              <div key={user._id} className="flex items-center gap-2 px-2 py-1.5">
                <Avatar src={user.avatar} size={28} />
                <span className="truncate text-[15px] text-primary">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-divider border-t px-4 py-3">
        <Button variant="ghost" className="text-link" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={picked.size === 0 || busy}
          onClick={() => void send()}
          className="min-w-[140px]"
        >
          Send Invitations
        </Button>
      </div>
    </Modal>
  );
}

type GuestTab = "going" | "interested" | "invited";

/** Guest list: Going / Interested (/ Invited for hosts). */
export function GuestsDialog({
  eventId,
  initial,
  counts,
  isHost,
  onClose,
}: {
  eventId: Id<"events">;
  initial: GuestTab;
  counts: { going: number; interested: number; invited: number };
  isHost: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<GuestTab>(initial);
  const rows = useQ(api.events.guests, { eventId, status: tab });
  const tabs: GuestTab[] = isHost ? ["going", "interested", "invited"] : ["going", "interested"];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Guests" width={548}>
      <div className="flex border-divider border-b px-4">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "relative h-[52px] px-4 font-semibold text-[15px]",
              tab === t ? "text-link" : "text-secondary hover:bg-hover",
            )}
          >
            {STATUS_LABEL[t]} {counts[t].toLocaleString("en-US")}
            {tab === t && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-fb" />
            )}
          </button>
        ))}
      </div>
      <div className="max-h-[480px] min-h-[200px] overflow-y-auto p-2">
        {rows === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-2 py-10 text-center text-[15px] text-secondary">No one to show yet.</p>
        ) : (
          rows.map(({ user, friend }) => (
            <Link
              key={user._id}
              to="/$username"
              params={{ username: user.username }}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
            >
              <Avatar src={user.avatar} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[15px] text-primary">
                  {user.name}
                </span>
                {friend && <span className="block text-[13px] text-secondary">Friend</span>}
              </span>
            </Link>
          ))
        )}
        {rows && tab !== "invited" && (
          <p className="px-2 pt-2 pb-1 text-[13px] text-secondary">
            Showing people you can see. Others who responded aren't listed.
          </p>
        )}
      </div>
    </Modal>
  );
}

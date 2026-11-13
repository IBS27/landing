import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GroupView } from "./context";
import { SearchGlyph } from "./icons";

/** "Invite friends to this group": searchable friend list with checkboxes. */
export function InviteDialog({ group, onClose }: { group: GroupView; onClose: () => void }) {
  const friends = useQ(api.groups.inviteCandidates, { groupId: group._id });
  const invite = useM(api.groups.invite);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (friends ?? []).filter((f) => !term || f.name.toLowerCase().includes(term));
  }, [friends, q]);

  const toggle = (id: Id<"users">) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Invite friends to this group"
      width={548}
      bodyClassName="flex flex-col"
    >
      <div className="px-4 pt-3">
        <label className="flex h-9 items-center gap-2 rounded-full bg-input px-3">
          <SearchGlyph size={16} className="text-icon-secondary" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the dialog exists to search friends
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for friends by name"
            aria-label="Search for friends by name"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
          />
        </label>
        <p className="mt-3 font-semibold text-[15px] text-secondary">
          {selected.size > 0 ? `${selected.size} selected` : "Suggested"}
        </p>
      </div>
      <div className="h-[360px] overflow-y-auto px-2 py-1">
        {friends === undefined ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-10 text-center text-[15px] text-secondary">No friends found</p>
        ) : (
          list.map((f) => {
            const disabled = f.state !== "none";
            const checked = selected.has(f._id);
            return (
              <button
                key={f._id}
                type="button"
                disabled={disabled}
                aria-pressed={checked || f.state === "invited"}
                onClick={() => toggle(f._id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
              >
                <Avatar src={f.avatar} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[15px] text-primary">
                    {f.name}
                  </span>
                  {disabled && (
                    <span className="block text-[13px] text-secondary">
                      {f.state === "member" ? "Already a member" : "Invite sent"}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-[4px] border-2",
                    checked
                      ? "border-fb bg-fb text-white"
                      : disabled
                        ? "border-disabled"
                        : "border-icon-secondary",
                  )}
                >
                  {(checked || f.state === "invited") && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-divider border-t p-4">
        {sent && <span className="mr-auto text-[15px] text-secondary">Invites sent</span>}
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="min-w-[120px]"
          disabled={selected.size === 0 || busy}
          onClick={() => {
            setBusy(true);
            void invite({ groupId: group._id, userIds: [...selected] })
              .then(() => {
                setSelected(new Set());
                setSent(true);
              })
              .finally(() => setBusy(false));
          }}
        >
          Send invites
        </Button>
      </div>
    </Modal>
  );
}

import { ConvexError } from "convex/values";
import { Users } from "lucide-react";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { cn, shortAge } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { useProfile } from "./context";

const NOTE_MAX = 60;

/**
 * The thought bubble over the profile picture. On your own profile it reads
 * "Share a thought..." (or your note) and opens the note editor; on a
 * friend's profile it shows their note, if they shared one in the last day.
 */
export function NoteBubble() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const [editing, setEditing] = useState(false);
  if (!isSelf && !user.note) return null;

  const text = user.note?.text;
  const bubble = (
    <>
      <span
        className={cn(
          "relative z-[1] block max-w-[180px] rounded-3xl bg-input px-4 py-4 text-left text-[12px] leading-4 shadow-[0_2px_16px_var(--shadow-1)]",
          text ? "line-clamp-3 break-words text-primary" : "text-secondary",
        )}
      >
        {text ?? "Share a thought..."}
      </span>
      {/* Tail: two shrinking circles toward the picture. */}
      <span
        aria-hidden
        className="absolute -bottom-[7px] left-[80px] h-[18px] w-[18px] rounded-full bg-input shadow-[0_2px_16px_var(--shadow-1)]"
      />
      <span
        aria-hidden
        className="absolute -bottom-[17px] left-[93px] h-2 w-2 rounded-full bg-input shadow-[0_2px_16px_var(--shadow-1)]"
      />
    </>
  );

  return (
    <div className="absolute bottom-[calc(100%-11px)] -left-[17px] z-10">
      {isSelf ? (
        <button
          type="button"
          aria-label={text ? `Your note: ${text}` : "Share a thought"}
          onClick={() => setEditing(true)}
          className="relative block transition-[filter] hover:brightness-95 dark:hover:brightness-110"
        >
          {bubble}
        </button>
      ) : (
        <div className="relative" title={`${user.firstName}'s note`}>
          {bubble}
        </div>
      )}
      {isSelf && <NoteDialog open={editing} onOpenChange={setEditing} />}
    </div>
  );
}

function NoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile } = useProfile();
  const { user } = profile;
  const setNote = useM(api.profiles.setNote);
  const [draft, setDraft] = useState(user.note?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      await setNote({ text });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Couldn't share your note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(user.note?.text ?? "");
        setError(null);
        onOpenChange(o);
      }}
      title="New note"
      width={500}
    >
      <form
        className="flex flex-col items-center px-4 pt-6 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save(draft);
        }}
      >
        <div className="flex flex-col items-center">
          <div className="relative z-[1] w-[260px]">
            <div className="relative rounded-3xl bg-input px-4 py-3 shadow-[0_2px_16px_var(--shadow-1)]">
              <textarea
                // biome-ignore lint/a11y/noAutofocus: the dialog exists to type the note
                autoFocus
                rows={1}
                maxLength={NOTE_MAX}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (draft.trim()) void save(draft);
                  }
                }}
                placeholder="Share a thought..."
                aria-label="Note"
                className="field-sizing-content block max-h-[60px] w-full resize-none bg-transparent text-center text-[15px] text-primary leading-5 outline-none placeholder:text-secondary"
              />
            </div>
            <span
              aria-hidden
              className="absolute -bottom-[7px] left-[118px] h-[18px] w-[18px] rounded-full bg-input"
            />
          </div>
          <Avatar src={user.avatar} size={112} className="-mt-1" />
        </div>
        <div className="mt-4 text-[13px] text-secondary">
          {draft.length}/{NOTE_MAX}
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-btn px-2 py-1 font-semibold text-[13px] text-primary">
          <Users size={14} strokeWidth={2.4} />
          Friends
        </div>
        <p className="mt-3 text-center text-[13px] text-secondary leading-4">
          {user.note
            ? `Shared ${sharedAgo(user.note.createdAt)}. Notes disappear after 24 hours.`
            : "Your note will be visible to your friends for 24 hours."}
        </p>
        {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
        <div className="mt-5 flex w-full gap-2">
          {user.note && (
            <Button
              type="button"
              variant="secondary"
              block
              disabled={busy}
              onClick={() => void save("")}
            >
              Delete note
            </Button>
          )}
          <Button type="submit" variant="primary" block disabled={busy || !draft.trim()}>
            Share
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function sharedAgo(ts: number) {
  const age = shortAge(ts);
  return age === "Just now" ? "just now" : `${age} ago`;
}

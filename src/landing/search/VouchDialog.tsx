import { ConvexError } from "convex/values";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { RadioList } from "@/features/misc/settings/controls";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { VOUCH_NOTE_MAX } from "../../../convex/lib/vouches";
import type { VouchRelationship } from "../../../convex/validators";
import { RELATIONSHIP_OPTIONS } from "./vouchCopy";

/** "How do you know Derek?": vouch for someone, change the vouch or withdraw it. */
export function VouchDialog({
  subject,
  current,
  onClose,
}: {
  subject: { _id: Id<"users">; firstName: string };
  /** The viewer's existing vouch, to edit or withdraw. */
  current: { relationship: VouchRelationship; note: string | null } | null;
  onClose: () => void;
}) {
  const vouch = useM(api.vouches.vouch);
  const unvouch = useM(api.vouches.unvouch);
  const [relationship, setRelationship] = useState(current?.relationship);
  const [note, setNote] = useState(current?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = note.trim().length > VOUCH_NOTE_MAX;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`How do you know ${subject.firstName}?`}
      width={500}
    >
      <div className="px-4 pt-3 pb-4">
        <p className="px-2 pb-2 text-secondary text-sm">
          Your friends and friends of friends will see that you vouch for {subject.firstName} when
          they look at {subject.firstName}'s listings.
        </p>
        <RadioList
          name="How you know them"
          options={[...RELATIONSHIP_OPTIONS]}
          value={relationship}
          onChange={setRelationship}
        />
        <label className="mt-2 block px-2">
          <span className="font-semibold text-primary text-sm">Add a note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`What should people know about ${subject.firstName}?`}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg bg-input px-3 py-2 text-base text-primary outline-none placeholder:text-placeholder"
          />
          <span
            className={cn("block text-right text-xs", tooLong ? "text-negative" : "text-secondary")}
          >
            {note.trim().length}/{VOUCH_NOTE_MAX}
          </span>
        </label>
        {error && (
          <p role="alert" className="px-2 pt-1 text-negative text-sm">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 px-2 pt-3">
          {current && (
            <Button
              variant="ghost"
              disabled={busy}
              className="mr-auto"
              onClick={() => run(() => unvouch({ userId: subject._id }))}
            >
              Remove vouch
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || !relationship || tooLong}
            onClick={() =>
              relationship &&
              run(() =>
                vouch({ userId: subject._id, relationship, note: note.trim() || undefined }),
              )
            }
          >
            {current ? "Save" : "Vouch"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

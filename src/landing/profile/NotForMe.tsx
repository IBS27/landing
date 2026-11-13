import { EyeOff } from "lucide-react";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Target =
  | { targetKind: "event"; targetId: Id<"events"> }
  | { targetKind: "group"; targetId: Id<"groups"> }
  | { targetKind: "listing"; targetId: Id<"listings"> };

/**
 * "Not for me" on a Landing Event, Group or listing card (#4). It counts against
 * the card's interests in the City Profile, and offers Undo. `onChange` lets the
 * card hide or dim itself.
 */
export function NotForMe({
  onChange,
  ...target
}: Target & { onChange?: (skipped: boolean) => void }) {
  const skip = useM(api.profileSignals.skip);
  const unskip = useM(api.profileSignals.unskip);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = (next: boolean) => {
    setBusy(true);
    const args = { targetKind: target.targetKind, targetId: target.targetId };
    (next ? skip(args) : unskip(args))
      .then(() => {
        setSkipped(next);
        onChange?.(next);
      })
      .finally(() => setBusy(false));
  };
  if (skipped)
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-secondary">
        Got it. You'll see less like this.
        <button
          type="button"
          disabled={busy}
          onClick={() => run(false)}
          className="font-semibold text-link hover:underline disabled:opacity-50"
        >
          Undo
        </button>
      </span>
    );
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => run(true)}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-semibold text-[13px] text-secondary hover:bg-hover disabled:opacity-50"
    >
      <EyeOff size={16} />
      Not for me
    </button>
  );
}

import { Link } from "@tanstack/react-router";
import { Check, Home } from "lucide-react";
import { useId, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toMyPlace } from "@/landing/links";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { placeProblem } from "../../../convex/lib/myPlace";
import { dateLabel, errorText, Field, fieldCls, todayInSF } from "./placeParts";

/**
 * "I'm taking this place" on a rental (#132): makes it the viewer's place on
 * My Place. Private: the lister isn't told.
 */
export function TakePlaceButton({
  listingId,
  availableFrom,
}: {
  listingId: Id<"listings">;
  /** When the rental is available, ms; the move-in date starts there. */
  availableFrom?: number;
}) {
  const isMine = useQ(api.myPlace.isMine, { listingId });
  const [open, setOpen] = useState(false);
  if (isMine === undefined) return null;
  if (isMine)
    return (
      <Link {...toMyPlace()}>
        <Button variant="secondary" icon={<Check size={16} />}>
          Your place
        </Button>
      </Link>
    );
  return (
    <>
      <Button variant="secondary" icon={<Home size={16} />} onClick={() => setOpen(true)}>
        I'm taking this place
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Make this your place">
        {open && (
          <TakeForm
            listingId={listingId}
            availableFrom={availableFrom}
            done={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function TakeForm({
  listingId,
  availableFrom,
  done,
}: {
  listingId: Id<"listings">;
  availableFrom?: number;
  done: () => void;
}) {
  const id = useId();
  const take = useM(api.myPlace.takeListing);
  const mine = useQ(api.myPlace.mine, {});
  const today = todayInSF();
  const available = availableFrom ? todayInSF(availableFrom) : today;
  // The later of the day it's available and today. "YYYY-MM-DD" sorts as dates.
  const [moveIn, setMoveIn] = useState([available, today].sort()[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = placeProblem({ status: "moving_in", moveIn }, today);
  const current = mine?.current;
  const replaces = current
    ? (current.listing?.title ?? `your place in ${current.neighborhood?.name ?? "San Francisco"}`)
    : null;

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await take({ listingId, moveIn });
          done();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[15px] text-secondary leading-5">
        It goes on My Place, and your rooms, 3D unit and City Profile start from it. Only you can
        see it. The lister isn't told.
      </p>
      <Field id={`${id}-in`} label="Move-in date" hint={`Available ${dateLabel(available)}`}>
        <input
          id={`${id}-in`}
          type="date"
          required
          className={fieldCls}
          value={moveIn}
          onChange={(e) => setMoveIn(e.target.value)}
        />
      </Field>
      {replaces && (
        <p className="text-[13px] text-secondary leading-4">
          This replaces {replaces}
          {current?.status === "moving_in" ? "." : ", which moves to places you've left."}
        </p>
      )}
      {(problem || error) && (
        <p role="alert" className="text-[13px] text-negative">
          {error ?? problem}
        </p>
      )}
      <div className="flex justify-end border-divider border-t pt-4">
        <Button type="submit" variant="primary" disabled={busy || !!problem}>
          {busy ? "Saving…" : "Make it my place"}
        </Button>
      </div>
    </form>
  );
}

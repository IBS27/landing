import { Link } from "@tanstack/react-router";
import { Check, Home } from "lucide-react";
import { useId, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toMyPlace } from "@/landing/links";
import { Modal } from "@/ui/overlays";
import { Button, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { placeProblem } from "../../../convex/lib/placeRules";
import { dateLabel, defaultMoveIn, errorText, Field, fieldCls, todayInSF } from "./placeParts";

/**
 * "I'm taking this place" on a rental (#132): makes it the viewer's place on
 * My Place. Private: the lister isn't told.
 */
export function TakePlaceCard({
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
  return (
    <Card className="p-4">
      {isMine ? (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
            <Check size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[17px] text-primary leading-5">This is your place</h2>
            <Link {...toMyPlace()} className="text-[13px] text-link hover:underline">
              Go to My Place
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-bold text-[17px] text-primary leading-5">Taking this place?</h2>
          <p className="mt-1 text-[13px] text-secondary leading-4">
            Add it to My Place. Only you can see it.
          </p>
          <Button
            variant="soft"
            block
            className="mt-3"
            icon={<Home size={16} />}
            onClick={() => setOpen(true)}
          >
            I'm taking this place
          </Button>
        </>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Make this your place">
        {open && (
          <TakeForm
            listingId={listingId}
            availableFrom={availableFrom}
            done={() => setOpen(false)}
          />
        )}
      </Modal>
    </Card>
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
  const [moveIn, setMoveIn] = useState(() => defaultMoveIn({ today, available }));
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

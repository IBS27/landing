import { useId, useState } from "react";
import { useM } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type NeighborhoodSlug, SF_NEIGHBORHOODS } from "../../../convex/lib/cityProfileFacts";
import { PLACE_STATUSES, type PlaceStatus, placeProblem } from "../../../convex/lib/placeRules";
import { errorText, Field, fieldCls, todayInSF } from "./placeParts";

const HOODS = SF_NEIGHBORHOODS.filter((n) => !("park" in n && n.park)).sort((a, b) =>
  a.name.localeCompare(b.name),
);

/** The current place, as the edit form needs it. */
export type EditablePlace = {
  _id: Id<"places">;
  status: PlaceStatus;
  moveIn: string;
  moveOut: string | null;
  neighborhood: { slug: string } | null;
  /** Taken from a listing: its neighborhood comes from there. */
  fromListing: boolean;
};

/**
 * "Add the place I found" (no `place`) or edit the current place. A found
 * place is only a neighborhood and a move-in date: no address.
 */
export function PlaceForm({
  place,
  open,
  onOpenChange,
}: {
  place?: EditablePlace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={place ? "Edit your place" : "Add the place you found"}
    >
      {open && <FormBody place={place} done={() => onOpenChange(false)} />}
    </Modal>
  );
}

function FormBody({ place, done }: { place?: EditablePlace; done: () => void }) {
  const id = useId();
  const addFound = useM(api.myPlace.addFound);
  const update = useM(api.myPlace.update);
  const remove = useM(api.myPlace.remove);
  const today = todayInSF();
  const [neighborhood, setNeighborhood] = useState(place?.neighborhood?.slug ?? "");
  const [status, setStatus] = useState<PlaceStatus>(place?.status ?? "moving_in");
  const [moveIn, setMoveIn] = useState(place?.moveIn ?? today);
  const [moveOut, setMoveOut] = useState(place?.moveOut ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leaving = status === "moving_out" || status === "moved_out";
  const problem =
    !place?.fromListing && !neighborhood
      ? "Pick the neighborhood your place is in"
      : placeProblem({ status, moveIn, moveOut: leaving && moveOut ? moveOut : undefined }, today);
  // Moved out with no date means today; the server fills it in.
  const leftToday = status === "moved_out" && !moveOut && problem === "Add the day you moved out";
  const blocking = leftToday ? null : problem;
  // Nothing chosen yet isn't a mistake: Save just waits for a neighborhood.
  const shown = !place && !neighborhood ? null : blocking;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      done();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const slug = (neighborhood || undefined) as NeighborhoodSlug | undefined;
    if (!place) return run(() => addFound({ neighborhood: slug as NeighborhoodSlug, moveIn }));
    return run(() =>
      update({
        placeId: place._id,
        status,
        moveIn,
        moveOut: leaving && moveOut ? moveOut : null,
        ...(place.fromListing || slug === place.neighborhood?.slug ? {} : { neighborhood: slug }),
      }),
    );
  }

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {!place && (
        <p className="text-[15px] text-secondary leading-5">
          Found a place outside Landing? Add its neighborhood and when you move in. Landing doesn't
          ask for the address.
        </p>
      )}
      {!place?.fromListing && (
        <Field id={`${id}-n`} label="Neighborhood">
          <select
            id={`${id}-n`}
            className={fieldCls}
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
          >
            <option value="" disabled>
              Choose a neighborhood
            </option>
            {HOODS.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {place && (
        <Field id={`${id}-s`} label="Status">
          <select
            id={`${id}-s`}
            className={fieldCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as PlaceStatus)}
          >
            {PLACE_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-in`} label="Move-in date">
          <input
            id={`${id}-in`}
            type="date"
            required
            className={fieldCls}
            value={moveIn}
            onChange={(e) => setMoveIn(e.target.value)}
          />
        </Field>
        {place && leaving && (
          <Field
            id={`${id}-out`}
            label="Move-out date"
            hint={
              status === "moved_out" && !moveOut ? "Leave it empty if it was today." : undefined
            }
          >
            <input
              id={`${id}-out`}
              type="date"
              className={fieldCls}
              value={moveOut}
              onChange={(e) => setMoveOut(e.target.value)}
            />
          </Field>
        )}
      </div>
      {(shown || error) && (
        <p role="alert" className="text-[13px] text-negative">
          {error ?? shown}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-divider border-t pt-4">
        {place &&
          (confirmRemove ? (
            <span className="flex items-center gap-2">
              <span className="text-[13px] text-secondary">Remove this place?</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => remove({ placeId: place._id }))}
              >
                Remove
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
              Remove place
            </Button>
          ))}
        <Button type="submit" variant="primary" className="ml-auto" disabled={busy || !!blocking}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

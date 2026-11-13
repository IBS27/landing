import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { UnitSources } from "./UnitSources";
import { UnitWorkspace } from "./UnitWorkspace";

export type UnitSearch = {
  unit?: string;
  room?: string;
  listing?: string;
  /** An owned item or listing to have ready to place (#131). */
  placeItem?: string;
  placeListing?: string;
};
type Place = Pick<UnitSearch, "placeItem" | "placeListing">;
export function UnitPage({ unit, room, listing, placeItem, placeListing }: UnitSearch) {
  const place = { placeItem, placeListing };
  return (
    <LandingPage
      title="Explore your unit"
      description="Walk through the layout, check the source material, and try furniture in your space."
      width="wide"
    >
      {unit ? (
        <SavedUnit key={unit} id={unit as Id<"unitScenes">} place={place} />
      ) : (
        <StartUnit room={room} listing={listing} place={place} />
      )}
    </LandingPage>
  );
}
function StartUnit({ room, listing, place }: UnitSearch & { place: Place }) {
  const create = useM(api.unitScenes.create),
    mine = useQ(api.unitScenes.mine, {});
  // A room that already has a unit opens it directly, keeping any item to place.
  const existing = useQ(api.unitItems.unitForRoom, room ? { roomId: room as Id<"rooms"> } : "skip");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { placeItem, placeListing } = place;
  useEffect(() => {
    if (existing)
      void navigate({
        to: "/landing/place/unit",
        search: { unit: existing, placeItem, placeListing },
        replace: true,
      });
  }, [existing, navigate, placeItem, placeListing]);
  if (room && existing !== null)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  async function start() {
    setBusy(true);
    try {
      const unit = await create({
        roomId: room as Id<"rooms"> | undefined,
        listingId: listing as Id<"listings"> | undefined,
      });
      await navigate({ to: "/landing/place/unit", search: { unit, ...place } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open unit");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-start gap-3 p-4">
        <h2 className="font-bold text-[17px] text-primary leading-5">
          Build a layout you can explore
        </h2>
        <p className="-mt-1.5 text-[15px] text-secondary leading-5">
          Start with your room or listing photos, add a floor plan, and let Muse suggest a layout.
          You can also enter measurements manually.
        </p>
        <Button variant="primary" disabled={busy} onClick={start}>
          {busy
            ? "Opening…"
            : listing
              ? "Use this listing"
              : room
                ? "Use your room scan"
                : "Create a unit"}
        </Button>
        {error && (
          <p role="alert" className="text-[13px] text-negative">
            {error}
          </p>
        )}
      </Card>
      {mine && mine.length > 0 && (
        <Card className="overflow-hidden py-1">
          {mine.map((item) => (
            <Link
              key={item.id}
              to="/landing/place/unit"
              search={{ unit: item.id }}
              className="flex items-center gap-3 px-4 py-2.5 font-semibold text-[15px] text-primary hover:bg-hover"
            >
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
function SavedUnit({ id, place }: { id: Id<"unitScenes">; place: Place }) {
  const pick = place.placeItem
    ? { ownedItemId: place.placeItem as Id<"ownedItems"> }
    : place.placeListing
      ? { listingId: place.placeListing as Id<"listings"> }
      : undefined;
  const doc = useQ(api.unitScenes.get, { id }),
    items = useQ(api.unitItems.picker, { id, pick });
  const save = useM(api.unitScenes.save),
    generate = useM(api.unitScenes.requestGeneration),
    accept = useM(api.unitScenes.acceptCandidate);
  const job = useQ(api.ai.jobs.get, doc?.jobId ? { jobId: doc.jobId } : "skip");
  const ai = useQ(api.ai.status.get, {});
  if (!doc)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  return (
    <UnitWorkspace
      doc={doc}
      job={job}
      aiEnabled={!!ai?.enabled}
      onGenerate={(detailsOnly) => generate({ id, revision: doc.revision, detailsOnly })}
      onAccept={() => accept({ id, revision: doc.revision })}
      onSave={(draft, revision) => save({ id, revision, ...draft })}
      items={items?.entries}
      placing={!!pick}
      pick={items?.picked ?? undefined}
      pickMissing={!!pick && items?.picked === null}
      sources={<UnitSources doc={doc} />}
    />
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { UnitSources } from "./UnitSources";
import { UnitWorkspace } from "./UnitWorkspace";

export type UnitSearch = { unit?: string; room?: string; listing?: string };
export function UnitPage({ unit, room, listing }: UnitSearch) {
  return (
    <LandingPage
      title="Explore your unit"
      description="Walk through the layout, check the source material, and try furniture in your space."
      className="max-w-[1400px]"
    >
      {unit ? (
        <SavedUnit key={unit} id={unit as Id<"unitScenes">} />
      ) : (
        <StartUnit room={room} listing={listing} />
      )}
    </LandingPage>
  );
}
function StartUnit({ room, listing }: UnitSearch) {
  const create = useM(api.unitScenes.create),
    mine = useQ(api.unitScenes.mine, {});
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setBusy(true);
    try {
      const unit = await create({
        roomId: room as Id<"rooms"> | undefined,
        listingId: listing as Id<"listings"> | undefined,
      });
      await navigate({ to: "/landing/place/unit", search: { unit } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open unit");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <h2 className="font-bold text-lg text-primary">Build a layout you can explore</h2>
        <p className="text-secondary">
          Start with your room or listing photos, add a floor plan, and let Muse suggest a layout.
          You can also enter measurements manually.
        </p>
        <Button disabled={busy} onClick={start}>
          {busy
            ? "Opening…"
            : listing
              ? "Use this listing"
              : room
                ? "Use your room scan"
                : "Create a unit"}
        </Button>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </Card>
      {mine?.map((item) => (
        <Link
          key={item.id}
          to="/landing/place/unit"
          search={{ unit: item.id }}
          className="block rounded-lg border border-divider bg-card p-4 font-semibold text-primary hover:bg-hover"
        >
          {item.title}
        </Link>
      ))}
    </div>
  );
}
function SavedUnit({ id }: { id: Id<"unitScenes"> }) {
  const doc = useQ(api.unitScenes.get, { id }),
    saved = useQ(api.listings.saved, {});
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
      items={saved
        ?.filter((item) => !item.rental)
        .map((item) => ({ id: item._id, title: item.title }))}
      sources={<UnitSources doc={doc} />}
    />
  );
}

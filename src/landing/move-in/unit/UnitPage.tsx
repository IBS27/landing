import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { UnitEditor } from "./UnitEditor";
import { UnitSources } from "./UnitSources";

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
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  if (!doc)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  const running = job?.status === "queued" || job?.status === "running";
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-bold text-primary">{doc.scene.title}</h2>
          <p className="text-secondary text-sm">
            {running
              ? (job?.progress?.label ?? "Queued")
              : (doc.explanation ??
                "Generate a preview from your source material. Save edits before generating.")}
          </p>
          {ai && !ai.enabled && (
            <p className="text-secondary text-sm">
              Muse is off. Manual layout and furniture placement still work.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || running || !doc.sources.length || !ai?.enabled}
            onClick={() => run(() => generate({ id, revision: doc.revision }))}
          >
            {running ? "Generating…" : "Generate with Muse"}
          </Button>
          {doc.candidate && (
            <>
              <Button variant="secondary" onClick={() => setPreview(!preview)}>
                {preview ? "Close preview" : "Review generated layout"}
              </Button>
              <Button
                onClick={() =>
                  run(async () => {
                    await accept({ id, revision: doc.revision });
                    setPreview(false);
                  })
                }
              >
                Apply generated layout
              </Button>
            </>
          )}
        </div>
      </Card>
      {(error || job?.status === "failed") && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800 text-sm">
          {error || job?.error}
        </p>
      )}
      {preview && doc.candidate && (
        <Card className="p-4">
          <p className="mb-3 font-semibold text-primary">
            Generated preview. Applying it keeps your placed items; check them against the new
            walls.
          </p>
          <UnitEditor
            key={`candidate-${doc.runId}`}
            initial={{ scene: doc.candidate, placements: [] }}
            revision={0}
          />
        </Card>
      )}
      <UnitEditor
        initial={{ scene: doc.scene, placements: doc.placements }}
        revision={doc.revision}
        onSave={(draft, revision) => save({ id, revision, ...draft })}
        items={saved
          ?.filter((item) => !item.rental)
          .map((item) => ({ id: item._id, title: item.title }))}
        sidebar={<UnitSources doc={doc} />}
      />
    </div>
  );
}

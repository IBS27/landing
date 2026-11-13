import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { Button, Card, Spinner } from "@/ui/primitives";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { isStarterScene } from "../../../../convex/lib/unitGeneration";
import type { PickerItem } from "./ItemPicker";
import { type UnitDraft, UnitEditor } from "./UnitEditor";

type Job = {
  status: string;
  progress: { label: string; done: number; total: number } | null;
  error: string | null;
};
export function UnitWorkspace({
  doc,
  job,
  aiEnabled,
  onGenerate,
  onAccept,
  onSave,
  items,
  placing = false,
  pick,
  pickMissing,
  sources,
}: {
  doc: Doc<"unitScenes">;
  job?: Job | null;
  aiEnabled: boolean;
  onGenerate: (detailsOnly: boolean) => Promise<unknown>;
  onAccept: () => Promise<unknown>;
  onSave: (draft: UnitDraft, revision: number) => Promise<number>;
  /** What can be placed (#131); undefined while loading. */
  items?: PickerItem[];
  /** Opened from "Place in my room": skip the starter screen so the picker shows. */
  placing?: boolean;
  /** Picker key to start with, once resolved. */
  pick?: string;
  /** The linked item can't be placed. */
  pickMissing?: boolean;
  sources: ReactNode;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [manual, setManual] = useState(placing);
  // A linked pick opens the editable saved layout, not a generated preview.
  const [showSaved, setShowSaved] = useState(placing);
  const running =
    job?.status === "queued" ||
    job?.status === "running" ||
    (job === undefined &&
      (doc.generation?.status === "layout" || doc.generation?.status === "details"));
  const failed = job?.status === "failed" || doc.generation?.status === "failed";
  const partial = doc.generation?.status === "partial";
  const preview = !!doc.candidate && !showSaved && !dirty;
  const scene = preview ? doc.candidate! : doc.scene;
  const starter =
    isStarterScene(scene) && !doc.manuallyEdited && !doc.placements.length && (!manual || running);
  const plan = doc.sources.find((s) => s.kind === "floorplan" && s.url);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-1.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 className="min-w-0 font-bold text-[17px] text-primary leading-5">
            {doc.scene.title}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || running || dirty || !doc.sources.length || !aiEnabled}
              onClick={() => {
                setShowSaved(false);
                void run(() => onGenerate(partial));
              }}
            >
              {running
                ? "Generating…"
                : partial
                  ? "Retry missing details"
                  : failed
                    ? "Retry generation"
                    : isStarterScene(doc.scene)
                      ? "Generate with Muse"
                      : "Regenerate apartment"}
            </Button>
            {doc.candidate && (
              <>
                <Button
                  variant="secondary"
                  disabled={dirty}
                  onClick={() => setShowSaved(!showSaved)}
                >
                  {showSaved ? "View generated layout" : "View saved layout"}
                </Button>
                <Button
                  variant="primary"
                  disabled={busy || running || dirty}
                  onClick={() => run(onAccept)}
                >
                  Use generated layout
                </Button>
              </>
            )}
          </div>
        </div>
        <p role="status" aria-live="polite" className="text-[13px] text-secondary leading-[18px]">
          {running
            ? (job?.progress?.label ?? "Building your apartment…")
            : partial
              ? "Your layout is ready. Some details could not be added; you can retry them."
              : failed
                ? "Generation could not finish. Your saved layout is preserved."
                : doc.candidate
                  ? "Generated preview. Your saved edits are preserved until you use this layout."
                  : !starter
                    ? "Your apartment is saved. Explore it below."
                    : "Generate your apartment from these photos and floor plan."}
        </p>
        {dirty && (
          <p className="text-[13px] text-secondary leading-[18px]">
            Save your edits before generating or switching layouts.
          </p>
        )}
        {!aiEnabled && (
          <p className="text-[13px] text-secondary leading-[18px]">
            Muse is off. Manual layout and furniture placement still work.
          </p>
        )}
        {doc.explanation && (
          <details className="text-[13px] text-secondary leading-[18px]">
            <summary className="cursor-pointer font-semibold hover:underline">
              Generation details
            </summary>
            <p className="mt-1.5">{doc.explanation}</p>
          </details>
        )}
      </Card>
      {(error || failed) && (
        <p
          role="alert"
          className="rounded-lg bg-card p-3 text-[15px] text-negative leading-5 shadow-base"
        >
          {error || job?.error || doc.explanation || "Please retry generation."}
        </p>
      )}
      {starter ? (
        <>
          <Card className="flex min-h-[480px] flex-col items-center justify-center gap-3 p-6">
            {running && <Spinner />}
            <p className="font-semibold text-[17px] text-primary leading-5">
              {running ? "Building your apartment…" : "Your source floor plan"}
            </p>
            {plan ? (
              <img
                className="max-h-80 max-w-full rounded-lg object-contain"
                src={plan.url}
                alt={plan.label}
              />
            ) : (
              <p className="text-[15px] text-secondary">
                Add a floor plan or room photos to get started.
              </p>
            )}
            <p className="max-w-lg text-center text-[13px] text-secondary leading-[18px]">
              Rooms appear here as soon as they’re ready. Finishes and fixtures follow
              automatically.
            </p>
            <Button variant="secondary" disabled={running} onClick={() => setManual(true)}>
              Enter dimensions manually
            </Button>
          </Card>
          {sources}
        </>
      ) : (
        <ViewerBoundary key={doc._id} jobId={doc.jobId}>
          <UnitEditor
            jobId={doc.jobId}
            initial={{ scene, placements: doc.placements }}
            revision={doc.revision}
            viewKey={preview ? "generated" : "saved"}
            onDirtyChange={setDirty}
            onSave={preview || running ? undefined : onSave}
            items={items}
            pick={pick}
            pickMissing={pickMissing}
            sidebar={sources}
          />
        </ViewerBoundary>
      )}
    </div>
  );
}

class ViewerBoundary extends Component<
  { children: ReactNode; jobId?: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unit viewer failed", {
      jobId: this.props.jobId,
      error,
      componentStack: info.componentStack,
    });
  }
  render() {
    return this.state.failed ? (
      <Card className="space-y-3 p-4">
        <p role="alert" className="text-[15px] text-primary">
          The viewer could not open. Your saved apartment is safe.
        </p>
        <Button onClick={() => this.setState({ failed: false })}>Retry viewer</Button>
      </Card>
    ) : (
      this.props.children
    );
  }
}

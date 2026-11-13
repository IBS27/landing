/** Development-only experiment page. Uses the production editor, no shared backend. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { v } from "convex/values";
import "../../src/styles.css";
import { UnitEditor, type UnitDraft } from "../../src/landing/move-in/unit/UnitEditor";
import { Button, Card } from "../../src/ui/primitives";
import { checkValue } from "../../convex/ai/outputSchema";
import { unitScene, placement } from "../../convex/lib/unitScene";
import result from "./heathmead.result.json";
import videoResult from "./heathmead-video.result.json";
import detailedResult from "./heathmead-detailed.result.json";
import fixture from "./heathmead.sources.json";

const variants = { photos: result, video: videoResult, detailed: detailedResult };
type Variant = keyof typeof variants;
const storageKey = "landing:unit-experiment:v2";
const validator = v.object({
  variant: v.union(v.literal("photos"), v.literal("video"), v.literal("detailed")),
  draft: v.object({ scene: unitScene, placements: v.array(placement) }),
});
for (const value of Object.values(variants))
  if (checkValue(unitScene, value.output.scene).errors.length)
    throw new Error("Invalid experiment scene");
const original = (variant: Variant): UnitDraft => ({
  scene: variants[variant].output.scene as UnitDraft["scene"],
  placements: [],
});
function restore(): { variant: Variant; draft: UnitDraft } {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!checkValue(validator, value).errors.length)
      return value as { variant: Variant; draft: UnitDraft };
  } catch {
    /* A blocked or full browser store does not prevent exploring the fixture. */
  }
  return { variant: "detailed", draft: original("detailed") };
}
function App() {
  const [saved] = useState(restore);
  const [epoch, setEpoch] = useState(0);
  const [variant, setVariant] = useState<Variant>(saved.variant);
  const [initial, setInitial] = useState(saved.draft);
  const load = (next: Variant) => {
    setVariant(next);
    setInitial(original(next));
    setEpoch((n) => n + 1);
  };
  return (
    <main className="min-h-screen bg-wash p-4 text-primary sm:p-8">
      <div className="mx-auto max-w-[1250px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-link text-sm">LANDING · RECONSTRUCTION EXPERIMENT</p>
            <h1 className="mt-1 font-bold text-2xl">Great Heathmead, Haywards Heath</h1>
            <p className="mt-2 text-secondary">
              Muse Wonder · 12 photos + floor plan
              {variant !== "photos" ? " + 134-second video" : ""}
              {variant === "detailed"
                ? ` · ${detailedResult.output.scene.appearance.objects.length} observed fixtures`
                : " · 8 spaces"}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              localStorage.removeItem(storageKey);
              load(variant);
            }}
          >
            Reset to Muse output
          </Button>
        </header>
        <Card className="space-y-2 p-4">
          <p>
            Explore the listing in 3D, walk into each room, or compare the generated plan with the
            original below. Room coordinates and fixtures are Muse's output without hand
            corrections.
          </p>
          <p className="text-secondary text-sm">
            The plan has no dimensions, so scale is estimated. Finishes and fixtures are
            photo-informed approximations, not a captured scan. Edits on this review page save in
            this browser.
          </p>
          <div className="flex gap-4">
            <a
              href={fixture.listingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-link underline"
            >
              Original listing
            </a>
            <a
              href="https://www.youtube.com/watch?v=UHonGRH6n1o"
              target="_blank"
              rel="noreferrer"
              className="text-link underline"
            >
              Source walkthrough video
            </a>
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["detailed", "Load detailed reconstruction"],
              ["video", "Load video-assisted model"],
              ["photos", "Load photo baseline"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant={variant === id ? "primary" : "secondary"}
              onClick={() => load(id)}
            >
              {label}
            </Button>
          ))}
          <p className="self-center text-secondary text-sm">
            Loading a result replaces unsaved edits.
          </p>
        </div>
        <UnitEditor
          key={epoch}
          initial={initial}
          revision={0}
          onSave={async (draft) => {
            localStorage.setItem(storageKey, JSON.stringify({ variant, draft }));
            return 0;
          }}
          sidebar={
            <Card className="p-4">
              <h2 className="mb-3 font-bold text-lg">Source floor plan</h2>
              <a href={fixture.sources[0].url} target="_blank" rel="noreferrer">
                <img
                  src={fixture.sources[0].url}
                  alt="Original agent floor plan showing lounge, two bedrooms, kitchen, hall and bathroom"
                  className="w-full rounded-lg"
                />
              </a>
            </Card>
          }
        />
        <Card className="p-4">
          <h2 className="mb-3 font-bold text-lg">Listing photos read by Muse</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {fixture.sources.slice(1).map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noreferrer">
                <img
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                  src={s.url}
                  alt={s.label}
                />
                <p className="mt-1 text-secondary text-xs">{s.key}</p>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

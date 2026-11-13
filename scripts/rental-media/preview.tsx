/** Development-only review of the production gallery. No shared backend writes. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import units from "../../convex/seed/rentalMedia.json";
import { rentalSources } from "../../convex/lib/rentalMedia";
import { UnitEditor } from "../../src/landing/move-in/unit/UnitEditor";
import type { UnitScene } from "../../convex/lib/unitScene";
import { ListingGallery } from "../../src/features/marketplace/ListingGallery";

const results = import.meta.glob<{ output: { scene: UnitScene; explanation: string } }>("./reconstruction/*.result.json", { eager: true, import: "default" });

function App() {
  const [slug, setSlug] = useState(units[1].slug);
  const unit = units.find((u) => u.slug === slug)!;
  const [sources, setSources] = useState(false);
  const [model, setModel] = useState(false);
  const result = results[`./reconstruction/${slug}.appearance.result.json`] ?? results[`./reconstruction/${slug}.result.json`];
  return (
    <main className="min-h-screen bg-wash text-primary">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="font-bold text-xl">SF rental evidence review</h1>
          <p className="text-sm text-secondary">Real units. Fictional demo terms. No shared backend writes.</p>
        </div>
        <label className="text-sm">Reference unit
          <select className="ml-3 rounded border border-divider bg-card p-2" value={slug} onChange={(e) => { setSlug(e.target.value); setModel(false); }}>
            {units.map((u) => <option key={u.slug} value={u.slug}>{u.address}</option>)}
          </select>
        </label>
      </header>
      {model && result ? (
        <section className="space-y-4 p-5">
          <button type="button" className="rounded-lg bg-btn px-4 py-2 font-semibold" onClick={() => setModel(false)}>Back to listing photos</button>
          <h2 className="font-bold text-xl">Muse reconstruction · {unit.address}</h2>
          <p>Unedited model output. Compare with the published plan and photos. No shared backend writes.</p>
          {result.output.explanation && <p className="text-secondary">{result.output.explanation}</p>}
          <UnitEditor key={slug} initial={{ scene: result.output.scene, placements: [] }} revision={0} />
        </section>
      ) : <div className="flex h-[calc(100vh-100px)] min-h-[550px]">
        <ListingGallery key={slug} title={unit.address} photos={unit.media.photos.map((p) => p.url)} rentalMedia={unit.media} video={null} />
        <aside className="w-80 shrink-0 space-y-4 overflow-y-auto bg-card p-5">
          <h2 className="font-bold text-xl">{unit.address}</h2>
          <p>{unit.bedrooms ? `${unit.bedrooms} bedrooms` : "Studio"} · {unit.bathrooms} bath · {unit.sqft} sq ft</p>
          <p>{unit.media.photos.length} photos and a dimensioned published floor plan from the same unit.</p>
          {result?.output.scene && <button type="button" className="rounded-lg bg-btn px-4 py-2 font-semibold" onClick={() => setModel(true)}>Open generated model</button>}
          <button type="button" className="rounded-lg bg-btn-primary px-4 py-2 font-semibold text-white" onClick={() => setSources(!sources)}>Inspect 3D inputs</button>
          {sources && <ol className="space-y-2 text-sm">{rentalSources(unit.media).map((s) => <li key={s.key}><a className="text-link underline" href={s.url} target="_blank" rel="noreferrer">{s.kind} · {s.label}</a></li>)}</ol>}
          <p className="text-secondary text-sm">This page uses the production listing gallery and source mapping with the committed seed fixtures.</p>
        </aside>
      </div>}
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());

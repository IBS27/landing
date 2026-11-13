/** Browser proof of the production workspace against isolated production handlers. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ComponentProps } from "react";
import { UnitWorkspace } from "../../src/landing/move-in/unit/UnitWorkspace";
import { Button } from "../../src/ui/primitives";
import "../../src/styles.css";
type Props = ComponentProps<typeof UnitWorkspace>;
type State = Pick<Props, "doc" | "job">;
async function call<T>(path: string, args?: unknown): Promise<T> {
  const response = await fetch(`/__unit-proof/${path}`, { method: args ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: args ? JSON.stringify(args) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
function App() {
  const [state, setState] = useState<State>();
  const [epoch, setEpoch] = useState(0);
  const [scenario, setScenario] = useState("success");
  useEffect(() => {
    let alive = true;
    const update = () => call<State>("state").then((s) => { if (alive) setState(s); });
    void update(); const timer = setInterval(update, 250);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  async function reset() { setState(await call<State>("reset", { scenario })); setEpoch((n) => n + 1); }
  return <main className="mx-auto max-w-[1250px] space-y-5 p-6 text-primary">
    <h1 className="font-bold text-2xl">Unit generation · isolated browser proof</h1>
    <p>Production UI and handlers; recorded Muse responses. This page never writes to shared Convex.</p>
    <div className="flex gap-3">
      <select aria-label="Fixture scenario" value={scenario} onChange={(e) => { setScenario(e.target.value); void call("scenario", { scenario: e.target.value }); }}>
        <option value="success">Success</option><option value="layout-failure">Layout failure</option><option value="details-failure">Details failure</option>
      </select>
      <Button variant="secondary" onClick={reset}>Reset fixture</Button>
    </div>
    {state && <UnitWorkspace key={epoch} {...state} aiEnabled
      onGenerate={(detailsOnly) => call("generate", { detailsOnly })}
      onAccept={() => call("accept", {})}
      onSave={(draft, revision) => call<number>("save", { ...draft, revision })}
      sources={<p className="text-secondary">Source evidence: a published plan and twelve listing photos.</p>} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);

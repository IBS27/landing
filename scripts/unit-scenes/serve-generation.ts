/** Isolated browser proof: production handlers and UI, recorded Muse replies, no live deployment. */
import { createServer } from "vite";
import config from "../../vite.config";
import { generationHarness, generationLayout, generationAppearance, modelCompletion, invoke } from "../../tests/unitGenerationHarness";
import { save } from "../../convex/unitScenes";
import fixture from "./heathmead.sources.json";

process.env.MODEL_API_KEY = "isolated-browser-proof";
process.env.AI_ENABLED = "true";
let h = generationHarness();
let scenario = "success";
let active: Promise<unknown> | undefined;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url) !== "https://api.meta.ai/v1/chat/completions") return originalFetch(url, init);
  const body = JSON.parse(String(init?.body)) as { messages: { content: unknown }[] };
  const appearance = JSON.stringify(body.messages).includes("Reconstruct the visible APPEARANCE");
  await new Promise((r) => setTimeout(r, appearance ? 8000 : 2500));
  return modelCompletion(appearance
    ? { appearance: scenario === "details-failure" ? null : generationAppearance, explanation: "Recorded photo-derived details" }
    : { scene: scenario === "layout-failure" ? null : generationLayout, explanation: "Recorded floor-plan geometry" });
}) as typeof fetch;
const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? 5173);
const server = await createServer({ ...config, configFile: false, server: { host, port, strictPort: true },
  plugins: [...(config.plugins ?? []), { name: "isolated-unit-proof", configureServer(vite) {
    vite.middlewares.use("/__unit-proof", async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const args = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        if (req.url === "/reset") {
          if (active) throw new Error("Wait for the current fixture run to finish");
          h = generationHarness(); scenario = args.scenario ?? "success";
        } else if (req.url === "/generate") {
          const id = await h.request(!!args.detailsOnly);
          if (!active) {
            active = h.generate().finally(() => { active = undefined; });
          }
          res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(id)); return;
        } else if (req.url === "/save") {
          const revision = await invoke(save, h.ctx, { ...args, id: "unit", viewerId: "viewer" });
          res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(revision)); return;
        } else if (req.url === "/accept") await h.accept();
        else if (req.url === "/scenario") scenario = args.scenario;
        const doc = structuredClone(h.scene());
        doc.sources = doc.sources.map((s) => ({ ...s, url: fixture.sources.find((f) => f.key === s.key)?.url ?? s.url }));
        const job = h.tables.aiJobs.find((j) => j._id === doc.jobId);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ doc, job: job ? { ...job, progress: job.progress ?? null, error: job.error ?? null } : null }));
      } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: String(error) })); }
    });
  } }],
});
await server.listen();
console.log(`Isolated unit-generation proof: http://${host}:${port}/scripts/unit-scenes/generation.html`);

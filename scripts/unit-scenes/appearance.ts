/** Enrich an existing validated layout with real Muse inference; no deployment writes. */
import { readFile, writeFile } from "node:fs/promises";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ActionCtx } from "../../convex/_generated/server";
import type { Id } from "../../convex/_generated/dataModel";
import { runAgent } from "../../convex/ai/agent";
import { unitAppearanceTask } from "../../convex/lib/unitAppearanceTask";
import { sceneProblems, type SceneSource, type UnitScene } from "../../convex/lib/unitScene";
import { checkValue } from "../../convex/ai/outputSchema";
import { unitScene } from "../../convex/lib/unitScene";

const [sourceFile, layoutFile, outputFile] = process.argv.slice(2);
if (!sourceFile || !layoutFile || !outputFile || !process.env.MODEL_API_KEY)
  throw new Error("Supply sources.json, layout.json, output.json and MODEL_API_KEY");
const fixture = JSON.parse(await readFile(sourceFile, "utf8")) as {
  listingUrl: string;
  corrections?: string[];
  sources: (SceneSource & { localFile?: string })[];
};
const layout = JSON.parse(await readFile(layoutFile, "utf8")) as { output: { scene: UnitScene } };
if (checkValue(unitScene, layout.output.scene).errors.length)
  throw new Error("Invalid base layout");
const scene = layout.output.scene;
const { appearance: _previous, ...geometry } = scene;
if (sceneProblems(geometry).length) throw new Error("Invalid base geometry");
const corrections = [...sceneProblems(scene), ...(fixture.corrections ?? [])];
let log: Record<string, unknown> = {};
const ctx = {
  runQuery: async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "ai/sources:resolve" || name === "ai/runs:wrongTableIds") return [];
    if (name === "ai/runs:cached") return null;
    throw new Error(`Unexpected query ${name}`);
  },
  runMutation: async (ref: FunctionReference<"mutation">, args: Record<string, unknown>) => {
    if (getFunctionName(ref) !== "ai/runs:log") throw new Error("Unexpected mutation");
    log = args;
    return "experiment-run" as Id<"aiRuns">;
  },
} as unknown as ActionCtx;
const result = await runAgent(ctx, unitAppearanceTask, {
  input: {
    scene,
    corrections,
    evidence: fixture.sources.map(({ key, label, kind }) => ({ key, label, kind })),
  },
  media: await Promise.all(
    fixture.sources.map(async (s) => ({
      key: s.key,
      kind: s.kind === "video" ? ("video" as const) : ("image" as const),
      url: s.localFile
        ? `data:video/mp4;base64,${(await readFile(s.localFile)).toString("base64")}`
        : s.url!,
    })),
  ),
  sources: [],
  shownTo: "offline-experiment" as Id<"users">,
});
if (result.output.appearance) scene.appearance = result.output.appearance;
else delete scene.appearance;
// Keep usage and validation, omit duplicate model payloads and synthetic identities.
const { output: _output, input: _input, userId: _user, shownTo: _audience, ...metrics } = log;
await writeFile(
  outputFile,
  JSON.stringify(
    {
      listingUrl: fixture.listingUrl,
      generatedAt: new Date().toISOString(),
      output: { scene, explanation: result.output.explanation },
      via: result.via,
      validation: sceneProblems(
        scene,
        fixture.sources.map((s) => s.key),
      ),
      log: metrics,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    model: log.model,
    via: result.via,
    attempts: log.attempts,
    objects: scene.appearance?.objects.length,
    parts: scene.appearance?.objects.reduce((n, o) => n + o.parts.length, 0),
    errors: log.errors,
    costUsd: log.costUsd,
    outputFile,
  }),
);

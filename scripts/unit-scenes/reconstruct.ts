/** Offline experiment: production task + runAgent + model adapter, no Convex deployment writes.
 * MODEL_API_KEY=... bun scripts/unit-scenes/reconstruct.ts sources.json output.json
 * Sources must be public media URLs. Output includes unmodified model geometry and validation logs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ActionCtx } from "../../convex/_generated/server";
import type { Id } from "../../convex/_generated/dataModel";
import { runAgent } from "../../convex/ai/agent";
import { layoutMedia, unitSceneTask } from "../../convex/lib/unitSceneTask";
import { sceneProblems, type SceneSource, type UnitScene } from "../../convex/lib/unitScene";

const [sourceFile, outputFile, layoutFile] = process.argv.slice(2);
if (!sourceFile || !outputFile || !process.env.MODEL_API_KEY)
  throw new Error("Supply sources.json, output.json and MODEL_API_KEY");
const fixture = JSON.parse(await readFile(sourceFile, "utf8")) as {
  title: string;
  description: string;
  listingUrl: string;
  sources: (SceneSource & { localFile?: string })[];
};
const prior = layoutFile
  ? (JSON.parse(await readFile(layoutFile, "utf8")) as { output: { scene: UnitScene } })
  : undefined;
const currentLayout = prior
  ? (({ appearance: _appearance, ...geometry }) => geometry)(prior.output.scene)
  : undefined;
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
const media = layoutMedia(
  await Promise.all(
    fixture.sources.map(async (s) => ({
      key: s.key,
      kind: s.kind === "video" ? ("video" as const) : ("image" as const),
      url: s.localFile
        ? `data:video/mp4;base64,${(await readFile(s.localFile)).toString("base64")}`
        : s.url!,
    })),
  ),
  fixture.sources,
);
const result = await runAgent(ctx, unitSceneTask, {
  input: {
    title: fixture.title,
    description: fixture.description,
    measurements: null,
    ...(currentLayout ? { currentLayout } : {}),
    evidence: fixture.sources
      .filter((s) => media.some((m) => m.key === s.key))
      .map(({ key, label, kind }) => ({ key, label, kind })),
  },
  media,
  sources: [],
  shownTo: "offline-experiment" as Id<"users">,
});
const { output: _output, userId: _user, ...metrics } = log;
const { runId: _run, ...resultData } = result;
const output = {
  listingUrl: fixture.listingUrl,
  generatedAt: new Date().toISOString(),
  ...resultData,
  validation: result.output.scene
    ? sceneProblems(
        result.output.scene,
        fixture.sources.map((s) => s.key),
      )
    : [],
  log: metrics,
};
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify({
    via: result.via,
    model: log.model,
    attempts: log.attempts,
    rooms: result.output.scene?.rooms.length,
    walls: result.output.scene?.walls.length,
    errors: log.errors,
    costUsd: log.costUsd,
    outputFile,
  }),
);

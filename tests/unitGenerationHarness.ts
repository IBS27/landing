/** Runs production handlers with an isolated DB/scheduler; never contacts a Convex deployment. */
import { type FunctionReference, getFunctionName } from "convex/server";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../convex/_generated/server";
import * as jobs from "../convex/ai/jobs";
import { manualScene } from "../convex/lib/unitScene";
import * as units from "../convex/unitScenes";
import details from "../scripts/unit-scenes/heathmead-detailed.result.json";
import layout from "../scripts/unit-scenes/heathmead-plan.result.json";
import { fakeCtx, type Row } from "./fakeDb";

export const generationLayout = layout.output.scene;
export const generationAppearance = details.output.scene.appearance;
type Args = Record<string, unknown>;
export function invoke<T = unknown>(
  fn: unknown,
  ctx: MutationCtx | ActionCtx,
  args: Args,
): Promise<T> {
  return (fn as { _handler: (ctx: MutationCtx | ActionCtx, args: Args) => Promise<T> })._handler(
    ctx,
    args,
  );
}
export function generationHarness() {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "viewer" }],
    unitScenes: [
      {
        _id: "unit",
        _creationTime: 1,
        ownerId: "viewer",
        scene: manualScene(4, 5, "Generation proof"),
        revision: 0,
        manuallyEdited: false,
        description: "",
        placements: [],
        createdAt: 1,
        updatedAt: 1,
        sources: [
          "floorplan",
          "video-tour",
          ...Array.from({ length: 12 }, (_, i) => `photo-${i + 1}`),
        ].map((key) => ({
          key,
          kind: key === "floorplan" ? "floorplan" : "photo",
          label: key,
          url: "https://example.com/evidence.jpg",
        })),
      },
    ],
    aiJobs: [],
    aiRuns: [],
  };
  const ctx = fakeCtx(tables);
  const scheduled: Args[] = [];
  ctx.scheduler = {
    runAfter: async (_delay: number, ref: FunctionReference<"action" | "mutation">, args: Args) => {
      if (getFunctionName(ref) === "unitScenes:generate") scheduled.push(args);
      return "scheduled" as Id<"_scheduled_functions">;
    },
  } as MutationCtx["scheduler"];
  const scene = () => tables.unitScenes[0] as unknown as Doc<"unitScenes">;
  const action = {
    storage: { getUrl: async () => "https://example.com/upload.jpg" },
    runQuery: async (ref: FunctionReference<"query">, args: Args) => {
      switch (getFunctionName(ref)) {
        case "unitScenes:load":
          return structuredClone(await invoke(units.load, ctx, args));
        case "ai/sources:resolve":
        case "ai/runs:wrongTableIds":
          return [];
        case "ai/runs:cached":
          return (
            tables.aiRuns.findLast(
              (r) => r.inputHash === args.inputHash && r.outcome === "model",
            ) ?? null
          );
        default:
          throw new Error(`Unexpected query: ${getFunctionName(ref)}`);
      }
    },
    runMutation: async (ref: FunctionReference<"mutation">, args: Args) => {
      switch (getFunctionName(ref)) {
        case "unitScenes:saveCandidate":
          return invoke(units.saveCandidate, ctx, args);
        case "ai/jobs:update":
          return invoke(jobs.update, ctx, args);
        case "ai/runs:log":
          return ctx.db.insert("aiRuns", args as never);
        default:
          throw new Error(`Unexpected mutation: ${getFunctionName(ref)}`);
      }
    },
  } as unknown as ActionCtx;
  return {
    tables,
    ctx,
    scene,
    scheduled,
    request: (detailsOnly = false) =>
      invoke<string>(units.requestGeneration, ctx, {
        viewerId: "viewer",
        id: "unit",
        revision: scene().revision,
        detailsOnly,
      }),
    generate: () => invoke(units.generate, action, scheduled.shift()!),
    save: (draft = scene().scene) =>
      invoke<number>(units.save, ctx, {
        viewerId: "viewer",
        id: "unit",
        revision: scene().revision,
        scene: draft,
        placements: scene().placements,
      }),
    accept: () =>
      invoke(units.acceptCandidate, ctx, {
        viewerId: "viewer",
        id: "unit",
        revision: scene().revision,
      }),
  };
}
export function modelCompletion(output: unknown) {
  return new Response(
    `data: ${JSON.stringify({ model: "muse-wonder-1.0", choices: [{ delta: { content: JSON.stringify(output) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}

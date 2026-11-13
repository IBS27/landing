import { v } from "convex/values";
import { placement, sceneSource, unitScene } from "./unitScene";

export const generationStatus = v.union(
  v.literal("layout"),
  v.literal("details"),
  v.literal("ready"),
  v.literal("partial"),
  v.literal("failed"),
);
export const unitSceneFields = {
  ownerId: v.id("users"),
  roomId: v.optional(v.id("rooms")),
  listingId: v.optional(v.id("listings")),
  scene: unitScene,
  placements: v.array(placement),
  sources: v.array(sceneSource),
  sceneSources: v.optional(v.array(sceneSource)),
  description: v.string(),
  revision: v.number(),
  manuallyEdited: v.optional(v.boolean()),
  generation: v.optional(
    v.object({
      status: generationStatus,
      revision: v.number(),
      autoApply: v.boolean(),
    }),
  ),
  jobId: v.optional(v.id("aiJobs")),
  candidate: v.optional(unitScene),
  explanation: v.optional(v.string()),
  runId: v.optional(v.id("aiRuns")),
  /** The last vibe and total furniture budget (whole dollars) given in Landing Home's chat (#150). */
  furnishing: v.optional(v.object({ vibe: v.string(), budget: v.optional(v.number()) })),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const unitSceneRecord = v.object({
  ...unitSceneFields,
  _id: v.id("unitScenes"),
  _creationTime: v.number(),
});

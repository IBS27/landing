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
      /** One short sentence, written by Landing, on what a partial or failed build is missing (#153). */
      note: v.optional(v.string()),
    }),
  ),
  jobId: v.optional(v.id("aiJobs")),
  candidate: v.optional(unitScene),
  explanation: v.optional(v.string()),
  runId: v.optional(v.id("aiRuns")),
  /**
   * Furnishing from Landing Home's chat (#150, #153). `vibe`: the look last
   * given for the whole apartment. `budget`: the apartment's one furniture
   * budget, whole dollars: what the Apartment tab's chip and every reply
   * show. Only a request to furnish the room sets it, and never below what is
   * already placed; "add a rug under $200" caps that request and leaves it
   * alone. `removed`: Marketplace listings the person took out, newest last,
   * which furnishing the room again leaves out.
   */
  furnishing: v.optional(
    v.object({
      vibe: v.optional(v.string()),
      budget: v.optional(v.number()),
      removed: v.optional(v.array(v.id("listings"))),
    }),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const unitSceneRecord = v.object({
  ...unitSceneFields,
  _id: v.id("unitScenes"),
  _creationTime: v.number(),
});

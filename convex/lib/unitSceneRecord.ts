import { v } from "convex/values";
import { placement, sceneSource, unitScene } from "./unitScene";

export const unitSceneFields = {
  ownerId: v.id("users"),
  roomId: v.optional(v.id("rooms")),
  listingId: v.optional(v.id("listings")),
  scene: unitScene,
  placements: v.array(placement),
  sources: v.array(sceneSource),
  description: v.string(),
  revision: v.number(),
  jobId: v.optional(v.id("aiJobs")),
  candidate: v.optional(unitScene),
  explanation: v.optional(v.string()),
  runId: v.optional(v.id("aiRuns")),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const unitSceneRecord = v.object({
  ...unitSceneFields,
  _id: v.id("unitScenes"),
  _creationTime: v.number(),
});

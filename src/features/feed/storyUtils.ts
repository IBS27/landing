import type { FunctionReturnType } from "convex/server";
import { backgroundFor } from "@/features/posts/backgrounds";
import type { api } from "../../../convex/_generated/api";

export type StoryBuckets = FunctionReturnType<typeof api.stories.tray>;
export type StoryBucket = StoryBuckets[number];
export type StoryItem = StoryBucket["stories"][number];

/** Where opening someone's stories starts: their first unseen story, else the first. */
export function entryStory(bucket: StoryBucket) {
  return bucket.stories.find((s) => !s.seen) ?? bucket.stories[0];
}

/** CSS background for a text story; accepts a known key or a raw CSS color/gradient. */
export function storyBackground(key: string | null) {
  const known = backgroundFor(key);
  if (known) return known.css;
  if (key && /^(#|linear-gradient|radial-gradient|rgb)/.test(key)) return key;
  return "linear-gradient(180deg, #1877f2 0%, #0a4cbf 100%)";
}

/** Text color that reads on a story background (dark on light swatches). */
export function storyTextColor(key: string | null) {
  return backgroundFor(key)?.text ?? "#fff";
}

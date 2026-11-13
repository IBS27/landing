import { type Infer, v } from "convex/values";
import type { SceneSource } from "./unitScene";

const image = v.object({
  url: v.string(),
  sourceUrl: v.string(),
  label: v.string(),
});

/** Same-unit reference evidence. Display copies are local; Muse receives the public originals. */
export const rentalMedia = v.object({
  sourceUrl: v.string(),
  sourceName: v.string(),
  retrievedOn: v.string(),
  photos: v.array(image),
  floorPlan: image,
});
export type RentalMedia = Infer<typeof rentalMedia>;

export function rentalSources(media: RentalMedia): SceneSource[] {
  return [
    {
      key: "floorplan",
      kind: "floorplan",
      label: media.floorPlan.label,
      url: media.floorPlan.sourceUrl,
    },
    ...media.photos.slice(0, 18).map(
      (photo, i): SceneSource => ({
        key: `photo-${i + 1}`,
        kind: "photo",
        label: photo.label,
        url: photo.sourceUrl,
      }),
    ),
  ];
}

/**
 * Seed video clips in `public/seed/videos` (sources and licenses in
 * `public/seed/ATTRIBUTION.md`). Each clip comes as a 16:9 "-wide" cut for
 * feed and Watch posts and/or a 9:16 "-tall" cut for Reels and stories, with a
 * poster frame alongside.
 */
export const videoClips = {
  "body-surf-tall": { width: 720, height: 1280, duration: 10.0 },
  "cat-straw-tall": { width: 720, height: 1280, duration: 10.0 },
  "cat-straw-wide": { width: 1280, height: 720, duration: 10.0 },
  "concert-tall": { width: 720, height: 1280, duration: 10.0 },
  "concert-wide": { width: 1280, height: 720, duration: 10.0 },
  "dog-walk-tall": { width: 720, height: 1280, duration: 10.0 },
  "dog-walk-wide": { width: 1280, height: 720, duration: 10.0 },
  "espresso-macro-tall": { width: 720, height: 1280, duration: 10.03 },
  "espresso-routine-wide": { width: 1280, height: 720, duration: 10.03 },
  "golden-gardens-wide": { width: 1280, height: 720, duration: 7.0 },
  "guitar-solo-tall": { width: 720, height: 1280, duration: 10.0 },
  "guitar-solo-wide": { width: 1280, height: 720, duration: 10.0 },
  "indoor-climbing-tall": { width: 720, height: 1280, duration: 10.0 },
  "kayak-sunset-wide": { width: 1280, height: 720, duration: 10.0 },
  "kayak-surf-tall": { width: 720, height: 1280, duration: 10.03 },
  "kayak-surf-wide": { width: 1280, height: 720, duration: 10.03 },
  "mowich-rain-tall": { width: 720, height: 1280, duration: 10.03 },
  "mowich-rain-wide": { width: 1280, height: 720, duration: 10.03 },
  "myrtle-falls-tall": { width: 720, height: 1280, duration: 10.0 },
  "noodles-tall": { width: 720, height: 1280, duration: 10.0 },
  "ocean-shores-wide": { width: 1280, height: 720, duration: 10.0 },
  "ocean-waves-tall": { width: 720, height: 1280, duration: 10.0 },
  "puget-ferry-wide": { width: 1280, height: 720, duration: 10.0 },
  "puppies-tall": { width: 720, height: 1280, duration: 10.0 },
  "puppies-wide": { width: 1280, height: 720, duration: 10.0 },
  "rain-sonoma-tall": { width: 720, height: 1280, duration: 10.0 },
  "rainier-timelapse-wide": { width: 1280, height: 720, duration: 10.0 },
  "ridge-hike-tall": { width: 720, height: 1280, duration: 10.0 },
  "salmon-tall": { width: 720, height: 1280, duration: 10.03 },
  "salmon-wide": { width: 1280, height: 720, duration: 10.03 },
  "seattle-viaduct-wide": { width: 1280, height: 720, duration: 10.03 },
  "seattle-waterfront-wide": { width: 1280, height: 720, duration: 10.0 },
  "ship-canal-bridge-wide": { width: 1280, height: 720, duration: 10.0 },
  "skatepark-tall": { width: 720, height: 1280, duration: 10.0 },
  "skatepark-wide": { width: 1280, height: 720, duration: 10.0 },
  "snowfall-tall": { width: 720, height: 1280, duration: 10.0 },
  "snowfall-wide": { width: 1280, height: 720, duration: 10.0 },
  "sunset-timelapse-tall": { width: 720, height: 1280, duration: 10.0 },
  "sunset-timelapse-wide": { width: 1280, height: 720, duration: 10.0 },
  "waterfall-tall": { width: 720, height: 1280, duration: 10.0 },
  "waterfall-wide": { width: 1280, height: 720, duration: 10.0 },
} as const;

export type VideoClip = keyof typeof videoClips;

/** The `media` entry for a clip. */
export function videoMedia(clip: VideoClip, alt?: string) {
  const c = videoClips[clip];
  return {
    url: `/seed/videos/${clip}.mp4`,
    kind: "video" as const,
    width: c.width,
    height: c.height,
    duration: c.duration,
    poster: `/seed/videos/${clip}.jpg`,
    alt,
  };
}

/** 9:16 clips are Reels. */
export const isTallClip = (clip: VideoClip) => videoClips[clip].height > videoClips[clip].width;

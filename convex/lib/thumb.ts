/** Media as the thumbnail helpers need it (posts, stories, comments, messages). Pure, shared with the client. */
export type ThumbMedia = { url: string; kind: "image" | "video"; poster?: string };

/**
 * What a media thumbnail draws: images and video posters as an `<img>`, and a
 * video without a poster as a muted `<video>` showing its first frame. A video
 * URL never goes into an `<img>`.
 */
export function thumbSource(m: ThumbMedia): { kind: "image" | "video"; src: string } {
  if (m.kind !== "video") return { kind: "image", src: m.url };
  return m.poster ? { kind: "image", src: m.poster } : { kind: "video", src: m.url };
}

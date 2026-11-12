import { groupParams } from "@/features/feed/links";
import type { PostView } from "./types";

export { groupParams };

/** Permalink path for a post (`/<username>/posts/<id>`). */
export function postUrl(post: Pick<PostView, "_id" | "author">) {
  return `/${post.author.username}/posts/${post._id}`;
}

/** Facebook truncates long posts in Feed and shows "See more". */
export const TRUNCATE_AT = 280;
export function truncate(text: string) {
  if (text.length <= TRUNCATE_AT && text.split("\n").length <= 6) return null;
  let cut = text.slice(0, TRUNCATE_AT);
  const lines = cut.split("\n");
  if (lines.length > 6) cut = lines.slice(0, 6).join("\n");
  const space = cut.lastIndexOf(" ");
  if (space > TRUNCATE_AT * 0.7) cut = cut.slice(0, space);
  return cut.trimEnd();
}

/** Short text-only posts render larger, like Facebook. */
export function isLargeText(post: Pick<PostView, "text" | "media" | "attachments" | "shared">) {
  return (
    !!post.text &&
    post.text.length < 85 &&
    post.media.length === 0 &&
    post.attachments.length === 0 &&
    !post.shared
  );
}

/** Upload a file to Convex storage via a one-time upload URL. */
export async function uploadFile(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("Upload failed");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

/** Natural size of an image or video file, for layout. */
export function mediaSize(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (width?: number, height?: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
      v.onerror = () => done();
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.onerror = () => done();
      img.src = url;
    }
  });
}

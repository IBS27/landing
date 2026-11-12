/** Browser helpers for video uploads (Create reel, Marketplace "Add video"). */

export type ProbedVideo = {
  file: File;
  /** Object URL for previewing; revoke when done. */
  url: string;
  width: number;
  height: number;
  duration: number;
};

/** Reads a video file's dimensions and length. */
export function probeVideo(file: File): Promise<ProbedVideo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      resolve({ file, url, width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read that video. Try an MP4 or WebM file."));
    };
    v.src = url;
  });
}

/** Grabs a JPEG poster frame about half a second in (null if the browser can't decode it). */
export function captureVideoPoster(url: string): Promise<File | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight, 1));
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(
        (b) => resolve(b ? new File([b], "poster.jpg", { type: "image/jpeg" }) : null),
        "image/jpeg",
        0.82,
      );
    };
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

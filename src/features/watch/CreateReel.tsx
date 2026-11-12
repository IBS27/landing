import { useNavigate } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useM, useViewer } from "@/app/viewer";
import { GlobeIcon } from "@/features/posts/icons";
import { uploadFile } from "@/features/posts/util";
import { VideoPlayer } from "@/features/posts/VideoPlayer";
import { captureVideoPoster, type ProbedVideo, probeVideo } from "@/features/posts/videoUpload";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_SECONDS = 180;
const MAX_BYTES = 200 * 1024 * 1024;

/**
 * "Create reel": pick a video, preview it, add a description and share. The
 * file goes to Convex storage and becomes a video post; vertical videos are
 * Reels and open in the Reels viewer once shared.
 */
export function CreateReelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const create = useM(api.media.createVideoPost);
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<ProbedVideo | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  const reset = () => {
    setPicked(null);
    setText("");
    setError(null);
    setBusy(false);
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) return setError("Choose a video file.");
    if (file.size > MAX_BYTES) return setError("Videos can be up to 200 MB.");
    try {
      const p = await probeVideo(file);
      if (p.duration > MAX_SECONDS) {
        URL.revokeObjectURL(p.url);
        return setError("Reels can be up to 3 minutes long.");
      }
      setPicked(p);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const share = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const [storageId, poster] = await Promise.all([
        getUploadUrl({}).then((u) => uploadFile(u, picked.file) as Promise<Id<"_storage">>),
        captureVideoPoster(picked.url),
      ]);
      const posterStorageId = poster
        ? await getUploadUrl({}).then((u) => uploadFile(u, poster) as Promise<Id<"_storage">>)
        : undefined;
      const postId = await create({
        storageId,
        posterStorageId,
        width: picked.width,
        height: picked.height,
        duration: Math.round(picked.duration * 10) / 10,
        text: text.trim() || undefined,
      });
      const tall = picked.height > picked.width;
      reset();
      onClose();
      if (tall) void navigate({ to: "/reel/$reelId", params: { reelId: postId } });
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o || busy) return;
        reset();
        onClose();
      }}
      title="Create reel"
      width={picked ? 760 : 500}
      onBack={picked && !busy ? reset : undefined}
    >
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!picked ? (
        <div className="p-4">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void choose(e.dataTransfer.files[0]);
            }}
            className={`flex h-[300px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-divider ${drag ? "bg-highlight" : "bg-comment hover:bg-hover"}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-btn text-primary">
              <Clapperboard size={20} />
            </span>
            <span className="font-semibold text-[17px] text-primary">Add video</span>
            <span className="text-[13px] text-secondary">or drag and drop</span>
          </button>
          {error && <p className="mt-3 text-[13px] text-[#e41e3f]">{error}</p>}
        </div>
      ) : (
        <div className="flex gap-4 p-4">
          <VideoPlayer
            src={picked.url}
            label="Reel preview"
            loop
            className="aspect-[9/16] h-[460px] shrink-0 rounded-lg"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <Avatar src={viewer.avatar} size={40} />
              <div>
                <p className="font-semibold text-[15px] text-primary leading-5">{viewer.name}</p>
                <p className="flex items-center gap-1 text-[13px] text-secondary">
                  <GlobeIcon size={12} /> Public
                </p>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your reel..."
              maxLength={2200}
              rows={6}
              className="mt-3 w-full resize-none rounded-lg border border-divider bg-card p-3 text-[15px] text-primary outline-none placeholder:text-secondary focus:border-fb"
            />
            <p className="mt-2 text-[13px] text-secondary">
              {picked.height > picked.width
                ? "Vertical videos are shared as reels."
                : "Horizontal videos are shared as video posts."}{" "}
              {Math.round(picked.duration)}s · {picked.width}×{picked.height}
            </p>
            {error && <p className="mt-2 text-[13px] text-[#e41e3f]">{error}</p>}
            <span className="flex-1" />
            <Button variant="primary" block disabled={busy} onClick={() => void share()}>
              {busy ? <Spinner size={20} className="text-white" /> : "Share reel"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

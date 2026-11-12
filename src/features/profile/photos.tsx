import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { PhotoViewer } from "@/features/posts";
import { uploadFile } from "@/features/posts/util";
import { Modal } from "@/ui/overlays";
import { Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** Upload a file (or pick an existing photo URL) as the viewer's profile picture or cover. */
export function useSetProfilePhoto() {
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const setPhoto = useM(api.profiles.setPhoto);
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null);
  const upload = useCallback(
    async (kind: "avatar" | "cover", file: File) => {
      setBusy(kind);
      try {
        const storageId = await uploadFile(await getUploadUrl({}), file);
        await setPhoto({ kind, storageId: storageId as Id<"_storage"> });
      } finally {
        setBusy(null);
      }
    },
    [getUploadUrl, setPhoto],
  );
  const pick = useCallback(
    (kind: "avatar" | "cover", url: string) => setPhoto({ kind, url }),
    [setPhoto],
  );
  const removeCover = useCallback(() => setPhoto({ kind: "cover" }), [setPhoto]);
  return { upload, pick, removeCover, busy };
}

/** Opens a hidden file picker for images and hands back the chosen file. */
export function pickImage(onFile: (f: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) onFile(f);
  };
  input.click();
}

/** Loads a post and opens the photo theater at the given media index. */
export function PhotoOpener({
  postId,
  index,
  onClose,
}: {
  postId: Id<"posts">;
  index: number;
  onClose: () => void;
}) {
  const post = useQ(api.posts.get, { postId });
  useEffect(() => {
    if (post === null) onClose();
  }, [post, onClose]);
  if (post === undefined)
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90">
        <Spinner size={40} className="text-white" />
      </div>
    );
  if (post === null) return null;
  return <PhotoViewer post={post} index={index} onClose={onClose} />;
}

/** A single image on the black theater stage (profile picture, cover photo). */
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black outline-none"
        >
          <D.Title className="sr-only">Photo</D.Title>
          <D.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-2 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-white/20"
            >
              <X size={24} />
            </button>
          </D.Close>
          <img src={src} alt="" className="max-h-full max-w-full object-contain" />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** "Choose cover photo" / "Choose profile picture": a grid of the viewer's own photos. */
export function ChoosePhotoDialog({
  open,
  onOpenChange,
  userId,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: Id<"users">;
  title: string;
  onPick: (url: string) => void;
}) {
  const data = useQ(api.profiles.photos, open ? { userId } : "skip");
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} width={700}>
      <div className="max-h-[560px] min-h-[200px] p-4">
        {data === undefined ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !data || data.yours.length === 0 ? (
          <p className="py-12 text-center font-bold text-[20px] text-secondary">
            No photos to show
          </p>
        ) : (
          <>
            <h3 className="pb-2 font-semibold text-[17px] text-primary">Your photos</h3>
            <div className="grid grid-cols-4 gap-2">
              {data.yours.map((p) => (
                <button
                  key={`${p.postId}-${p.index}`}
                  type="button"
                  onClick={() => {
                    onPick(p.url);
                    onOpenChange(false);
                  }}
                  className="aspect-square overflow-hidden rounded-lg hover:brightness-90"
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

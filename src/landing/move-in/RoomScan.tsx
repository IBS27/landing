import { Camera, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useM } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { uploadFile } from "@/features/posts/util";
import { cn } from "@/lib/format";
import { Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAX_PHOTOS } from "../../../convex/lib/vibe";
import type { Room } from "./VibeCard";

/**
 * The room scan (#25): photos of the room, uploaded to Convex storage. Later
 * features read them (Marketplace matching, #26; the 3D room, #37).
 */
export function RoomScan({ room }: { room: Room }) {
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const addPhotos = useM(api.rooms.addPhotos);
  const removePhoto = useM(api.rooms.removePhoto);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [dragging, setDragging] = useState(false);
  const left = MAX_PHOTOS - room.photos.length - pending;

  async function add(files: FileList | File[]) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (images.length > left) toast.show(`A room can have up to ${MAX_PHOTOS} photos`);
    const take = images.slice(0, Math.max(0, left));
    if (take.length === 0) return;
    setPending((n) => n + take.length);
    try {
      const storageIds: Id<"_storage">[] = [];
      for (const file of take)
        storageIds.push((await uploadFile(await getUploadUrl({}), file)) as Id<"_storage">);
      await addPhotos({ roomId: room._id, storageIds });
    } catch {
      toast.show("Couldn't upload a photo");
    } finally {
      setPending((n) => n - take.length);
    }
  }

  const empty = room.photos.length === 0 && pending === 0;

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-bold text-[20px] text-primary leading-6">Room scan</h2>
        <span className="text-[13px] text-secondary">
          {room.photos.length} / {MAX_PHOTOS} photos
        </span>
      </div>
      <p className="mb-3 text-[13px] text-secondary">
        Stand in each corner and take a photo of the opposite wall, plus one of the windows. Only
        you can see these.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
        className={cn("rounded-lg transition-colors", dragging && "bg-highlight")}
      >
        {empty ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-divider border-dashed text-center hover:bg-hover"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-btn">
              <Camera size={22} className="text-icon" />
            </span>
            <span className="font-semibold text-[15px] text-primary">Add photos of your room</span>
            <span className="text-[13px] text-secondary">or drag and drop</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {room.photos.map((p, i) => (
              <div
                key={p.url}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-btn"
              >
                <img
                  src={p.url}
                  alt={`${room.name}, view ${i + 1} of ${room.photos.length}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() =>
                    void removePhoto({ roomId: room._id, url: p.url }).catch(() =>
                      toast.show("Couldn't remove that photo"),
                    )
                  }
                  className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {Array.from({ length: pending }, (_, i) => (
              <div
                key={`pending-${i}`}
                className="flex aspect-[4/3] items-center justify-center rounded-lg bg-btn"
              >
                <Spinner size={22} />
              </div>
            ))}
            {left > 0 && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-divider border-dashed text-[13px] text-secondary hover:bg-hover"
              >
                <ImagePlus size={22} className="text-icon" />
                Add photos
              </button>
            )}
          </div>
        )}
      </div>
      {toast.node}
    </Card>
  );
}

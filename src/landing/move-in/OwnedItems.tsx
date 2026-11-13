import { Link } from "@tanstack/react-router";
import { ImagePlus, Store, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { uploadFile } from "@/features/posts/util";
import { toListing } from "@/landing/links";
import { price } from "@/lib/format";
import { Button, Card, IconButton, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PlaceInRoom } from "./PlaceInRoom";

const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";

/** Today as "YYYY-MM-DD" in the viewer's own time zone. */
export const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Start of a "YYYY-MM-DD" day in local time: never in the future for today. */
export const dayStart = (date: string) => new Date(`${date}T00:00:00`).getTime();
const day = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** "Your stuff": everything the viewer owns, tracked for resale at move-out (#27). */
export function OwnedItems() {
  const items = useQ(api.inventory.mine, {});
  const rooms = useQ(api.rooms.mine, {});
  const placed = useQ(api.unitItems.placed, {});
  // A purchase placed earlier as its listing counts too.
  const placedIn = (it: {
    _id: Id<"ownedItems">;
    source: { kind: "manual" } | { kind: "marketplace"; listingId: Id<"listings"> };
  }) =>
    placed?.find(
      (u) =>
        u.ownedItemIds.includes(it._id) ||
        (it.source.kind === "marketplace" && u.listingIds.includes(it.source.listingId)),
    )?.unitId ?? null;
  const remove = useM(api.inventory.remove);
  const [adding, setAdding] = useState(false);

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <h2 className="font-bold text-[17px] text-primary leading-5">Your stuff</h2>
          <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
            What you own, with what you paid, so it's ready to resell when you move out. Deals you
            agree through Muse are added automatically.
          </p>
        </div>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Add item
          </Button>
        )}
      </div>
      {adding && <AddItemForm onDone={() => setAdding(false)} />}
      {items === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        !adding && (
          <p className="px-4 pb-4 text-[15px] text-secondary">
            Nothing yet. Add something you own, or agree a deal through Muse.
          </p>
        )
      ) : (
        <ul className="divide-y divide-divider border-divider border-t">
          {items.map((it) => (
            <li key={it._id} className="flex items-center gap-3 px-4 py-2.5">
              {it.photos[0] ? (
                <img
                  src={it.photos[0]}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-md bg-wash" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[15px] text-primary">{it.title}</div>
                <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-secondary">
                  <span>{it.price === 0 ? "Free" : price(it.price)}</span>
                  <span aria-hidden>·</span>
                  <span>{day(it.acquiredAt)}</span>
                  <span aria-hidden>·</span>
                  {it.source.kind === "marketplace" ? (
                    <Link
                      {...toListing(it.source.listingId)}
                      className="inline-flex items-center gap-1 text-link hover:underline"
                    >
                      <Store size={12} aria-hidden /> From Marketplace
                    </Link>
                  ) : (
                    <span>Added by you</span>
                  )}
                </div>
                {rooms && placed && (
                  <div className="mt-1.5">
                    <PlaceInRoom
                      item={{ placeItem: it._id }}
                      rooms={rooms}
                      placedIn={placedIn(it)}
                    />
                  </div>
                )}
              </div>
              <IconButton
                label={`Remove ${it.title}`}
                size={32}
                variant="ghost"
                onClick={() => remove({ itemId: it._id })}
              >
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const add = useM(api.inventory.add);
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const [title, setTitle] = useState("");
  const [paid, setPaid] = useState("");
  const [date, setDate] = useState(today());
  const [photos, setPhotos] = useState<{ storageId: Id<"_storage">; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: { storageId: Id<"_storage">; preview: string }[] = [];
      for (const file of [...files].slice(0, 10 - photos.length)) {
        const storageId = (await uploadFile(await getUploadUrl({}), file)) as Id<"_storage">;
        added.push({ storageId, preview: URL.createObjectURL(file) });
      }
      setPhotos((p) => [...p, ...added]);
    } catch {
      setError("A photo didn't upload. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await add({
        title,
        price: paid.trim() ? Number(paid) : Number.NaN,
        acquiredAt: dayStart(date),
        photos: photos.map((p) => ({ storageId: p.storageId })),
      });
      onDone();
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setError(typeof data === "string" ? data : "Check the details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mb-4 rounded-lg bg-wash p-3 dark:bg-hover">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_170px]">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Item</span>
          <input
            className={field}
            placeholder="IKEA desk lamp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">What you paid</span>
          <input
            type="number"
            min={0}
            className={field}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Date you got it</span>
          <input
            type="date"
            max={today()}
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3">
        <span className="font-semibold text-[13px] text-secondary">Photos</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <span key={p.storageId} className="relative">
              <img src={p.preview} alt="" className="h-14 w-14 rounded-md object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                className="-top-1.5 -right-1.5 absolute flex h-5 w-5 items-center justify-center rounded-full bg-card text-secondary shadow-base"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {photos.length < 10 && (
            <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border border-divider border-dashed text-secondary hover:bg-hover">
              {uploading ? <Spinner size={18} /> : <ImagePlus size={20} />}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] text-[#E41E3F]">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={busy || uploading}>
          {busy ? "Adding…" : "Add item"}
        </Button>
      </div>
    </div>
  );
}

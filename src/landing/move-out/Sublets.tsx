import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Home, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { uploadFile } from "@/features/posts/util";
import { AddPhotoTile } from "@/landing/move-in/AddPhotoTile";
import { today } from "@/landing/move-in/OwnedItems";
import { price } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEIGHBORHOODS } from "../../../convex/lib/listings";

const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";

const toDay = (s: string) => (s ? new Date(`${s}T12:00:00`).getTime() : Number.NaN);
/** "Jun 1 to Aug 31, 2027", or "Dec 1, 2026 to Feb 28, 2027" across a new year. */
function dateRange(from: number | null, to: number | null) {
  if (!from || !to) return "";
  const a = new Date(from);
  const b = new Date(to);
  const fmt = (d: Date, year: boolean) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(year && { year: "numeric" }),
    });
  return `${fmt(a, a.getFullYear() !== b.getFullYear())} to ${fmt(b, true)}`;
}
const errorText = (e: unknown, fallback: string) => {
  const data = (e as { data?: unknown }).data;
  return typeof data === "string" ? data : fallback;
};

type Prefill = NonNullable<FunctionReturnType<typeof api.subleases.fromPlace>>;

/**
 * "Sublease your place": the form, then the viewer's sublets. With
 * `fromPlace`, the form opens filled in from their current place (#141), unless
 * that place already has a sublet listed.
 */
export function Sublets({
  fromPlace = false,
  onClose,
}: {
  fromPlace?: boolean;
  /** Called when a form opened `fromPlace` is listed or cancelled. */
  onClose?: () => void;
}) {
  const rows = useQ(api.subleases.mine, {});
  const prefill = useQ(api.subleases.fromPlace, fromPlace ? {} : "skip");
  const [creating, setCreating] = useState(false);
  // Waits for the place before opening, so the form starts filled in.
  const placeForm = fromPlace && prefill !== undefined && !prefill?.open;
  const open = creating || placeForm;
  const close = () => {
    setCreating(false);
    onClose?.();
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-[240px] flex-1">
          <h2 className="font-bold text-[17px] text-primary leading-5">Sublease your place</h2>
          <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
            List your place on Marketplace while you're away. Muse drafts replies to renters, never
            under your lowest rent, and you approve each one in your Inbox.
          </p>
        </div>
        {!open && (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            List a sublet
          </Button>
        )}
      </div>
      {open && (
        <SubletForm
          key={placeForm && prefill ? prefill.placeId : "blank"}
          prefill={placeForm ? (prefill ?? undefined) : undefined}
          onDone={close}
        />
      )}
      {rows === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        rows.length > 0 && (
          <ul className="divide-y divide-divider border-divider border-t">
            {rows.map((r) => (
              <SubletRow key={r._id} r={r} />
            ))}
          </ul>
        )
      )}
    </Card>
  );
}

type Row = NonNullable<ReturnType<typeof useQ<typeof api.subleases.mine>>>[number];

function SubletRow({ r }: { r: Row }) {
  const update = useM(api.subleases.updateTerms);
  const [minRent, setMinRent] = useState(String(r.minRent));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const n = Number(minRent);
    if (!minRent.trim() || !Number.isFinite(n) || n <= 0 || n > r.rent) {
      setError(`Enter a lowest rent from $1 to ${price(r.rent)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await update({ subletId: r._id, minRent: n });
      setEditing(false);
    } catch (e) {
      setError(errorText(e, "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        {r.photo ? (
          <img src={r.photo} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-md bg-wash" />
        )}
        <div className="min-w-[180px] flex-1">
          <Link
            to="/landing/find/listing/$listingId"
            params={{ listingId: r.listingId }}
            className="block truncate font-semibold text-[15px] text-primary hover:underline"
          >
            {r.title}
          </Link>
          <div className="text-[13px] text-secondary leading-[18px]">
            {price(r.rent)}/mo · {dateRange(r.availableFrom, r.availableTo)}
            {r.neighborhood ? ` · ${r.neighborhood}` : ""}
            {r.status !== "active" ? ` · Marked as ${r.status}` : ""}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-[13px] leading-[18px]">
            <span className="text-secondary">
              Lowest rent <b className="font-semibold text-primary">{price(r.minRent)}</b>
            </span>
            <span className="text-secondary">
              · {r.chats} {r.chats === 1 ? "chat" : "chats"}
            </span>
            {r.draftsWaiting > 0 && (
              <Link
                to="/landing/inbox"
                className="inline-flex items-center gap-1 font-semibold text-link hover:underline"
              >
                <Sparkles size={12} className="text-[#8A3FFC]" aria-hidden />
                {r.draftsWaiting} {r.draftsWaiting === 1 ? "reply" : "replies"} waiting for you
              </Link>
            )}
            {r.museReplies === "paused" && <span className="text-secondary">· Muse paused</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:pl-[68px]">
          {!editing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMinRent(String(r.minRent));
                setError(null);
                setEditing(true);
              }}
            >
              Edit lowest rent
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              update({
                subletId: r._id,
                museReplies: r.museReplies === "active" ? "paused" : "active",
              })
            }
          >
            {r.museReplies === "active" ? "Pause Muse" : "Resume Muse"}
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 rounded-lg bg-wash p-3 dark:bg-hover">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-[13px] text-secondary">Lowest rent</span>
              <input
                type="number"
                min={1}
                max={r.rent}
                step={25}
                className={`${field} w-36`}
                value={minRent}
                onChange={(e) => setMinRent(e.target.value)}
              />
            </label>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-[#E41E3F]">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

type Photo = {
  key: string;
  input: { url: string } | { storageId: Id<"_storage"> };
  preview: string;
};

function SubletForm({ prefill, onDone }: { prefill?: Prefill; onDone: () => void }) {
  const create = useM(api.subleases.create);
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const [f, setF] = useState(() => ({
    title: prefill?.title ?? "",
    rent: prefill?.rent ? String(prefill.rent) : "",
    minRent: "",
    // A place whose neighborhood isn't in the list waits for the user to pick one.
    neighborhood: prefill ? (prefill.neighborhood ?? "") : "Mission",
    propertyType: prefill?.propertyType ?? ("room" as "apartment" | "room" | "studio"),
    bedrooms: String(prefill?.bedrooms || 1),
    bathrooms: String(prefill?.bathrooms ?? 1),
    from: prefill?.availableFrom ?? "",
    to: "",
    furnished: prefill?.furnished ?? true,
    description: "",
    notes: "",
  }));
  const [photos, setPhotos] = useState<Photo[]>(
    () =>
      prefill?.photos.slice(0, 10).map((url) => ({ key: url, input: { url }, preview: url })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const addPhotos = async (files: File[]) => {
    setUploading(true);
    try {
      const added: Photo[] = [];
      for (const file of [...files].slice(0, 10 - photos.length)) {
        const storageId = (await uploadFile(await getUploadUrl({}), file)) as Id<"_storage">;
        added.push({ key: storageId, input: { storageId }, preview: URL.createObjectURL(file) });
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
      await create({
        title: f.title,
        rent: Number(f.rent),
        minRent: Number(f.minRent),
        description: f.description,
        photos: photos.map((p) => p.input),
        neighborhood: f.neighborhood,
        propertyType: f.propertyType,
        bedrooms: Number(f.bedrooms),
        bathrooms: Number(f.bathrooms),
        availableFrom: toDay(f.from),
        availableTo: toDay(f.to),
        furnished: f.furnished,
        notes: f.notes.trim() || undefined,
        placeId: prefill?.placeId,
      });
      onDone();
    } catch (e) {
      setError(errorText(e, "Check the details and try again."));
    } finally {
      setBusy(false);
    }
  };

  const label = (text: string) => (
    <span className="font-semibold text-[13px] text-secondary">{text}</span>
  );

  return (
    <div className="mx-4 mb-4 rounded-lg bg-wash p-3 dark:bg-hover">
      {prefill && (
        <p className="mb-3 flex items-start gap-2 text-[13px] text-primary leading-[18px]">
          <Home size={14} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
          <span>
            Filled in from your place. Check every detail and add your lowest rent. Nothing is
            listed until you tap List sublet.
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          {label("Title")}
          <input
            className={field}
            placeholder="Room in a sunny Mission flat, June to August"
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {label("Rent per month")}
          <input
            type="number"
            min={1}
            className={field}
            value={f.rent}
            onChange={(e) => set({ rent: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {label("Lowest rent you'd accept")}
          <input
            type="number"
            min={1}
            className={field}
            value={f.minRent}
            onChange={(e) => set({ minRent: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {label("Available from")}
          <input
            type="date"
            className={field}
            value={f.from}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {label("Available to")}
          <input
            type="date"
            min={today()}
            className={field}
            value={f.to}
            onChange={(e) => set({ to: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {label("Neighborhood")}
          <select
            className={field}
            value={f.neighborhood}
            onChange={(e) => set({ neighborhood: e.target.value })}
          >
            {!f.neighborhood && (
              <option value="" disabled>
                Choose a neighborhood
              </option>
            )}
            {NEIGHBORHOODS.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {label("Type")}
          <select
            className={field}
            value={f.propertyType}
            onChange={(e) =>
              set({ propertyType: e.target.value as "apartment" | "room" | "studio" })
            }
          >
            <option value="room">Private room</option>
            <option value="studio">Studio</option>
            <option value="apartment">Whole apartment</option>
          </select>
        </label>
        {f.propertyType === "apartment" && (
          <label className="flex flex-col gap-1">
            {label("Bedrooms")}
            <input
              type="number"
              min={1}
              className={field}
              value={f.bedrooms}
              onChange={(e) => set({ bedrooms: e.target.value })}
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          {label("Bathrooms")}
          <input
            type="number"
            min={1}
            step={0.5}
            className={field}
            value={f.bathrooms}
            onChange={(e) => set({ bathrooms: e.target.value })}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={f.furnished}
            onChange={(e) => set({ furnished: e.target.checked })}
          />
          <span className="text-[15px] text-primary">Furnished</span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          {label("Description")}
          <textarea
            className={`${field} min-h-[80px] resize-y`}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          {label("Notes for Muse")}
          <input
            className={field}
            placeholder="Flexible on move-in date, prefer someone tidy"
            value={f.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
        <div className="sm:col-span-2">
          {label("Photos")}
          <div className="mt-1 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <span key={p.key} className="relative">
                <img src={p.preview} alt="" className="h-16 w-16 rounded-md object-cover" />
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
              <AddPhotoTile
                label="Add photos"
                busy={uploading}
                onFiles={addPhotos}
                className="h-16 w-16"
              />
            )}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={busy || uploading}>
          {busy ? "Listing…" : "List sublet"}
        </Button>
      </div>
    </div>
  );
}

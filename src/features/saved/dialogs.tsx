import { Bell, Link2, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { PrefToggle, Radio } from "@/features/misc/settings/controls";
import { ShareDialog } from "@/features/posts";
import { type Audience, AudienceChip } from "@/features/posts/Audience";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SavedCollection, SavedItem } from "../../../convex/saved";
import { FloatingField, floatingInputCls } from "./FloatingField";

/** Square collection tile: newest item's picture, or a grey bookmark placeholder. */
export function CollectionThumb({ cover, size }: { cover: string | null; size: number }) {
  return cover ? (
    <img
      src={cover}
      alt=""
      className="shrink-0 rounded-md border border-black/10 object-cover dark:border-white/5"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-btn text-icon"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 20 20" width={size / 2} height={size / 2} fill="currentColor" aria-hidden>
        <path d="M5.5 2h9A1.5 1.5 0 0 1 16 3.5v13.2a.6.6 0 0 1-.96.48L10 13.4l-5.04 3.78A.6.6 0 0 1 4 16.7V3.5A1.5 1.5 0 0 1 5.5 2Z" />
      </svg>
    </span>
  );
}

/** "Create collection" / "Rename collection": one name field, Cancel + submit. */
export function CollectionNameDialog({
  title,
  submitLabel,
  initial = "",
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: string;
  onSubmit: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim() !== "" && name.trim() !== initial.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={title} width={548}>
      <form onSubmit={submit} className="p-4">
        <FloatingField label="Name" value={name}>
          {(id) => (
            <input
              id={id}
              // biome-ignore lint/a11y/noAutofocus: the dialog exists to type a name
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className={floatingInputCls}
            />
          )}
        </FloatingField>
        {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" className="text-link!" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="min-w-[96px]"
            disabled={!valid || busy}
          >
            {busy ? <Spinner size={16} className="text-white" /> : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Facebook's collection picker: one collection per item, plus "New collection". */
export function AddToCollectionDialog({ item, onClose }: { item: SavedItem; onClose: () => void }) {
  const collections = useQ(api.saved.collections, {});
  const move = useM(api.saved.moveToCollection);
  const create = useM(api.saved.createCollection);
  const [picked, setPicked] = useState<Id<"savedCollections"> | null>(item.collection?._id ?? null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const done = async () => {
    setBusy(true);
    try {
      if (creating && name.trim()) await create({ name: name.trim(), itemId: item._id });
      else if (picked && picked !== item.collection?._id)
        await move({ itemId: item._id, collectionId: picked });
      onClose();
    } catch {
      setBusy(false);
    }
  };

  const canSubmit = creating
    ? name.trim() !== ""
    : picked !== null && picked !== item.collection?._id;

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add to collection" width={548}>
      <div className="flex flex-col p-2">
        {collections === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          collections.map((c) => (
            <CollectionOption
              key={c._id}
              collection={c}
              checked={!creating && picked === c._id}
              onPick={() => {
                setCreating(false);
                setPicked(c._id);
              }}
            />
          ))
        )}
        {creating ? (
          <form
            className="flex items-center gap-3 rounded-lg p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit && !busy) void done();
            }}
          >
            <CollectionThumb cover={item.thumbnail} size={48} />
            <FloatingField label="Name" value={name} className="flex-1">
              {(id) => (
                <input
                  id={id}
                  // biome-ignore lint/a11y/noAutofocus: shown in response to "New collection"
                  autoFocus
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  className={floatingInputCls}
                />
              )}
            </FloatingField>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-btn text-icon">
              <Plus size={24} strokeWidth={2.25} />
            </span>
            <span className="font-medium text-[15px] text-primary">New collection</span>
          </button>
        )}
      </div>
      <div className="flex justify-end gap-2 border-divider border-t p-4">
        <Button variant="ghost" className="text-link!" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="min-w-[96px]"
          disabled={!canSubmit || busy}
          onClick={() => void done()}
        >
          {busy ? <Spinner size={16} className="text-white" /> : "Done"}
        </Button>
      </div>
    </Modal>
  );
}

function CollectionOption({
  collection,
  checked,
  onPick,
}: {
  collection: SavedCollection;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-hover">
      <CollectionThumb cover={collection.cover} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[15px] text-primary leading-5">
          {collection.name}
        </span>
        <span className="block text-[13px] text-secondary leading-4">Only me</span>
      </span>
      <input
        type="radio"
        name="collection"
        checked={checked}
        onChange={onPick}
        className="sr-only"
      />
      <Radio checked={checked} />
    </label>
  );
}

export function ConfirmDeleteDialog({
  name,
  onConfirm,
  onClose,
}: {
  name: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Delete collection?" width={548}>
      <p className="p-4 text-[15px] text-primary leading-5">
        Are you sure you want to delete <span className="font-semibold">{name}</span>?{" "}
        {name === "For later"
          ? "Its items will stay in your saved items."
          : "Its items will move to For later."}
      </p>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="ghost" className="text-link!" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="min-w-[96px]"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onConfirm()
              .then(onClose)
              .catch(() => setBusy(false));
          }}
        >
          {busy ? <Spinner size={16} className="text-white" /> : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}

/** The Saved rail gear. */
export function SavedSettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Saved settings" width={548}>
      <div className="p-2">
        <PrefToggle
          id="saved-reminders"
          Icon={Bell}
          title="Remind me about saved items"
          sub="Get notifications about items you saved but haven't looked at in a while."
        />
      </div>
    </Modal>
  );
}

/** Share for a saved row: posts use the post Share sheet, others share as an attachment. */
export function ShareSavedDialog({ item, onClose }: { item: SavedItem; onClose: () => void }) {
  if (item.kind === "post")
    return <SharePost postId={item.refId as Id<"posts">} onClose={onClose} />;
  return <ShareItem item={item} onClose={onClose} />;
}

function SharePost({ postId, onClose }: { postId: Id<"posts">; onClose: () => void }) {
  const post = useQ(api.posts.get, { postId });
  if (post === undefined) return null;
  if (post === null) {
    return (
      <Modal open onOpenChange={(o) => !o && onClose()} title="Share" width={548}>
        <p className="p-6 text-center text-[15px] text-secondary">This post isn't available.</p>
      </Modal>
    );
  }
  return <ShareDialog post={post} onClose={onClose} />;
}

function ShareItem({ item, onClose }: { item: SavedItem; onClose: () => void }) {
  const viewer = useViewer();
  const create = useM(api.posts.create);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<Audience>("friends");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      await create({
        text: text.trim() || undefined,
        privacy: audience,
        attachments: [
          item.kind === "listing"
            ? { kind: "listing", listingId: item.refId as Id<"listings"> }
            : { kind: "event", eventId: item.refId as Id<"events"> },
        ],
      });
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Share" width={548}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Avatar src={viewer.avatar} size={40} />
          <div>
            <p className="font-semibold text-[15px] text-primary">{viewer.name}</p>
            <div className="mt-0.5 flex gap-1">
              <span className="inline-flex h-6 items-center rounded-md bg-btn px-2 font-semibold text-[13px] text-btn-text">
                Feed
              </span>
              <AudienceChip value={audience} onChange={setAudience} />
            </div>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something about this..."
          rows={2}
          className="mt-3 w-full resize-none bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
        <div className="flex items-center gap-3 overflow-hidden rounded-lg border border-divider">
          {item.thumbnail && (
            <img src={item.thumbnail} alt="" className="h-[72px] w-[72px] shrink-0 object-cover" />
          )}
          <div className="min-w-0 flex-1 pr-3">
            <p className="truncate font-semibold text-[15px] text-primary leading-5">
              {item.title}
            </p>
            <p className="truncate text-[13px] text-secondary leading-4">{item.typeLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" className="px-6" disabled={busy} onClick={() => void share()}>
            {busy ? <Spinner size={16} className="text-white" /> : "Share now"}
          </Button>
        </div>
        <div className="mt-4 border-divider border-t pt-3">
          <p className="mb-2 font-bold text-[17px] text-primary">Share to</p>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(window.location.origin + item.href)
                .then(() => setCopied(true))
            }
            className="flex w-[72px] flex-col items-center gap-1.5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125">
              <Link2 size={24} />
            </span>
            <span className="text-center text-[13px] text-primary leading-4">
              {copied ? "Link copied" : "Copy link"}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { ConvexError } from "convex/values";
import { Check } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ProfileCard } from "./cards";
import { useProfile } from "./context";
import { GalleryLightbox } from "./photos";

/** Mirrors HIGHLIGHTS_MAX in convex/profiles.ts. */
const MAX = 9;
/** Tiles shown in the card; the last one carries "+N" when there are more. */
const SHOWN = 3;

/**
 * "Highlights": photos the person featured on their profile. Your own profile
 * always shows the card ("Add highlights" / "Edit highlights"); other people's
 * only when they have featured something.
 */
export function HighlightsCard({ highlights }: { highlights: { url: string }[] | undefined }) {
  const { profile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  if (highlights === undefined) return null;
  if (!profile.isSelf && highlights.length === 0) return null;
  const urls = highlights.map((h) => h.url);
  const extra = urls.length - SHOWN;

  return (
    <ProfileCard title="Highlights">
      {urls.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
          {urls.slice(0, SHOWN).map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Open highlight ${i + 1}`}
              onClick={() => setViewing(i)}
              className="relative block aspect-[3/4] overflow-hidden bg-wash"
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {i === SHOWN - 1 && extra > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 font-bold text-[24px] text-white hover:bg-black/50">
                  +{extra}
                </span>
              ) : (
                <span className="absolute inset-0 transition-colors hover:bg-black/10" />
              )}
            </button>
          ))}
        </div>
      )}
      {profile.isSelf && (
        <Button variant="secondary" block className="mt-3" onClick={() => setEditing(true)}>
          {urls.length ? "Edit highlights" : "Add highlights"}
        </Button>
      )}
      {viewing !== null && (
        <GalleryLightbox srcs={urls} start={viewing} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <EditHighlightsDialog
          userId={profile.user._id}
          initial={urls}
          onClose={() => setEditing(false)}
        />
      )}
    </ProfileCard>
  );
}

function EditHighlightsDialog({
  userId,
  initial,
  onClose,
}: {
  userId: Id<"users">;
  initial: string[];
  onClose: () => void;
}) {
  const data = useQ(api.profiles.photos, { userId });
  const save = useM(api.profiles.setHighlights);
  const [picked, setPicked] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = picked.length >= MAX;
  const toggle = (url: string) =>
    setPicked((p) => (p.includes(url) ? p.filter((u) => u !== url) : full ? p : [...p, url]));
  const changed = picked.join("|") !== initial.join("|");

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial.length ? "Edit highlights" : "Add highlights"}
      width={700}
    >
      <div className="min-h-[200px] overflow-y-auto px-4 pt-3 pb-4">
        <p className="pb-3 text-[15px] text-secondary">
          Feature up to {MAX} of your photos at the top of your profile. Anyone who can see your
          profile can see them.
        </p>
        {data === undefined ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !data || data.yours.length === 0 ? (
          <p className="py-12 text-center font-bold text-[20px] text-secondary">
            No photos to show
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {data.yours.map((p) => {
              const order = picked.indexOf(p.url);
              const on = order >= 0;
              return (
                <button
                  key={`${p.postId}-${p.index}`}
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? "Remove from highlights" : "Add to highlights"}
                  disabled={!on && full}
                  onClick={() => toggle(p.url)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg outline-none ring-fb ring-offset-2 ring-offset-card focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                    on && "ring-[3px]",
                  )}
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 transition-colors hover:bg-black/10" />
                  <span
                    className={cn(
                      "absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 font-bold text-[13px]",
                      on ? "border-fb bg-fb text-white" : "border-white bg-black/20",
                    )}
                  >
                    {on && order + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-divider border-t px-4 py-3">
        <span className={cn("text-[13px]", error ? "text-[#e41e3f]" : "text-secondary")}>
          {error ?? (
            <>
              <Check size={14} className="mr-1 inline align-[-2px]" />
              {picked.length} of {MAX} selected
            </>
          )}
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" className="!text-link" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || !changed}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await save({ urls: picked });
                onClose();
              } catch (e) {
                setError(e instanceof ConvexError ? String(e.data) : "Couldn't save highlights");
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </span>
      </div>
    </Modal>
  );
}

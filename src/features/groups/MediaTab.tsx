import { Play } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { MediaThumb, PhotoViewer } from "@/features/posts";
import { cn } from "@/lib/format";
import { Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useGroup } from "./context";
import { ImageGlyph, LockGlyph } from "./icons";

const TABS = ["Photos", "Videos"] as const;

/** Media: every photo and video posted in the group; opens the photo theater. */
export function MediaTab() {
  const group = useGroup();
  const media = useQ(api.groups.media, { groupId: group._id });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Photos");
  const [open, setOpen] = useState<{ postId: Id<"posts">; index: number } | null>(null);
  const items = (media ?? []).filter((m) =>
    tab === "Photos" ? m.kind === "image" : m.kind === "video",
  );

  return (
    <Card className="mx-auto w-full max-w-[1186px] rounded-xl p-4">
      <h2 className="font-bold text-[20px] text-primary">Media</h2>
      <div className="mt-2 flex gap-1 border-divider border-b">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "relative h-[52px] px-4 font-semibold text-[15px]",
              tab === t ? "text-link" : "text-secondary hover:bg-hover",
            )}
          >
            {t}
            {tab === t && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-[1px] bg-fb" />
            )}
          </button>
        ))}
      </div>
      {!group.canSeePosts ? (
        <EmptyState
          icon={<LockGlyph size={40} />}
          title="This group is private"
          body="Join this group to see its photos and videos."
        />
      ) : media === undefined ? (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImageGlyph size={40} />}
          title={tab === "Photos" ? "No photos to show" : "No videos to show"}
        />
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 min-[700px]:grid-cols-4 min-[1000px]:grid-cols-5">
          {items.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setOpen({ postId: m.postId, index: m.index })}
              className="relative aspect-square overflow-hidden rounded-lg"
              aria-label={m.kind === "video" ? "Open video" : "Open photo"}
            >
              <MediaThumb media={m} className="hover:brightness-95" />
              {m.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white">
                    <Play size={22} fill="currentColor" />
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && (
        <MediaViewer postId={open.postId} index={open.index} onClose={() => setOpen(null)} />
      )}
    </Card>
  );
}

function MediaViewer({
  postId,
  index,
  onClose,
}: {
  postId: Id<"posts">;
  index: number;
  onClose: () => void;
}) {
  const post = useQ(api.posts.get, { postId });
  if (!post) return null;
  return <PhotoViewer post={post} index={index} onClose={onClose} />;
}

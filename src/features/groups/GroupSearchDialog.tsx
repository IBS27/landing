import { useEffect, useState } from "react";
import { useQ } from "@/app/viewer";
import { PostCard } from "@/features/posts";
import { Modal } from "@/ui/overlays";
import { Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { GroupView } from "./context";
import { SearchGlyph } from "./icons";
import { inGroup } from "./posts";

/** "Search this group": matching posts inside the group. */
export function GroupSearchDialog({ group, onClose }: { group: GroupView; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const results = useQ(
    api.groups.searchPosts,
    term.trim() ? { groupId: group._id, q: term } : "skip",
  );

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Search this group"
      width={720}
      bodyClassName="bg-wash"
    >
      <div className="sticky top-0 z-10 bg-card px-4 py-3 shadow-[0_1px_0_var(--divider)]">
        <label className="flex h-10 items-center gap-2 rounded-full bg-input px-3">
          <SearchGlyph size={16} className="text-icon-secondary" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the dialog exists to search
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${group.name}`}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
          />
        </label>
      </div>
      <div className="flex min-h-[300px] flex-col gap-3 p-4">
        {!term.trim() ? (
          <p className="py-16 text-center text-[15px] text-secondary">
            Search for posts, photos and people in this group.
          </p>
        ) : results === undefined ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !group.canSeePosts ? (
          <p className="py-16 text-center text-[15px] text-secondary">
            Join this group to search its posts.
          </p>
        ) : results.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-secondary">
            We didn't find any results for "{term.trim()}"
          </p>
        ) : (
          results.map((p) => <PostCard key={p._id} post={inGroup(p, group)} hideable={false} />)
        )}
      </div>
    </Modal>
  );
}

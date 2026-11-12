import { useQ } from "@/app/viewer";
import { PostCard, PostSkeleton } from "@/features/posts";
import { Card, EmptyState } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { useGroup } from "./context";
import { FileGlyph, LockGlyph } from "./icons";
import { inGroup } from "./posts";

/** Featured: the group's standout posts. */
export function FeaturedTab() {
  const group = useGroup();
  const posts = useQ(api.groups.featured, group.canSeePosts ? { groupId: group._id } : "skip");
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
      <Card className="rounded-xl p-4">
        <h2 className="font-bold text-[20px] text-primary">Featured</h2>
        <p className="mt-0.5 text-[15px] text-secondary">
          Posts that admins and moderators feature, plus this group's most popular posts.
        </p>
      </Card>
      {!group.canSeePosts ? (
        <Card className="rounded-xl">
          <EmptyState
            icon={<LockGlyph size={40} />}
            title="This group is private"
            body="Join this group to view or participate in discussions."
          />
        </Card>
      ) : posts === undefined ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <Card className="rounded-xl">
          <EmptyState title="No featured posts yet" body="Popular posts will show up here." />
        </Card>
      ) : (
        posts.map((p) => <PostCard key={p._id} post={inGroup(p, group)} />)
      )}
    </div>
  );
}

/** Files: the seed world has no shared documents, so this is Facebook's empty state. */
export function FilesTab() {
  return (
    <Card className="mx-auto w-full max-w-[680px] rounded-xl p-4">
      <h2 className="font-bold text-[20px] text-primary">Files</h2>
      <EmptyState
        icon={<FileGlyph size={40} />}
        title="No files to show"
        body="Files shared in this group will appear here."
      />
    </Card>
  );
}

/**
 * Posts core: reusable post surfaces for Feed, profiles, groups and search.
 *
 * - `PostCard({ post, expanded? })` — a feed post; `expanded` shows comments inline.
 * - `PostFeed({ source, empty? })` — paginated, infinite-scrolling list of posts.
 *   `source`: { kind: "home" } | { kind: "timeline", userId } | { kind: "group", groupId }
 *   | { kind: "recent", filter }.
 * - `Composer({ groupId?, groupName?, timelineUser? })` — "What's on your mind?" card.
 * - `CreatePostModal` — the Create/Edit post dialog (open it directly for custom triggers).
 * - `PostDialog({ post, onClose })` — "<Name>'s Post" modal with live comments.
 * - `CommentsSection({ postId })`, `CommentList`, `CommentComposer`.
 * - `ReactionIcon`, `ReactionIcons`, `ReactionPicker` — Facebook reaction emoji.
 * - `ShareDialog`, `PhotoGrid`, `PhotoViewer`, `PostSkeleton`, `PostPermalink`.
 */
export { ActionBar } from "./ActionBar";
export { AudienceIcon } from "./Audience";
export { BACKGROUNDS, backgroundFor } from "./backgrounds";
export { CommentComposer, CommentList, CommentsSection } from "./CommentsSection";
export { Composer } from "./Composer";
export { CreatePostModal } from "./CreatePostModal";
export { FollowLink } from "./FollowLink";
export { PhotoGrid } from "./PhotoGrid";
export { PhotoViewer } from "./PhotoViewer";
export { PostCard, PostContent, PostHeader } from "./PostCard";
export { PostDialog } from "./PostDialog";
export { type FeedSource, PostFeed, PostSkeleton } from "./PostFeed";
export { PostPermalink } from "./PostPermalink";
export { usePhotoTheater } from "./photoTheater";
export { REACTIONS, ReactionIcon, ReactionIcons, ReactionPicker } from "./reactions";
export { ShareDialog as ShareMenu, ShareDialog } from "./ShareDialog";
export type { CommentThread, PostView } from "./types";
export { useViewerPaginated } from "./usePaginated";
export { postUrl } from "./util";

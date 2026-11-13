import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  CircleSlash,
  Clock,
  Flag,
  Info,
  Link2,
  Pencil,
  Trash2,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn, fullTimestamp, postTime } from "@/lib/format";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Tooltip,
} from "@/ui/overlays";
import { Avatar, Button, Card, IconButton, VerifiedBadge } from "@/ui/primitives";
import { POST_REPORT_REASONS, ReportDialog } from "@/ui/ReportDialog";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ActionBar } from "./ActionBar";
import { AdStrip, AttachmentCard, adCallToAction } from "./Attachments";
import { AudienceIcon, audienceLabel } from "./Audience";
import { backgroundFor } from "./backgrounds";
import { CommentsSection, GroupCommentPreview } from "./CommentsSection";
import { CreatePostModal, FEELINGS } from "./CreatePostModal";
import { BookmarkOutline, CaretRight, CloseIcon, DotsIcon, GroupAudienceIcon } from "./icons";
import { LiveBadge, LivePostMedia } from "./LivePost";
import { PhotoGrid } from "./PhotoGrid";
import { PostDialog } from "./PostDialog";
import { BlockDialog, unfollowSub, WhySeeingDialog } from "./PostMenuDialogs";
import { usePhotoTheater } from "./photoTheater";
import type { PostView, UserSummary } from "./types";
import { groupParams, isLargeText, postUrl, truncate } from "./util";
import { useVideoTheater } from "./videoTheaterNav";
import { viewsLabel } from "./views";

/**
 * A Facebook feed post. `expanded` (permalink) shows the full text and the
 * comments inline; otherwise Comment opens the post dialog.
 */
export function PostCard({
  post,
  expanded = false,
  hideable = true,
  nameSuffix,
  className,
  inlineComments = false,
  focusCommentId,
}: {
  post: PostView;
  expanded?: boolean;
  /** Permalink only: a linked comment to open, scroll to and highlight. */
  focusCommentId?: Id<"comments">;
  /** Profile timelines: the top comment and a "Write a comment…" row under the post. */
  inlineComments?: boolean;
  /** Feeds show the X "Hide post" button; search results don't. */
  hideable?: boolean;
  /** After the author's name (search: "· Follow"). */
  nameSuffix?: ReactNode;
  className?: string;
}) {
  // "Hide post" and "Snooze" persist per viewer; feeds drop snoozed authors server-side.
  const hides = useQ(api.posts.hides, expanded || !hideable ? "skip" : {});
  const hide = useM(api.posts.hide);
  const unhide = useM(api.posts.unhide);
  const hidden = hides?.posts.includes(post._id)
    ? post._id
    : hides?.snoozed.includes(post.author._id)
      ? post.author._id
      : null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  // Group surfaces show the top comment and a "Write an answer…" row under each post.
  const inGroups = useRouterState({ select: (s) => s.location.pathname.startsWith("/groups") });

  if (hidden)
    return (
      <Card className={cn("flex items-center gap-3 rounded-xl p-4", className)}>
        <CircleSlash size={24} className="shrink-0 text-icon" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px]">
            {hidden === post._id ? "Hidden" : "Snoozed for 30 days"}
          </p>
          <p className="text-secondary text-sm">
            {hidden === post._id
              ? "Hiding posts helps us personalize your Feed."
              : `You won't see posts from ${post.author.name} for 30 days.`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void unhide({ targetId: hidden })}>
          Undo
        </Button>
      </Card>
    );

  return (
    <Card className={cn("overflow-hidden rounded-xl", className)}>
      <PostHeader
        post={post}
        onHide={expanded || !hideable ? undefined : () => void hide({ postId: post._id })}
        nameSuffix={nameSuffix}
      />
      <PostContent post={post} expanded={expanded} onSeeMore={() => setDialogOpen(true)} />
      <ActionBar
        post={post}
        onComment={() => (expanded ? setFocusKey((k) => k + 1) : setDialogOpen(true))}
        trailing={<ViewCount post={post} />}
      />
      {expanded && (
        <div className="border-divider border-t">
          <CommentsSection postId={post._id} focusKey={focusKey} focusCommentId={focusCommentId} />
        </div>
      )}
      {!expanded && (inGroups || inlineComments) && (
        <GroupCommentPreview
          postId={post._id}
          commentCount={post.commentCount}
          onViewMore={() => setDialogOpen(true)}
          placeholder={inGroups ? undefined : "Write a comment…"}
        />
      )}
      {dialogOpen && <PostDialog post={post} onClose={() => setDialogOpen(false)} />}
    </Card>
  );
}

/* ---------- Header ---------- */

export function PostHeader({
  post,
  onHide,
  compact,
  nameSuffix,
  metaSuffix,
}: {
  post: PostView;
  /** Shows the X "Hide post" button. */
  onHide?: () => void;
  /** Shared-post header inside another post: no menu. */
  compact?: boolean;
  /** After the author's name (Watch: "· Follow"). */
  nameSuffix?: ReactNode;
  /** After the time and audience (Watch: "· 1.2K views"). */
  metaSuffix?: ReactNode;
}) {
  // While broadcasting, Facebook rings the author's avatar in red and adds a LIVE label.
  const liveNow = !!post.live && post.live.endedAt === null;
  const author = (
    <>
      <NameLink user={post.author} />
      {liveNow && <LiveBadge small className="ml-1.5 align-[1px]" />}
    </>
  );
  const openVideo = useVideoTheater();
  // A video post's timestamp opens the video theater, like Facebook's /watch?v= links.
  const video = post.media.length === 1 && post.media[0].kind === "video";
  const meta = (
    <span className="flex flex-wrap items-center gap-x-1 font-semibold text-[13px] text-secondary leading-4 [&>*]:whitespace-nowrap">
      {post.sponsored ? (
        <Link
          to="/$username/posts/$postId"
          params={{ username: post.author.username, postId: post._id }}
          className="hover:underline"
        >
          Ad
        </Link>
      ) : (
        <Tooltip content={fullTimestamp(post.createdAt)} side="bottom">
          {video ? (
            <Link
              to="/watch"
              search={{ v: post._id }}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                openVideo(post._id);
              }}
              className="hover:underline"
            >
              {postTime(post.createdAt)}
            </Link>
          ) : (
            <Link
              to="/$username/posts/$postId"
              params={{ username: post.author.username, postId: post._id }}
              className="hover:underline"
            >
              {postTime(post.createdAt)}
            </Link>
          )}
        </Tooltip>
      )}
      <span aria-hidden>·</span>
      <Tooltip
        content={
          post.group
            ? post.group.privacy === "private"
              ? `Members of ${post.group.name}`
              : "Public group"
            : `Shared with: ${post.privacy === "friends" ? "Your friends" : audienceLabel(post.privacy)}`
        }
      >
        <span className="inline-flex">
          {post.group ? (
            post.group.privacy === "private" ? (
              <GroupAudienceIcon />
            ) : (
              <AudienceIcon value="public" />
            )
          ) : (
            <AudienceIcon value={post.privacy} />
          )}
        </span>
      </Tooltip>
      {post.editedAt && (
        <>
          <span aria-hidden>·</span>
          <span>Edited</span>
        </>
      )}
      {metaSuffix}
    </span>
  );

  return (
    <div className="flex items-start gap-2 px-3 pt-3 pb-1">
      {post.group ? (
        <Link
          to="/groups/$groupId"
          params={groupParams(post.group)}
          className="relative h-10 w-10 shrink-0"
          aria-label={post.group.name}
        >
          <Avatar src={post.group.cover} size={40} square />
          <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-card">
            <Avatar src={post.author.avatar} size={24} />
          </span>
        </Link>
      ) : (
        <Link
          to="/$username"
          params={{ username: post.author.username }}
          className="shrink-0 hover:brightness-95"
        >
          <Avatar src={post.author.avatar} size={40} live={liveNow} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {post.group ? (
          <>
            <p className="font-semibold text-[15px] leading-5">
              <Link
                to="/groups/$groupId"
                params={groupParams(post.group)}
                className="hover:underline"
              >
                {post.group.name}
              </Link>
            </p>
            <div className="flex flex-wrap items-center gap-1 text-[13px] leading-4">
              <Link
                to="/$username"
                params={{ username: post.author.username }}
                className="font-semibold text-primary hover:underline"
              >
                {post.author.name}
              </Link>
              <span className="text-secondary" aria-hidden>
                ·
              </span>
              {meta}
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-5">
              {author}
              {nameSuffix}
              {post.timelineUser && (
                <>
                  <CaretRight size={10} className="mx-1 inline text-secondary" />
                  <NameLink user={post.timelineUser} />
                </>
              )}
              <Activity post={post} />
            </p>
            <div className="mt-0.5">{meta}</div>
          </>
        )}
      </div>
      {!compact && (
        <div className="flex items-center">
          <PostMenu post={post} onHide={onHide} />
          {onHide && (
            <IconButton label="Hide post" variant="ghost" onClick={onHide}>
              <CloseIcon className="text-icon-secondary" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

function NameLink({ user }: { user: UserSummary }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        to="/$username"
        params={{ username: user.username }}
        className="font-semibold text-primary hover:underline"
      >
        {user.name}
      </Link>
      {user.verified && <VerifiedBadge />}
    </span>
  );
}

/** "is feeling happy", "is at Place", "is with Name and 2 others". */
function Activity({ post }: { post: PostView }) {
  const parts: ReactNode[] = [];
  // Stored as "proud" (composer) or "feeling proud" (seed): show "is 😌 feeling proud".
  const feeling = post.feeling?.replace(/^feeling\s+/i, "");
  const emoji = FEELINGS.find(([, f]) => f === feeling)?.[0];
  if (feeling)
    parts.push(
      <span key="f">
        {" "}
        is {emoji ? `${emoji} ` : ""}feeling {feeling}
      </span>,
    );
  // The timeline owner is already named ("A ▸ B"), so don't repeat them as tagged.
  const tagged = post.tagged.filter((u) => u._id !== post.timelineUser?._id);
  if (tagged.length) {
    const [first, ...rest] = tagged;
    parts.push(
      <span key="t">
        {post.feeling ? " with " : " is with "}
        <NameLink user={first} />
        {rest.length === 1 && (
          <>
            {" "}
            and <NameLink user={rest[0]} />
          </>
        )}
        {rest.length > 1 && (
          <>
            {" "}
            and <span className="font-semibold">{rest.length} others</span>
          </>
        )}
      </span>,
    );
  }
  if (post.place)
    parts.push(
      <span key="p">
        {post.feeling || tagged.length ? " at " : " is at "}
        <span className="font-semibold">{post.place}</span>
      </span>,
    );
  if (post.live) return <span> {post.live.endedAt === null ? "is live now." : "was live."}</span>;
  if (parts.length === 0) return null;
  return (
    <span className="text-primary">
      {parts}
      {post.place || post.feeling || tagged.length ? "." : ""}
    </span>
  );
}

/** "1.2K views" on the right of a video post's action bar, like Facebook's stats row. */
function ViewCount({ post }: { post: PostView }) {
  const label = viewsLabel(post);
  if (!label) return null;
  return <span className="mr-1 px-1 text-[15px] text-secondary leading-5">{label}</span>;
}

/* ---------- "…" menu ---------- */

function PostMenu({ post, onHide }: { post: PostView; onHide?: () => void }) {
  const toggleSave = useM(api.saved.toggle);
  const remove = useM(api.posts.remove);
  const snooze = useM(api.posts.snooze);
  const setSubscribed = useM(api.posts.setSubscribed);
  const report = useM(api.reports.create);
  const follow = useM(api.media.follow);
  const followingIds = useQ(api.pages.followingIds, post.canEdit ? "skip" : {});
  const following = !post.canEdit && !!followingIds?.includes(post.author._id);
  const unfollow = () => void follow({ targetId: post.author._id, follow: false });
  const [why, setWhy] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild>
          <IconButton label="Actions for this post" variant="ghost">
            <DotsIcon className="text-icon-secondary" />
          </IconButton>
        </MenuTrigger>
        <MenuContent width={344}>
          <MenuItem
            icon={<BookmarkOutline />}
            label={post.viewerSaved ? "Unsave post" : "Save post"}
            sub={
              post.viewerSaved
                ? "Remove this from your saved items."
                : "Add this to your saved items."
            }
            onSelect={() => void toggleSave({ kind: "post", refId: post._id })}
          />
          <MenuItem
            icon={<Link2 size={20} />}
            label="Copy link"
            onSelect={() =>
              void navigator.clipboard?.writeText(window.location.origin + postUrl(post))
            }
          />
          <MenuSeparator />
          {post.canEdit && (
            <MenuItem
              icon={<Pencil size={20} />}
              label="Edit post"
              onSelect={() => setEditing(true)}
            />
          )}
          {post.canDelete && (
            <MenuItem
              icon={<Trash2 size={20} />}
              label="Delete post"
              onSelect={() => setConfirmDelete(true)}
            />
          )}
          {!post.canEdit && (
            <>
              <MenuItem
                icon={post.viewerSubscribed ? <BellOff size={20} /> : <Bell size={20} />}
                label={
                  post.viewerSubscribed
                    ? "Turn off notifications for this post"
                    : "Turn on notifications for this post"
                }
                onSelect={() =>
                  void setSubscribed({ postId: post._id, on: !post.viewerSubscribed })
                }
              />
              {onHide && (
                <MenuItem
                  icon={<CircleSlash size={20} />}
                  label="Hide post"
                  sub="See fewer posts like this."
                  onSelect={onHide}
                />
              )}
              <MenuItem
                icon={<Info size={20} />}
                label={post.sponsored ? "Why am I seeing this ad?" : "Why am I seeing this post?"}
                onSelect={() => setWhy(true)}
              />
              <MenuItem
                icon={<Clock size={20} />}
                label={`Snooze ${post.author.firstName} for 30 days`}
                sub="Temporarily stop seeing posts."
                onSelect={() => void snooze({ userId: post.author._id })}
              />
              {following && (
                <MenuItem
                  icon={<UserMinus size={20} />}
                  label={`Unfollow ${post.author.name}`}
                  sub={unfollowSub(post)}
                  onSelect={unfollow}
                />
              )}
              {post.group && (
                <MenuItem
                  icon={<Users size={20} />}
                  label="View group"
                  onSelect={() =>
                    void navigate({ to: "/groups/$groupId", params: groupParams(post.group!) })
                  }
                />
              )}
              <MenuSeparator />
              <MenuItem
                icon={<Flag size={20} />}
                label="Report post"
                sub="We won't let them know who reported this."
                onSelect={() => setReporting(true)}
              />
              {!post.sponsored && (
                <MenuItem
                  icon={<UserX size={20} />}
                  label={
                    post.author.kind === "page"
                      ? `Block ${post.author.name}`
                      : `Block ${post.author.firstName}'s profile`
                  }
                  sub="You won't be able to see or contact each other."
                  onSelect={() => setBlocking(true)}
                />
              )}
            </>
          )}
        </MenuContent>
      </Menu>
      {editing && <CreatePostModal open onOpenChange={setEditing} editing={post} />}
      {why && (
        <WhySeeingDialog
          post={post}
          following={following}
          onUnfollow={unfollow}
          onHide={onHide}
          onClose={() => setWhy(false)}
        />
      )}
      {blocking && <BlockDialog post={post} onClose={() => setBlocking(false)} />}
      {reporting && (
        <ReportDialog
          noun="post"
          reasons={POST_REPORT_REASONS}
          onSubmit={(reason) => report({ targetType: "post", targetId: post._id, reason })}
          onClose={() => setReporting(false)}
          followUps={
            onHide
              ? [
                  {
                    icon: <CircleSlash size={20} />,
                    label: "Hide post",
                    sub: "See fewer posts like this.",
                    onClick: onHide,
                  },
                ]
              : []
          }
        />
      )}
      {confirmDelete && (
        <Modal open onOpenChange={setConfirmDelete} title="Delete post?" width={548}>
          <div className="p-4">
            <p className="text-[15px]">
              Are you sure you want to delete this post? This can't be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="link" className="px-3" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="px-8"
                onClick={() => {
                  setConfirmDelete(false);
                  void remove({ postId: post._id });
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- Body ---------- */

export function PostContent({
  post,
  expanded,
  onSeeMore,
  nested,
  smallText,
}: {
  post: PostView;
  expanded?: boolean;
  onSeeMore?: () => void;
  /** Inside a shared post's frame. */
  nested?: boolean;
  /** Never use the large type for short posts (photo theater side panel). */
  smallText?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const openPhoto = usePhotoTheater();
  const bg = backgroundFor(post.background);
  const text = post.text ?? "";
  const cut = expanded || showAll ? null : truncate(text);
  const large = !smallText && !post.live && isLargeText(post);

  return (
    <>
      {bg && text ? (
        <div
          className="flex min-h-[340px] items-center justify-center px-10 py-12 text-center font-bold text-[30px] leading-9"
          style={{ background: bg.css, color: bg.text }}
        >
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
      ) : (
        text && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words px-3 pt-1 pb-4 text-primary",
              large ? "text-[24px] leading-7" : "text-[15px] leading-5",
              (post.media.length > 0 || post.attachments.length > 0 || post.shared) && "pb-3",
            )}
          >
            {cut ?? text}
            {cut && (
              <>
                …{" "}
                <button
                  type="button"
                  onClick={() => (onSeeMore && text.length > 1500 ? onSeeMore() : setShowAll(true))}
                  className="font-semibold hover:underline"
                >
                  See more
                </button>
              </>
            )}
          </div>
        )
      )}
      {post.live && <LivePostMedia post={{ ...post, live: post.live }} />}
      {post.media.length > 0 && (
        <PhotoGrid
          media={post.media}
          postId={post._id}
          onOpen={(i) => openPhoto(post._id, i)}
          className={nested ? "" : undefined}
          sponsored={post.sponsored}
        />
      )}
      {post.attachments.map((att, i) => (
        <AttachmentCard
          key={i}
          att={att}
          cta={
            post.sponsored && att.kind === "link" ? adCallToAction(post.text, att.url) : undefined
          }
        />
      ))}
      {post.sponsored && !post.attachments.some((a) => a.kind === "link") && (
        <Link
          to="/$username"
          params={{ username: post.author.username }}
          className="group block border-divider border-t"
        >
          <AdStrip domain="facebook.com" title={post.author.name} cta={adCallToAction(post.text)} />
        </Link>
      )}
      {post.shared && <SharedPost shared={post.shared} />}
    </>
  );
}

function SharedPost({ shared }: { shared: PostView | "unavailable" }) {
  if (shared === "unavailable")
    return (
      <div className="mx-4 mb-3 rounded-lg border border-divider bg-comment px-4 py-3">
        <p className="font-semibold text-[17px]">This content isn't available right now</p>
        <p className="mt-1 text-[15px] text-secondary">
          When this happens, it's usually because the owner only shared it with a small group of
          people, changed who can see it or it's been deleted.
        </p>
      </div>
    );
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-lg border border-divider">
      {(shared.media.length > 0 || shared.attachments.length > 0) && (
        <div className="-mb-px">
          <PostContent post={{ ...shared, text: null, shared: null }} nested />
        </div>
      )}
      <PostHeader post={shared} compact />
      {(shared.text || shared.background) && (
        <PostContent post={{ ...shared, media: [], attachments: [], shared: null }} nested />
      )}
      {!shared.text && <div className="h-2" />}
    </div>
  );
}

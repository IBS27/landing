import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, CircleSlash, Clock, Flag, Link2, Pencil, Trash2, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM } from "@/app/viewer";
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
import { api } from "../../../convex/_generated/api";
import { ActionBar } from "./ActionBar";
import { AdStrip, AttachmentCard, adCallToAction } from "./Attachments";
import { AudienceIcon, audienceLabel } from "./Audience";
import { backgroundFor } from "./backgrounds";
import { CommentsSection, GroupCommentPreview } from "./CommentsSection";
import { CreatePostModal, FEELINGS } from "./CreatePostModal";
import { BookmarkOutline, CaretRight, CloseIcon, DotsIcon, GroupAudienceIcon } from "./icons";
import { PhotoGrid } from "./PhotoGrid";
import { PostDialog } from "./PostDialog";
import { usePhotoTheater } from "./photoTheater";
import type { PostView, UserSummary } from "./types";
import { groupParams, isLargeText, postUrl, truncate } from "./util";

/**
 * A Facebook feed post. `expanded` (permalink) shows the full text and the
 * comments inline; otherwise Comment opens the post dialog.
 */
export function PostCard({
  post,
  expanded = false,
  hideable = true,
  className,
}: {
  post: PostView;
  expanded?: boolean;
  /** Feeds show the X "Hide post" button; search results don't. */
  hideable?: boolean;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  // Group surfaces show the top comment and a "Write an answer…" row under each post.
  const inGroups = useRouterState({ select: (s) => s.location.pathname.startsWith("/groups") });

  if (hidden)
    return (
      <Card className={cn("flex items-center gap-3 rounded-xl p-4", className)}>
        <CircleSlash size={24} className="shrink-0 text-icon" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px]">Hidden</p>
          <p className="text-secondary text-sm">Hiding posts helps us personalize your Feed.</p>
        </div>
        <Button variant="secondary" onClick={() => setHidden(false)}>
          Undo
        </Button>
      </Card>
    );

  return (
    <Card className={cn("overflow-hidden rounded-xl", className)}>
      <PostHeader post={post} onHide={expanded || !hideable ? undefined : () => setHidden(true)} />
      <PostContent post={post} expanded={expanded} onSeeMore={() => setDialogOpen(true)} />
      <ActionBar
        post={post}
        onComment={() => (expanded ? setFocusKey((k) => k + 1) : setDialogOpen(true))}
      />
      {expanded && (
        <div className="border-divider border-t">
          <CommentsSection postId={post._id} focusKey={focusKey} />
        </div>
      )}
      {!expanded && inGroups && (
        <GroupCommentPreview
          postId={post._id}
          commentCount={post.commentCount}
          onViewMore={() => setDialogOpen(true)}
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
}: {
  post: PostView;
  /** Shows the X "Hide post" button. */
  onHide?: () => void;
  /** Shared-post header inside another post: no menu. */
  compact?: boolean;
}) {
  const author = <NameLink user={post.author} />;
  const meta = (
    <span className="flex items-center gap-1 font-semibold text-[13px] text-secondary leading-4">
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
          <Link
            to="/$username/posts/$postId"
            params={{ username: post.author.username, postId: post._id }}
            className="hover:underline"
          >
            {postTime(post.createdAt)}
          </Link>
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
          <Avatar src={post.author.avatar} size={40} />
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
  if (parts.length === 0) return null;
  return (
    <span className="text-primary">
      {parts}
      {post.place || post.feeling || tagged.length ? "." : ""}
    </span>
  );
}

/* ---------- "…" menu ---------- */

function PostMenu({ post, onHide }: { post: PostView; onHide?: () => void }) {
  const toggleSave = useM(api.saved.toggle);
  const remove = useM(api.posts.remove);
  const [editing, setEditing] = useState(false);
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
              label="Move to trash"
              sub="Items in your trash are deleted after 30 days."
              onSelect={() => setConfirmDelete(true)}
            />
          )}
          {!post.canEdit && (
            <>
              <MenuItem icon={<Bell size={20} />} label="Turn on notifications for this post" />
              {onHide && (
                <MenuItem
                  icon={<CircleSlash size={20} />}
                  label="Hide post"
                  sub="See fewer posts like this."
                  onSelect={onHide}
                />
              )}
              <MenuItem
                icon={<Clock size={20} />}
                label={`Snooze ${post.author.firstName} for 30 days`}
                sub="Temporarily stop seeing posts."
                onSelect={onHide}
              />
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
              />
            </>
          )}
        </MenuContent>
      </Menu>
      {editing && <CreatePostModal open onOpenChange={setEditing} editing={post} />}
      {confirmDelete && (
        <Modal open onOpenChange={setConfirmDelete} title="Move to your trash?" width={548}>
          <div className="p-4">
            <p className="text-[15px]">
              Items in your trash will be automatically deleted after 30 days. You can delete them
              from your trash earlier by going to activity log in settings.
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
                Move
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
  const large = !smallText && isLargeText(post);

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
      {post.media.length > 0 && (
        <PhotoGrid
          media={post.media}
          onOpen={(i) => openPhoto(post._id, i)}
          className={nested ? "" : undefined}
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

import {
  CircleSlash,
  Megaphone,
  MessageCircle,
  Tag,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { PostView } from "./types";

const REASON_ICON: Record<string, ReactNode> = {
  follow: <UserCheck size={20} />,
  friend: <Users size={20} />,
  group: <UsersRound size={20} />,
  reacted: <ThumbsUp size={20} />,
  commented: <MessageCircle size={20} />,
  tagged: <Tag size={20} />,
  popular: <TrendingUp size={20} />,
  ad: <Megaphone size={20} />,
};

/** "Why am I seeing this post?": reasons derived from the viewer's real connections. */
export function WhySeeingDialog({
  post,
  following,
  onUnfollow,
  onHide,
  onClose,
}: {
  post: PostView;
  following: boolean;
  onUnfollow: () => void;
  onHide?: () => void;
  onClose: () => void;
}) {
  const data = useQ(api.feedReasons.whySeeing, { postId: post._id });
  const noun = post.sponsored ? "ad" : "post";
  const actions: { icon: ReactNode; label: string; sub: string; run: () => void }[] = [];
  if (following)
    actions.push({
      icon: <UserMinus size={20} />,
      label: `Unfollow ${post.author.name}`,
      sub: unfollowSub(post),
      run: onUnfollow,
    });
  if (onHide)
    actions.push({
      icon: <CircleSlash size={20} />,
      label: "Hide post",
      sub: "See fewer posts like this.",
      run: onHide,
    });

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Why you're seeing this ${noun}`}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 pb-3">
          <Avatar src={post.author.avatar} size={40} />
          <p className="text-[15px] text-primary leading-5">
            {post.sponsored ? "This ad is from " : "This post is from "}
            <span className="font-semibold">{post.author.name}</span>
            {post.group && (
              <>
                {" "}
                in <span className="font-semibold">{post.group.name}</span>
              </>
            )}
            {/[.!?]$/.test(post.group?.name ?? post.author.name) ? "" : "."}
          </p>
        </div>
        <h3 className="pb-1 font-semibold text-[17px] text-primary leading-6">
          Why you might see posts like this
        </h3>
        {data === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : data === null ? (
          <p className="py-3 text-[15px] text-secondary">This content isn't available anymore.</p>
        ) : (
          <ul>
            {data.reasons.map((r) => (
              <li key={r.text} className="flex items-center gap-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                  {REASON_ICON[r.kind]}
                </span>
                <span className="text-[15px] text-primary leading-5">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {actions.length > 0 && (
        <div className="mx-4 border-divider border-t pt-3 pb-3">
          <h3 className="pb-1 font-semibold text-[17px] text-primary leading-6">What you can do</h3>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                a.run();
                onClose();
              }}
              className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                {a.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[15px] text-primary leading-5">
                  {a.label}
                </span>
                <span className="block text-[13px] text-secondary leading-4">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function unfollowSub(post: PostView) {
  if (post.author.kind === "page") return "Stop seeing posts from this Page.";
  if (post.viewerFollowsAuthor) return "Stop seeing posts but stay friends.";
  return `Stop seeing posts from ${post.author.firstName}.`;
}

/** Facebook's block confirmation for a person or a Page. */
export function BlockDialog({ post, onClose }: { post: PostView; onClose: () => void }) {
  const block = useM(api.settings.block);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { name, firstName, kind } = post.author;
  const isPage = kind === "page";
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Block ${name}?`} width={548}>
      <div className="p-4 text-[15px] text-primary leading-5">
        {isPage ? (
          <p>
            {name} won't be able to see your profile, message you or interact with your posts and
            comments. If you follow {name}, you'll also unfollow it.
          </p>
        ) : (
          <>
            <p className="pb-2">{firstName} will no longer be able to:</p>
            <ul className="list-disc pl-6">
              <li>See your posts on your profile</li>
              <li>Tag you</li>
              <li>Invite you to events or groups</li>
              <li>Message you</li>
              <li>Add you as a friend</li>
            </ul>
            <p className="pt-3">
              If you're friends, blocking {firstName} will also unfriend {firstName}.
            </p>
          </>
        )}
        {error && <p className="pt-3 text-[13px] text-negative">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="link" className="px-3" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="px-8"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              block({ userId: post.author._id })
                .then(onClose)
                .catch(() => {
                  setBusy(false);
                  setError("Something went wrong. Please try again.");
                });
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}

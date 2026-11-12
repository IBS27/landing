import { LayoutGrid, List, Settings, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import {
  BACKGROUNDS,
  CreatePostModal,
  PostCard,
  PostDialog,
  PostSkeleton,
  type PostView,
  useViewerPaginated,
} from "@/features/posts";
import type { ComposerPanel } from "@/features/posts/CreatePostModal";
import { FeelingIcon, LiveVideoIcon, PhotoVideoIcon, TagPeopleIcon } from "@/features/posts/icons";
import { cn, postTime } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  FooterLinks,
  FriendsPreviewCard,
  IntroCard,
  PhotosPreviewCard,
  useStickyColumn,
} from "./cards";
import { useProfile } from "./context";

type PostedBy = "anyone" | "owner" | "others";
type Filters = { postedBy: PostedBy; year: number | undefined };

/** The All tab: intro/photos/friends on the left, composer and timeline on the right. */
export function PostsTab() {
  const { profile } = useProfile();
  const { user, isSelf, relation } = profile;
  const overview = useQ(api.profiles.overview, { userId: user._id });
  const sticky = useStickyColumn();
  const [filters, setFilters] = useState<Filters>({ postedBy: "anyone", year: undefined });
  const [view, setView] = useState<"list" | "grid">("list");
  const canPost = isSelf || relation === "friend";

  return (
    <div className="flex items-start gap-4 max-[899px]:flex-col">
      <div
        ref={sticky.ref}
        style={sticky.style}
        className="sticky flex w-full min-w-0 flex-col gap-4 min-[900px]:max-w-[490px] min-[900px]:flex-[1_1_490px]"
      >
        <IntroCard />
        <PhotosPreviewCard photos={overview?.photos} />
        {!profile.isPage && (
          <FriendsPreviewCard
            friends={overview?.friends}
            count={overview?.friendCount ?? profile.friendCount}
            mutual={overview?.mutualCount ?? 0}
          />
        )}
        <FooterLinks />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-4 min-[900px]:max-w-[680px] min-[900px]:flex-[1_1_680px]">
        {canPost && <ProfileComposer />}
        <PostsHeader filters={filters} onFilters={setFilters} view={view} onView={setView} />
        <Timeline userId={user._id} filters={filters} view={view} />
      </div>
    </div>
  );
}

/* ---------------- Composer (profile layout: pill + 3 buttons) ---------------- */

function ProfileComposer() {
  const viewer = useViewer();
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ComposerPanel | undefined>();
  const openWith = (p?: ComposerPanel) => {
    setPanel(p);
    setOpen(true);
  };
  const timelineUser = isSelf ? undefined : { _id: user._id, firstName: user.firstName };

  return (
    <Card className="rounded-xl px-4 pt-3 pb-2">
      <div className="flex items-center gap-2 border-divider border-b pb-3">
        <Avatar src={viewer.avatar} size={40} />
        <button
          type="button"
          onClick={() => openWith()}
          className="h-10 min-w-0 flex-1 truncate rounded-full bg-input px-3 text-left text-[17px] text-secondary transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          {isSelf ? "What's on your mind?" : `Write something to ${user.firstName}...`}
        </button>
      </div>
      <div className="flex pt-2">
        {isSelf ? (
          <>
            <ComposerAction
              icon={<LiveVideoIcon />}
              label="Live video"
              onClick={() => openWith()}
            />
            <ComposerAction
              icon={<PhotoVideoIcon />}
              label="Photo/video"
              onClick={() => openWith("photo")}
            />
            <ComposerAction
              icon={<LifeUpdateIcon />}
              label="Life update"
              onClick={() => openWith("feeling")}
            />
          </>
        ) : (
          <>
            <ComposerAction
              icon={<PhotoVideoIcon />}
              label="Photo/video"
              onClick={() => openWith("photo")}
            />
            <ComposerAction
              icon={<TagPeopleIcon />}
              label="Tag people"
              onClick={() => openWith("tag")}
            />
            <ComposerAction
              icon={<FeelingIcon />}
              label="Feeling/activity"
              onClick={() => openWith("feeling")}
            />
          </>
        )}
      </div>
      <CreatePostModal
        open={open}
        onOpenChange={setOpen}
        initialPanel={panel}
        timelineUser={timelineUser}
      />
    </Card>
  );
}

function ComposerAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-[15px] text-secondary transition-colors hover:bg-hover"
    >
      {icon}
      {label}
    </button>
  );
}

function LifeUpdateIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <path
        fill="#1877F2"
        d="M4.5 2.5a1 1 0 0 1 1 1v.4l14.3-.7a.8.8 0 0 1 .62 1.32L16.9 8.9l3.6 4.4a.8.8 0 0 1-.6 1.3l-14.4-.5V21a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1Z"
      />
      <path fill="#0a5ad4" opacity=".55" d="M5.5 3.9 9 4v10.2l-3.5-.1Z" />
    </svg>
  );
}

/* ---------------- Posts header: Filters, Manage posts, List / Grid ---------------- */

function PostsHeader({
  filters,
  onFilters,
  view,
  onView,
}: {
  filters: Filters;
  onFilters: (f: Filters) => void;
  view: "list" | "grid";
  onView: (v: "list" | "grid") => void;
}) {
  const { profile } = useProfile();
  const [filterOpen, setFilterOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const active = filters.postedBy !== "anyone" || filters.year !== undefined;
  return (
    <Card className="rounded-xl">
      <div className="flex items-center justify-between py-3 pr-4 pl-4">
        <h2 className="font-bold text-[20px] text-primary leading-6">Posts</h2>
        <div className="flex gap-2">
          <Button
            variant={active ? "soft" : "secondary"}
            icon={<SlidersHorizontal size={16} strokeWidth={2.6} />}
            onClick={() => setFilterOpen(true)}
          >
            Filters
          </Button>
          {profile.isSelf && (
            <Button
              variant="secondary"
              icon={<Settings size={16} strokeWidth={2.6} />}
              onClick={() => setManageOpen(true)}
            >
              Manage posts
            </Button>
          )}
        </div>
      </div>
      {profile.isSelf && (
        <div className="mx-4 flex border-divider border-t">
          {(
            [
              { key: "list", label: "List view", Icon: List },
              { key: "grid", label: "Grid view", Icon: LayoutGrid },
            ] as const
          ).map(({ key, label, Icon }) => {
            const on = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onView(key)}
                className={cn(
                  "group relative flex h-[46px] flex-1 items-center justify-center pt-1 pb-[3px]",
                  on ? "text-link" : "text-secondary",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-1.5 rounded-md font-semibold text-[15px]",
                    !on && "group-hover:bg-hover",
                  )}
                >
                  <Icon size={18} strokeWidth={2.4} />
                  {label}
                </span>
                {on && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-fb" />}
              </button>
            );
          })}
        </div>
      )}
      <FiltersDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onChange={onFilters}
      />
      {profile.isSelf && <ManagePostsDialog open={manageOpen} onOpenChange={setManageOpen} />}
    </Card>
  );
}

function FiltersDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const { profile } = useProfile();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const first = new Date(profile.user.joinedAt).getFullYear();
  const now = new Date().getFullYear();
  const years = Array.from({ length: now - first + 1 }, (_, i) => now - i);
  const select =
    "h-9 rounded-md bg-btn px-3 font-semibold text-[15px] text-primary outline-none hover:brightness-95";

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Post filters" width={548}>
      <div className="p-4">
        <p className="pb-4 text-[15px] text-secondary">
          Use filters to find posts on {profile.isSelf ? "your" : "this"} profile.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <span className="w-24 font-semibold text-[15px] text-primary">Go to:</span>
            <select
              aria-label="Year"
              className={select}
              value={draft.year ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 font-semibold text-[15px] text-primary">Posted by:</span>
            <select
              aria-label="Posted by"
              className={select}
              value={draft.postedBy}
              onChange={(e) => setDraft({ ...draft, postedBy: e.target.value as PostedBy })}
            >
              <option value="anyone">Anyone</option>
              <option value="owner">{profile.isSelf ? "You" : profile.user.firstName}</option>
              <option value="others">Others</option>
            </select>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-divider border-t p-4">
        <button
          type="button"
          className="h-9 rounded-md px-3 font-semibold text-[15px] text-link transition-colors hover:bg-hover"
          onClick={() => {
            onChange({ postedBy: "anyone", year: undefined });
            onOpenChange(false);
          }}
        >
          Clear
        </button>
        <Button
          variant="primary"
          className="w-[112px]"
          onClick={() => {
            onChange(draft);
            onOpenChange(false);
          }}
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Manage posts: select your own posts and delete them in bulk. */
function ManagePostsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { profile } = useProfile();
  const { results, status, loadMore } = useViewerPaginated(
    api.profiles.timeline,
    open ? { userId: profile.user._id, postedBy: "owner" as const } : "skip",
    20,
  );
  const remove = useM(api.posts.remove);
  const [selected, setSelected] = useState<Set<Id<"posts">>>(new Set());
  const [busy, setBusy] = useState(false);
  const posts = results as PostView[];
  const toggle = (id: Id<"posts">) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const del = async () => {
    setBusy(true);
    try {
      for (const id of selected) await remove({ postId: id });
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Manage posts" width={700}>
      <div className="max-h-[520px] min-h-[200px] p-2">
        {status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center font-bold text-[20px] text-secondary">
            No posts to manage
          </p>
        ) : (
          <>
            {posts.map((p) => (
              <label
                key={p._id}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-hover"
              >
                <PostThumb post={p} size={60} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] text-primary">
                    {p.text ?? (p.media.length ? "Photo" : "Post")}
                  </span>
                  <span className="text-[13px] text-secondary">{postTime(p.createdAt)}</span>
                </span>
                <input
                  type="checkbox"
                  checked={selected.has(p._id)}
                  onChange={() => toggle(p._id)}
                  className="h-5 w-5 accent-[var(--fb-blue)]"
                />
              </label>
            ))}
            {status === "CanLoadMore" && (
              <Button variant="secondary" block onClick={() => loadMore(20)}>
                See more
              </Button>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between border-divider border-t p-4">
        <span className="text-[15px] text-secondary">
          {selected.size > 0 ? `${selected.size} selected` : "Select posts to delete"}
        </span>
        <Button variant="primary" disabled={selected.size === 0 || busy} onClick={() => void del()}>
          Delete posts
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------- Timeline (list / grid) ---------------- */

const PAGE = 5;

function Timeline({
  userId,
  filters,
  view,
}: {
  userId: Id<"users">;
  filters: Filters;
  view: "list" | "grid";
}) {
  const { results, status, loadMore } = useViewerPaginated(
    api.profiles.timeline,
    { userId, postedBy: filters.postedBy, year: filters.year },
    view === "grid" ? 12 : PAGE,
  );
  const posts = results as PostView[];
  const sentinel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<PostView | null>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || status !== "CanLoadMore") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore(view === "grid" ? 12 : PAGE);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore, view]);

  if (status === "LoadingFirstPage")
    return (
      <div className="flex flex-col gap-4">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );

  if (posts.length === 0)
    return (
      <Card className="rounded-xl">
        <p className="px-4 py-8 text-center font-bold text-[20px] text-secondary">
          No posts available
        </p>
      </Card>
    );

  return (
    <>
      {view === "list" ? (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <PostCard key={p._id} post={p} hideable={false} />
          ))}
        </div>
      ) : (
        <Card className="rounded-xl p-1">
          <div className="grid grid-cols-3 gap-1">
            {posts.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => setOpen(p)}
                className="relative overflow-hidden rounded-md hover:brightness-95"
              >
                <PostThumb post={p} />
              </button>
            ))}
          </div>
        </Card>
      )}
      <div ref={sentinel} />
      {(status === "LoadingMore" || status === "CanLoadMore") && view === "list" && (
        <PostSkeleton />
      )}
      {open && <PostDialog post={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Square preview of a post: first photo, else its text on its background or grey. */
function PostThumb({ post, size }: { post: PostView; size?: number }) {
  const m = post.media[0];
  const box = cn(
    "flex aspect-square shrink-0 items-center justify-center overflow-hidden",
    size ? "rounded-md" : "w-full",
  );
  const style = size ? { width: size, height: size } : undefined;
  if (m)
    return (
      <span className={box} style={style}>
        {m.kind === "video" ? (
          <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>
    );
  const shared = post.shared && post.shared !== "unavailable" ? post.shared : null;
  const sharedImg = shared?.media[0]?.url ?? post.attachments.find((a) => a.kind === "link")?.image;
  if (sharedImg)
    return (
      <span className={box} style={style}>
        <img src={sharedImg} alt="" loading="lazy" className="h-full w-full object-cover" />
      </span>
    );
  const bg = post.background ? BACKGROUNDS.find((b) => b.key === post.background) : undefined;
  return (
    <span
      className={cn(box, !bg && "bg-wash", "p-2 text-center")}
      style={{ ...style, ...(bg ? { background: bg.css, color: bg.text } : {}) }}
    >
      <span
        className={cn(
          "line-clamp-5 font-semibold",
          size ? "text-[9px] leading-3" : "text-[15px] leading-5",
          !bg && "text-primary",
        )}
      >
        {post.text}
      </span>
    </span>
  );
}

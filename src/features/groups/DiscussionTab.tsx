import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQ, useViewer } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { CreatePostModal, MediaThumb, PostCard, PostSkeleton } from "@/features/posts";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from "@/ui/overlays";
import { Avatar, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { AnonymousDialog, PollDialog } from "./ComposerDialogs";
import { type GroupView, isMember, useGroup } from "./context";
import {
  AnonymousPostIcon,
  ChevronDownGlyph,
  EyeGlyph,
  EyeOffGlyph,
  GlobeGlyph,
  GroupFeelingIcon,
  LockGlyph,
  PeopleGlyph,
  PinGlyph,
  PollIcon,
} from "./icons";
import { inGroup } from "./posts";

/** Discussion: composer + feed on the left, About and Recent media on the right. */
export function DiscussionTab() {
  const group = useGroup();
  return (
    <div className="flex items-start justify-center gap-3">
      <div className="flex w-full max-w-[680px] min-w-0 flex-col gap-3">
        {isMember(group) && <GroupComposer group={group} />}
        {group.canSeePosts ? (
          <>
            <FeaturedCard group={group} />
            <GroupFeed group={group} />
          </>
        ) : (
          <PrivateNotice />
        )}
      </div>
      <StickyAside>
        <AboutCard group={group} />
        {group.canSeePosts && <RecentMediaCard group={group} />}
      </StickyAside>
    </div>
  );
}

/**
 * The right column sticks under the tab bar; when it's taller than the window
 * it sticks by its bottom edge instead, so everything stays reachable.
 */
function StickyAside({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(132);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(132, window.innerHeight - el.offsetHeight - 16));
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <aside
      ref={ref}
      style={{ top }}
      className="sticky hidden w-[494px] shrink-0 flex-col gap-3 min-[1100px]:flex"
    >
      {children}
    </aside>
  );
}

/* ---------------- Composer ---------------- */

function GroupComposer({ group }: { group: GroupView }) {
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"feeling" | undefined>();
  const [dialog, setDialog] = useState<"anonymous" | "poll" | null>(null);
  const openWith = (p?: "feeling") => {
    setPanel(p);
    setOpen(true);
  };
  return (
    <Card className="rounded-xl px-4 pt-3 pb-2.5" role="region" aria-label="Create a post">
      <div className="flex items-center gap-2">
        <Link to="/$username" params={{ username: viewer.username }} className="shrink-0">
          <Avatar src={viewer.avatar} size={40} />
        </Link>
        <button
          type="button"
          onClick={() => openWith()}
          className="h-10 min-w-0 flex-1 rounded-full bg-input px-3 text-left text-[17px] text-secondary hover:brightness-95 dark:hover:brightness-125"
        >
          Write something...
        </button>
      </div>
      <div className="mt-3 flex border-divider-soft border-t pt-2">
        <ComposerAction
          icon={<AnonymousPostIcon />}
          label="Anonymous post"
          onClick={() => setDialog("anonymous")}
        />
        <ComposerAction
          icon={<GroupFeelingIcon />}
          label="Feeling/activity"
          onClick={() => openWith("feeling")}
        />
        <ComposerAction icon={<PollIcon />} label="Poll" onClick={() => setDialog("poll")} />
      </div>
      <CreatePostModal
        open={open}
        onOpenChange={setOpen}
        initialPanel={panel}
        groupId={group._id}
        groupName={group.name}
        groupPrivacy={group.privacy}
      />
      <AnonymousDialog
        group={group}
        open={dialog === "anonymous"}
        onOpenChange={(o) => setDialog(o ? "anonymous" : null)}
        onWritePost={() => openWith()}
      />
      <PollDialog
        group={group}
        open={dialog === "poll"}
        onOpenChange={(o) => setDialog(o ? "poll" : null)}
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
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-[15px] text-secondary hover:bg-hover"
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------------- Featured ---------------- */

function FeaturedCard({ group }: { group: GroupView }) {
  const [open, setOpen] = useState(false);
  const featured = useQ(api.groups.featured, open ? { groupId: group._id } : "skip");
  return (
    <Card className="rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left hover:bg-hover"
      >
        <span className="font-semibold text-[17px] text-primary">Featured</span>
        <Tooltip content="Admins and moderators can feature posts. The most popular posts show here too.">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-icon-secondary font-semibold text-[11px] text-icon-secondary">
            i
          </span>
        </Tooltip>
        <ChevronDownGlyph
          size={20}
          className={cn("ml-auto text-icon transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {featured === undefined ? (
            <Skeleton className="h-28 w-full" />
          ) : featured.length === 0 ? (
            <p className="text-[15px] text-secondary">No featured posts yet.</p>
          ) : (
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              {featured.map((p) => (
                <Link
                  key={p._id}
                  to="/$username/posts/$postId"
                  params={{ username: p.author.username, postId: p._id }}
                  className="flex w-[220px] shrink-0 flex-col overflow-hidden rounded-lg border border-divider hover:bg-hover"
                >
                  {p.media[0] ? (
                    <div className="h-[120px]">
                      <MediaThumb media={p.media[0]} />
                    </div>
                  ) : (
                    <div className="line-clamp-5 h-[120px] bg-comment p-3 text-[15px] text-primary">
                      {p.text}
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2">
                    <Avatar src={p.author.avatar} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[13px] text-primary">
                        {p.author.name}
                      </span>
                      <span className="block truncate text-[12px] text-secondary">
                        {p.reactions.count} reactions · {p.commentCount} comments
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Feed ---------------- */

const SORTS = {
  relevant: { label: "Most relevant", sub: "Show the most relevant posts first." },
  new: { label: "New posts", sub: "Show the newest posts first." },
} as const;
const PAGE = 5;

function GroupFeed({ group }: { group: GroupView }) {
  const [sort, setSort] = useState<keyof typeof SORTS>("relevant");
  const [limit, setLimit] = useState(PAGE);
  const data = useQ(api.groups.feed, { groupId: group._id, sort, limit });
  // Keep the last result on screen while a bigger page loads.
  const [shown, setShown] = useState(data);
  useEffect(() => {
    if (data) setShown(data);
  }, [data]);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = shown?.hasMore ?? false;
  const loading = data === undefined;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting) && !loading) setLimit((l) => l + PAGE);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-divider" />
        <Menu modal={false}>
          <MenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-1 rounded-md px-2 font-semibold text-[15px] text-primary hover:bg-hover"
            >
              {SORTS[sort].label}
              <ChevronDownGlyph size={16} />
            </button>
          </MenuTrigger>
          <MenuContent width={300}>
            {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
              <MenuItem
                key={k}
                label={
                  <span className="flex items-center justify-between">
                    {SORTS[k].label}
                    {k === sort && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
                  </span>
                }
                sub={SORTS[k].sub}
                onSelect={() => {
                  setSort(k);
                  setLimit(PAGE);
                  setShown(undefined);
                }}
              />
            ))}
          </MenuContent>
        </Menu>
      </div>
      {shown === undefined ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : shown.posts.length === 0 ? (
        <Card className="rounded-xl px-4 py-10 text-center">
          <p className="font-bold text-[20px] text-secondary">No posts yet</p>
          <p className="mt-1 text-[17px] text-secondary">
            {isMember(group)
              ? "Be the first to post in this group."
              : "Posts in this group will show up here."}
          </p>
        </Card>
      ) : (
        <>
          {shown.posts.map((p) => (
            <PostCard key={p._id} post={inGroup(p, group)} hideable={false} />
          ))}
          <div ref={sentinel} />
          {hasMore && <PostSkeleton />}
        </>
      )}
    </>
  );
}

function PrivateNotice() {
  return (
    <Card className="flex flex-col items-center rounded-xl px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-btn text-icon">
        <LockGlyph size={32} />
      </span>
      <p className="mt-4 font-bold text-[20px] text-primary">This group is private</p>
      <p className="mt-1 max-w-[420px] text-[15px] text-secondary">
        Join this group to view or participate in discussions.
      </p>
    </Card>
  );
}

/* ---------------- Sidebar ---------------- */

export function PrivacyRows({ group, compact }: { group: GroupView; compact?: boolean }) {
  const size = compact ? 16 : 20;
  const sub = compact ? "text-[15px]" : "text-[13px]";
  return (
    <>
      <InfoRow
        icon={group.privacy === "public" ? <GlobeGlyph size={size} /> : <LockGlyph size={size} />}
        title={group.privacy === "public" ? "Public" : "Private"}
        sub={
          group.privacy === "public"
            ? "Anyone can see who's in the group and what they post."
            : "Only members can see who's in the group and what they post."
        }
        subClass={sub}
        muted={!compact}
        compact={compact}
      />
      <InfoRow
        icon={group.visible ? <EyeGlyph size={size} /> : <EyeOffGlyph size={size} />}
        title={group.visible ? "Visible" : "Hidden"}
        sub={group.visible ? "Anyone can find this group." : "Only members can find this group."}
        subClass={sub}
        muted={!compact}
        compact={compact}
      />
    </>
  );
}

export function InfoRow({
  icon,
  title,
  sub,
  subClass = "text-[13px]",
  muted,
  compact,
}: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  subClass?: string;
  /** About tab: grey icons. */
  muted?: boolean;
  /** Discussion sidebar: 16px icons. */
  compact?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "shrink-0",
          compact ? "mt-[3px]" : "mt-0.5",
          muted ? "text-icon-secondary" : "text-icon",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[17px] text-primary leading-[22px]">{title}</p>
        {sub && <p className={cn("text-primary leading-5", subClass)}>{sub}</p>}
      </div>
    </div>
  );
}

/** Facebook's group type, shown in the About sidebar ("General", "Buy and Sell", "Gaming"). */
function groupType(category: string) {
  if (/buy|sell|swap|marketplace/i.test(category)) return "Buy and Sell";
  if (/gam/i.test(category)) return "Gaming";
  return "General";
}

export function Description({ text, limit = 160 }: { text: string; limit?: number }) {
  const [more, setMore] = useState(false);
  if (!text) return null;
  const long = text.length > limit;
  return (
    <p className="whitespace-pre-line text-[15px] text-primary">
      {long && !more ? `${text.slice(0, limit).trimEnd()}…` : text}
      {long && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="font-semibold hover:underline"
          >
            {more ? "See less" : "See more"}
          </button>
        </>
      )}
    </p>
  );
}

function AboutCard({ group }: { group: GroupView }) {
  return (
    <Card className="flex flex-col gap-3 rounded-xl p-4">
      <h2 className="font-semibold text-[17px] text-primary leading-5">About</h2>
      <Description text={group.description} />
      <PrivacyRows group={group} compact />
      {group.location && <InfoRow compact icon={<PinGlyph size={16} />} title={group.location} />}
      <InfoRow compact icon={<PeopleGlyph size={16} />} title={groupType(group.category)} />
    </Card>
  );
}

function RecentMediaCard({ group }: { group: GroupView }) {
  const media = useQ(api.groups.media, { groupId: group._id, limit: 4 });
  if (media !== undefined && media.length === 0) return null;
  return (
    <Card className="rounded-xl p-4">
      <h2 className="mb-3 font-semibold text-[17px] text-primary">Recent media</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {media === undefined
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-none" />)
          : media.map((m) => (
              <Link
                key={m.key}
                to="/$username/posts/$postId"
                params={{ username: m.username, postId: m.postId }}
                className="aspect-square overflow-hidden first:rounded-tl-lg [&:nth-child(2)]:rounded-tr-lg [&:nth-child(3)]:rounded-bl-lg [&:nth-child(4)]:rounded-br-lg"
              >
                <MediaThumb media={m} className="hover:brightness-95" />
              </Link>
            ))}
      </div>
      <Link
        to="/groups/$groupId/media"
        params={groupParams(group)}
        className="mt-4 flex h-9 items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
      >
        See all
      </Link>
    </Card>
  );
}

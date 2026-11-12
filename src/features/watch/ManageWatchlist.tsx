import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { compactCount } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Skeleton, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Row = {
  _id: Id<"users">;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
  meta: string;
  followers: number;
};

/**
 * Facebook's "Manage Watchlist" dialog: the Pages and creators the viewer
 * follows, each with an Unfollow/Follow toggle, plus a search to add more.
 * Rows stay put after Unfollow so the change can be undone in place.
 */
export function ManageWatchlistDialog({ onClose }: { onClose: () => void }) {
  const viewer = useViewer();
  const dir = useQ(api.pages.directory, {});
  const watchlist = useQ(api.media.watchlist, {});
  const followingIds = useQ(api.pages.followingIds, {});
  const follow = useM(api.media.follow);
  const [q, setQ] = useState("");
  // Optimistic follow state while a toggle is in flight.
  const [pending, setPending] = useState<Map<Id<"users">, boolean>>(new Map());
  // Who was in the Watchlist when the dialog opened (plus anyone followed since).
  const snapshot = useRef<Set<Id<"users">> | null>(null);

  const loaded = dir !== undefined && watchlist !== undefined && followingIds !== undefined;
  if (loaded && !snapshot.current) snapshot.current = new Set(followingIds);

  const all = useMemo(() => {
    const rows = new Map<Id<"users">, Row>();
    for (const p of dir?.discover ?? [])
      rows.set(p._id, {
        _id: p._id,
        name: p.name,
        username: p.username,
        avatar: p.avatar,
        verified: p.verified,
        meta: `${p.category} · ${compactCount(p.followers)} followers`,
        followers: p.followers,
      });
    for (const u of watchlist ?? [])
      if (!rows.has(u._id) && u._id !== viewer._id)
        rows.set(u._id, {
          _id: u._id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          verified: u.verified,
          meta: u.kind === "page" ? "Page" : "Video creator",
          followers: 0,
        });
    return [...rows.values()];
  }, [dir, watchlist, viewer._id]);

  const isFollowing = (id: Id<"users">) => pending.get(id) ?? followingIds?.includes(id) ?? false;
  const toggle = (id: Id<"users">) => {
    const next = !isFollowing(id);
    snapshot.current?.add(id);
    setPending((m) => new Map(m).set(id, next));
    follow({ targetId: id, follow: next })
      .catch(() => {})
      .finally(() =>
        setPending((m) => {
          const copy = new Map(m);
          copy.delete(id);
          return copy;
        }),
      );
  };

  const needle = q.trim().toLowerCase();
  const inList = all.filter((r) => snapshot.current?.has(r._id));
  const results = needle
    ? all
        .filter((r) => r.name.toLowerCase().includes(needle))
        .sort(
          (a, b) =>
            Number(b.name.toLowerCase().startsWith(needle)) -
              Number(a.name.toLowerCase().startsWith(needle)) || b.followers - a.followers,
        )
    : null;
  const suggested = all
    .filter((r) => !snapshot.current?.has(r._id) && r.followers > 0)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 6);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Manage Watchlist" width={548}>
      <div className="flex h-[min(620px,calc(100vh-140px))] flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2">
          <p className="pb-3 text-[15px] text-secondary leading-5">
            Follow Pages and creators to see their latest videos in your Watchlist.
          </p>
          <label className="flex h-9 items-center gap-2 rounded-full bg-input px-3">
            <Search size={16} className="shrink-0 text-secondary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Pages and creators"
              aria-label="Search Pages and creators"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-secondary"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {!loaded ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))
          ) : results ? (
            <Section title="Results">
              {results.length === 0 ? (
                <Empty text={`No Pages or creators match "${q.trim()}".`} />
              ) : (
                results.map((r) => (
                  <WatchRow
                    key={r._id}
                    row={r}
                    following={isFollowing(r._id)}
                    onToggle={() => toggle(r._id)}
                  />
                ))
              )}
            </Section>
          ) : (
            <>
              <Section title="Following" count={inList.filter((r) => isFollowing(r._id)).length}>
                {inList.length === 0 ? (
                  <Empty text="When you follow Pages and creators, they'll appear here." />
                ) : (
                  inList.map((r) => (
                    <WatchRow
                      key={r._id}
                      row={r}
                      following={isFollowing(r._id)}
                      onToggle={() => toggle(r._id)}
                    />
                  ))
                )}
              </Section>
              {suggested.length > 0 && (
                <Section title="Suggested for your Watchlist">
                  {suggested.map((r) => (
                    <WatchRow
                      key={r._id}
                      row={r}
                      following={isFollowing(r._id)}
                      onToggle={() => toggle(r._id)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-2">
      <h3 className="px-2 pb-1 font-semibold text-[17px] text-primary leading-6">
        {title}
        {count !== undefined && count > 0 && (
          <span className="font-normal text-secondary"> · {count}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 py-3 text-[15px] text-secondary leading-5">{text}</p>;
}

function WatchRow({
  row,
  following,
  onToggle,
}: {
  row: Row;
  following: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Link to="/$username" params={{ username: row.username }} className="shrink-0">
        <Avatar src={row.avatar} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/$username"
          params={{ username: row.username }}
          className="flex min-w-0 items-center gap-1 font-semibold text-[15px] text-primary leading-5 hover:underline"
        >
          <span className="truncate">{row.name}</span>
          {row.verified && <VerifiedBadge />}
        </Link>
        <p className="truncate text-[13px] text-secondary leading-4">{row.meta}</p>
      </div>
      <Button
        variant={following ? "secondary" : "soft"}
        className="w-[96px] shrink-0"
        aria-pressed={following}
        onClick={onToggle}
      >
        {following ? "Unfollow" : "Follow"}
      </Button>
    </div>
  );
}

import { Flag, LayoutList, Star, Users, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { PostFeed } from "@/features/posts";
import { Card } from "@/ui/primitives";
import { RailItem, SideRail } from "./SideRail";

export type FeedFilter = "all" | "favorites" | "friends" | "groups" | "pages";

const FILTERS: { key: FeedFilter; label: string; icon: ReactNode }[] = [
  { key: "all", label: "All", icon: <LayoutList size={20} /> },
  { key: "favorites", label: "Favorites", icon: <Star size={20} fill="currentColor" /> },
  { key: "friends", label: "Friends", icon: <Users size={20} fill="currentColor" /> },
  { key: "groups", label: "Groups", icon: <UsersRound size={20} fill="currentColor" /> },
  { key: "pages", label: "Pages", icon: <Flag size={20} fill="currentColor" /> },
];

const EMPTY: Record<FeedFilter, { title: string; body: string }> = {
  all: {
    title: "No posts yet",
    body: "When your friends, groups and Pages post, you'll see the most recent posts here.",
  },
  favorites: {
    title: "No favorites yet",
    body: "Add people and Pages to Favorites to see their most recent posts here.",
  },
  friends: {
    title: "No posts from friends",
    body: "When your friends share posts, you'll see the most recent ones here.",
  },
  groups: {
    title: "No posts from groups",
    body: "Join groups to see the most recent posts from your groups here.",
  },
  pages: {
    title: "No posts from Pages",
    body: "Follow Pages to see their most recent posts here.",
  },
};

/** /feeds: most recent posts with All / Favorites / Friends / Groups / Pages filters. */
export function FeedsPage({
  filter,
  onFilter,
}: {
  filter: FeedFilter;
  onFilter: (f: FeedFilter) => void;
}) {
  const empty = EMPTY[filter];
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <SideRail title="Feeds" label="Feeds">
        {FILTERS.map((f) => (
          <RailItem
            key={f.key}
            icon={f.icon}
            label={f.label}
            selected={f.key === filter}
            onClick={() => onFilter(f.key)}
          />
        ))}
      </SideRail>
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-8">
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          <PostFeed
            key={filter}
            source={{ kind: "recent", filter }}
            empty={
              <Card className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-btn text-icon-secondary">
                  {FILTERS.find((f) => f.key === filter)?.icon}
                </span>
                <p className="font-bold text-[20px] text-secondary leading-6">{empty.title}</p>
                <p className="mt-1 max-w-sm text-[15px] text-secondary leading-5">{empty.body}</p>
              </Card>
            }
          />
        </div>
      </main>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { PostFeed } from "@/features/posts";
import { Card } from "@/ui/primitives";
import { GroupsRail } from "./GroupsRail";

/** /groups/feed: recent posts from every group the viewer joined. */
export function GroupsFeedPage() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <GroupsRail active="feed" />
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-8">
        <div className="w-full max-w-[680px]">
          <h2 className="mb-3 font-semibold text-[15px] text-secondary leading-5">
            Recent activity
          </h2>
          <PostFeed source={{ kind: "recent", filter: "groups" }} empty={<CaughtUp />} />
        </div>
      </main>
    </div>
  );
}

/** Facebook's empty Groups feed card. */
export function CaughtUp() {
  return (
    <Card className="flex flex-col items-center rounded-xl px-4 pt-10 pb-6 text-center">
      <EmptyPhotoArt />
      <p className="mt-6 font-bold text-[20px] text-secondary leading-6">You're all caught up</p>
      <p className="mt-0.5 text-[17px] text-secondary leading-[22px]">
        Check back later for more updates
      </p>
      <Link
        to="/groups/discover"
        className="mt-5 flex h-9 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
      >
        Discover more groups
      </Link>
    </Card>
  );
}

export function EmptyPhotoArt({ size = 112 }: { size?: number }) {
  return (
    <svg viewBox="0 0 112 112" width={size * 0.82} height={size * 0.7} aria-hidden>
      <rect
        x="20"
        y="22"
        width="90"
        height="72"
        rx="6"
        className="fill-[#7C7F84] dark:fill-[#65686C]"
      />
      <path
        d="M10 14a6 6 0 0 1 6-6h78a6 6 0 0 1 6 6v59a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V14Z"
        className="fill-[#BCC0C4] dark:fill-[#4E5053]"
      />
      <path
        d="M10 62 38 36l22 20 18-16 22 22v11a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V62Z"
        className="fill-white dark:fill-[#B0B3B8]"
      />
      <circle cx="26" cy="25" r="7" fill="#0866FF" />
    </svg>
  );
}

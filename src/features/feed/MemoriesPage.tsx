import { Bell, CalendarX2, Home, Share2, Users } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { PostCard, PostSkeleton, type PostView } from "@/features/posts";
import { Button, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { RailDivider, RailHeading, RailItem, SideRail } from "./SideRail";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** /memories: "On this day" posts from earlier years, or Facebook's empty card. */
export function MemoriesPage() {
  const [now] = useState(() => new Date());
  const memories = useQ(api.posts.memories, {
    month: now.getMonth() + 1,
    day: now.getDate(),
    year: now.getFullYear(),
  });

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <SideRail title="Memories" label="Memories Settings">
        <RailItem icon={<Home size={20} fill="currentColor" />} label="Memories Home" selected />
        <RailDivider />
        <RailHeading>Settings</RailHeading>
        <RailItem icon={<Bell size={20} fill="currentColor" />} label="Notifications" />
        <RailItem
          icon={<Users size={20} fill="currentColor" />}
          label="Hide People"
          sub="0 Hidden"
        />
        <RailItem icon={<CalendarX2 size={20} />} label="Hide Dates" sub="0 Hidden" />
      </SideRail>
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-8">
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          {memories === undefined ? (
            <PostSkeleton />
          ) : memories.length === 0 ? (
            <Card className="overflow-hidden pb-6 text-center">
              <MemoriesBanner />
              <h2 className="mt-3 px-6 font-bold text-[20px] text-primary leading-6">
                No memories today
              </h2>
              <p className="mx-auto mt-1 max-w-[600px] px-6 text-[17px] text-secondary leading-5">
                There aren't any Memories to see or share today, but we'll let you know when you
                have some to look back on.
              </p>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden pb-5 text-center">
                <MemoriesBanner />
                <h2 className="mt-3 px-6 font-bold text-[20px] text-primary leading-6">
                  Your memories on Facebook
                </h2>
                <p className="mx-auto mt-1 max-w-[600px] px-6 text-[17px] text-secondary leading-5">
                  We hope you enjoy looking back and sharing your memories on Facebook, from the
                  most recent to those long ago.
                </p>
              </Card>
              {memories.map((post) => (
                <Memory key={post._id} post={post} now={now} />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Memory({ post, now }: { post: PostView; now: Date }) {
  const share = useM(api.posts.create);
  const [shared, setShared] = useState(false);
  const years = now.getFullYear() - new Date(post.createdAt).getFullYear();
  return (
    <div className="flex flex-col gap-0">
      <Card className="mb-[-8px] flex items-center justify-between rounded-b-none px-4 pt-3 pb-5">
        <div>
          <p className="font-semibold text-[17px] text-primary leading-5">
            {years} {years === 1 ? "year" : "years"} ago
          </p>
          <p className="text-[13px] text-secondary">{dateFmt.format(post.createdAt)}</p>
        </div>
        <Button
          variant={shared ? "secondary" : "primary"}
          disabled={shared}
          icon={<Share2 size={16} />}
          onClick={() => {
            setShared(true);
            void share({ sharedPostId: post._id, privacy: "friends" }).catch(() =>
              setShared(false),
            );
          }}
        >
          {shared ? "Shared" : "Share"}
        </Button>
      </Card>
      <PostCard post={post} />
    </div>
  );
}

/** Coral photo-frames banner from Facebook's Memories empty state. */
function MemoriesBanner() {
  return (
    <svg
      viewBox="0 0 680 128"
      className="block h-[128px] w-full"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="680" height="108" fill="#FF7A6B" />
      <rect y="108" width="680" height="20" fill="var(--card)" />
      {/* pencil */}
      <path d="M12 26 L52 116" stroke="#1877F2" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 112 L56 124" stroke="#FFB4AB" strokeWidth="6" strokeLinecap="round" />
      {/* mug frame */}
      <rect x="44" y="16" width="86" height="64" fill="#fff" />
      <rect x="52" y="22" width="70" height="52" fill="#1877F2" />
      <path d="M62 34h22v20a11 11 0 0 1-22 0Z" fill="#fff" />
      <circle cx="96" cy="50" r="10" fill="#E8412F" />
      {/* portrait frame */}
      <rect x="168" y="30" width="100" height="92" fill="#FFB4AB" />
      <rect x="162" y="26" width="100" height="90" fill="#fff" />
      <rect x="170" y="34" width="84" height="70" fill="#E8412F" />
      <circle cx="226" cy="66" r="26" fill="#111" />
      <circle cx="194" cy="76" r="14" fill="#FFDBD5" />
      <path d="M178 70a16 14 0 0 1 32-6Z" fill="#1877F2" />
      <circle cx="226" cy="80" r="14" fill="#C2402F" />
      {/* heart */}
      <path
        d="M286 96c-8-8-20-14-14-24 4-6 11-4 14 1 3-5 10-7 14-1 6 10-6 16-14 24Z"
        fill="#C9271B"
      />
      {/* hand + dog frame */}
      <rect x="320" y="0" width="100" height="74" fill="#fff" />
      <rect x="328" y="6" width="84" height="62" fill="#FFB4AB" />
      <path d="M352 6c10 16 24 30 40 40l-6 8c-18-8-32-24-44-44Z" fill="#B23A2B" />
      <rect x="372" y="62" width="60" height="58" fill="#FFB4AB" />
      <rect x="366" y="58" width="58" height="56" fill="#fff" />
      <path d="M374 66h40v40h-34c4-8 2-20-6-26Z" fill="#E8412F" />
      <path d="M380 72c8 4 14 16 12 30h-12Z" fill="#1877F2" />
      {/* flower */}
      <path d="M450 50c6 18 10 34 4 52" stroke="#111" strokeWidth="3" fill="none" />
      <circle cx="450" cy="46" r="7" fill="#fff" />
      <path d="M454 76c10-6 18-4 20 4-8 4-14 2-20-4Z" fill="#111" />
      {/* bird frame */}
      <rect x="492" y="0" width="64" height="48" fill="#fff" />
      <rect x="498" y="4" width="52" height="40" fill="#FFB4AB" />
      <path d="M504 18c14-6 26 0 34 16l10 2-12 4c-12 0-22-8-32-22Z" fill="#111" />
      {/* landscape frame */}
      <rect x="548" y="44" width="124" height="84" fill="#FFB4AB" />
      <rect x="540" y="38" width="124" height="82" fill="#fff" />
      <rect x="548" y="46" width="108" height="66" fill="#1877F2" />
      <circle cx="616" cy="86" r="16" fill="#FFB4AB" />
      <path d="M548 90c20-16 40-10 56 4 18-14 36-12 52-4v22H548Z" fill="#C9271B" />
      <path d="M584 60l6 6 6-6M640 18l6 4 6-4" stroke="#111" strokeWidth="2" fill="none" />
    </svg>
  );
}

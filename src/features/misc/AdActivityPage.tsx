import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { PostDialog, type PostView } from "@/features/posts";
import { shortAge } from "@/lib/format";
import { Avatar, Button, Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/** /ads/activity — "Recent ad activity": sponsored posts from the feed. */
export function AdActivityPage() {
  const ads = useQ(api.media.adActivity, {});
  const [open, setOpen] = useState<PostView | null>(null);
  return (
    <main className="flex justify-center px-4 pt-6 pb-10">
      <div className="w-full max-w-[680px]">
        <Card className="rounded-xl p-4">
          <h1 className="font-bold text-[24px] text-primary leading-7">Recent ad activity</h1>
          <p className="mt-1 text-[15px] text-secondary leading-5">
            See all of the ads you interacted with on Facebook. Ads you've clicked, saved or reacted
            to appear here so you can find them again.
          </p>
        </Card>
        <div className="mt-4 flex flex-col gap-3">
          {ads === undefined ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
          ) : ads.length === 0 ? (
            <Card className="rounded-xl">
              <EmptyState
                icon={<Clock size={48} strokeWidth={1.5} />}
                title="No recent ad activity"
                body="When you interact with ads on Facebook, you'll see them here."
              />
            </Card>
          ) : (
            ads.map((ad) => {
              const link = ad.attachments.find((a) => a.kind === "link");
              const thumb = ad.media[0]?.url ?? (link?.kind === "link" ? link.image : null);
              return (
                <Card key={ad._id} className="flex gap-3 rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => setOpen(ad)}
                    className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-btn"
                    aria-label={`Open ad from ${ad.author.name}`}
                  >
                    {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <Avatar src={ad.author.avatar} size={24} />
                      <Link
                        to="/$username"
                        params={{ username: ad.author.username }}
                        className="truncate font-semibold text-[15px] text-primary hover:underline"
                      >
                        {ad.author.name}
                      </Link>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[15px] text-primary leading-5">
                      {link?.kind === "link" ? link.title : ad.text}
                    </p>
                    <p className="mt-auto text-[13px] text-secondary">
                      Sponsored · Seen {shortAge(ad.createdAt)} ago
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button variant="secondary" onClick={() => setOpen(ad)}>
                      View ad
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
      {open && <PostDialog post={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

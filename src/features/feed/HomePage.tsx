import { useQ } from "@/app/viewer";
import { Composer, PostCard, PostFeed } from "@/features/posts";
import { api } from "../../../convex/_generated/api";
import { LeftRail } from "./LeftRail";
import { todayKey } from "./links";
import { ReelsShelf } from "./ReelsShelf";
import { RightRail } from "./RightRail";
import { StoriesTray } from "./StoriesTray";

/**
 * Feed slots, as on Facebook: a link ad then the Reels shelf after the 3rd
 * post, and another ad after every 6th.
 */
const REELS_AFTER = 2;
/** Where the shelf moves after "Show fewer reels". */
const REELS_FEWER_AFTER = 10;
const AD_EVERY = 6;

/** Home: left shortcuts rail, 680px feed column, right contacts rail. */
export function HomePage() {
  const rails = useQ(api.feed.rails, { today: todayKey() });
  const ads = useQ(api.feed.ads, {});
  // Facebook leads into the Reels shelf with a link ad (domain, headline, Learn more).
  const shelfAd = ads?.find((a) => a.attachments.some((x) => x.kind === "link"));
  const slotAds = ads?.filter((a) => a !== shelfAd);
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start justify-between">
      <LeftRail groups={rails?.groups} />
      <main className="flex min-w-0 flex-[1_1_720px] justify-center px-4 pt-4 pb-8 min-[900px]:px-5">
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          <Composer />
          <StoriesTray />
          <PostFeed
            source={{ kind: "home" }}
            interleave={(i) => {
              if (i === REELS_FEWER_AFTER) return <ReelsShelf placement="fewer" />;
              if (i === REELS_AFTER)
                return (
                  <>
                    {shelfAd && <PostCard post={shelfAd} />}
                    <ReelsShelf />
                  </>
                );
              const ad = (i + 1) % AD_EVERY === 0 ? slotAds?.[(i + 1) / AD_EVERY - 1] : undefined;
              return ad ? <PostCard post={ad} /> : null;
            }}
          />
        </div>
      </main>
      <RightRail data={rails} />
    </div>
  );
}

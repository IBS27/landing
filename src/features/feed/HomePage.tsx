import { useQ } from "@/app/viewer";
import { Composer, PostFeed } from "@/features/posts";
import { api } from "../../../convex/_generated/api";
import { LeftRail } from "./LeftRail";
import { todayKey } from "./links";
import { RightRail } from "./RightRail";
import { StoriesTray } from "./StoriesTray";

/** Home: left shortcuts rail, 680px feed column, right contacts rail. */
export function HomePage() {
  const rails = useQ(api.feed.rails, { today: todayKey() });
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start justify-between">
      <LeftRail groups={rails?.groups} />
      <main className="flex min-w-0 flex-[1_1_720px] justify-center px-4 pt-4 pb-8 min-[900px]:px-5">
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          <Composer />
          <StoriesTray />
          <PostFeed source={{ kind: "home" }} />
        </div>
      </main>
      <RightRail data={rails} />
    </div>
  );
}

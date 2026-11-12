import { Link } from "@tanstack/react-router";
import { Archive, Settings } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { StorySettingsDialog } from "./StorySettingsDialog";
import { storyBackground, storyTextColor } from "./storyUtils";

const dateLabel = (ts: number) => {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

/** `/stories/archive`: your stories after they leave your story, visible only to you. */
export function StoryArchivePage() {
  const stories = useQ(api.stories.archive, {});
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[908px] px-4 py-6">
      <Card className="rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-bold text-[24px] text-primary leading-7">Story archive</h1>
            <p className="mt-1 text-[15px] text-secondary leading-5">
              Only you can see your archived stories. Stories are saved here after they disappear
              from your story.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            Settings
          </Button>
        </div>

        {stories === undefined ? (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Archive size={48} className="text-secondary" strokeWidth={1.4} />
            <p className="mt-3 font-bold text-[20px] text-secondary">No stories in your archive</p>
            <p className="mt-1 text-[15px] text-secondary">
              Your stories will show up here after they expire.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {stories.map((s) => (
              <Link
                key={s._id}
                to="/stories/$storyId"
                params={{ storyId: s._id }}
                className="group relative aspect-[9/16] overflow-hidden rounded-lg bg-black"
              >
                {s.background || !s.media.url ? (
                  <span
                    className="flex h-full w-full items-center justify-center p-3 text-center font-semibold text-[13px]"
                    style={{
                      background: storyBackground(s.background),
                      color: storyTextColor(s.background),
                    }}
                  >
                    <span className="line-clamp-6">{s.text}</span>
                  </span>
                ) : s.media.kind === "video" ? (
                  <video
                    src={s.media.url}
                    muted
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={s.media.url}
                    alt={s.media.alt ?? ""}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                )}
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.45)_0%,transparent_28%)] transition-colors group-hover:bg-black/10" />
                <span className="absolute top-2 left-2 rounded-md bg-card px-2 py-1 text-center font-bold text-[13px] text-primary leading-4 shadow-base">
                  {dateLabel(s.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
      <StorySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

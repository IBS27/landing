import { useEffect, useState } from "react";
import { useQ, useViewer } from "@/app/viewer";
import { ComingUp } from "@/landing/timeline/ComingUp";
import { MoveTimeline } from "@/landing/timeline/MoveTimeline";
import { NextStep } from "@/landing/timeline/NextStep";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { todayInSF } from "../../../convex/lib/cityProfileFacts";
import type { Stage } from "../../../convex/lib/homeTimeline";
import { LandingPage } from "./LandingPage";

const HEADLINES: Record<Stage, string> = {
  not_started: "Find a place, meet people before you land and settle into San Francisco.",
  searching: "You're looking for a place. Here's what to do next.",
  moving_in: "You're moving in. Here's what to do next.",
  settling_in: "You're settling in. Here's what to do next.",
  settled: "You're settled in San Francisco. Here's what's next.",
  moving_out: "You're moving out. Here's what to do next.",
};

/** The time, refreshed every minute, so countdowns and "coming up" roll over on their own. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * Landing Home (`/landing`, #142): where the person is in their move and
 * what to do next. Their stage on a timeline, one next step with why it's
 * shown, a few more, and what's coming up. All from `api.home.timeline`
 * (plain rules, so it's the same with AI off). Only the viewer sees it.
 */
export function HomePage() {
  const viewer = useViewer();
  const now = useNow();
  const t = useQ(api.home.timeline, { today: todayInSF(now) });
  return (
    <LandingPage
      title={`Welcome to Landing, ${viewer.firstName}`}
      description={t ? HEADLINES[t.stage] : " "}
    >
      {t === undefined ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <MoveTimeline stage={t.stage} place={t.place} moveIn={t.moveIn} moveOut={t.moveOut} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <NextStep step={t.nextStep} also={t.alsoSteps} />
            <ComingUp data={t.comingUp} now={now} />
          </div>
        </div>
      )}
    </LandingPage>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Card className="p-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-5 h-6 w-full" />
        <Skeleton className="mt-5 h-4 w-48" />
      </Card>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex gap-3 p-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        </Card>
        <Card className="p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-3 h-10 w-full" />
        </Card>
      </div>
    </div>
  );
}

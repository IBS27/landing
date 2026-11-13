import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQ } from "@/app/viewer";
import { type LandingPageName, toLandingPage } from "@/landing/links";
import { todayInSF } from "@/landing/place/placeParts";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import {
  type MoveFacts,
  moveLine,
  type Stage,
  spineOf,
  stageOf,
} from "../../../convex/lib/moveStage";

/** Where the current stage goes when clicked. */
function pageFor(stage: Stage, f: MoveFacts): { page: LandingPageName; label: string } {
  if (stage === "searching")
    return f.briefDone
      ? { page: "find", label: "Find a place" }
      : { page: "welcome", label: "Set up your City Profile" };
  if (stage === "moving_out") return { page: "moveout", label: "Open Move out" };
  return { page: "place", label: "Open My Place" };
}

/** Today in San Francisco, rolling over at its midnight while the page stays open. */
function useTodayInSF(): string {
  const [today, setToday] = useState(() => todayInSF());
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayInSF()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

/**
 * Landing Home's status spine (#162): where the person is in their move, and
 * nothing else. Searching → Place chosen → Moving in → Settling in → Local
 * (Moving out in the last spot while they are), the current stage marked with
 * its move-in date or a countdown. Plain rules (`convex/lib/moveStage.ts`)
 * over the viewer's own place and City Profile, so it's the same with AI off.
 * The current stage links to the page for it.
 */
export function StatusSpine() {
  const facts = useQ(api.moveStage.get, {});
  const today = useTodayInSF();
  if (!facts) return null;
  const stage = stageOf(facts, today);
  const stops = spineOf(stage);
  const at = stops.findIndex((s) => s.id === stage);
  const line = moveLine(facts, today);
  const go = pageFor(stage, facts);
  // Nothing known yet: the first stop is where they are, not somewhere they've reached.
  const fresh = stage === "searching" && !facts.briefDone && !facts.plannedMoveIn;

  return (
    <section aria-label="Your move" className={cn("lh-spine", fresh && "lh-spine-fresh")}>
      <ol className="lh-spine-list">
        {stops.map((s, i) => {
          const state = i < at ? "done" : i === at ? "at" : "next";
          return (
            <li
              key={s.id}
              className={`lh-spine-stop lh-spine-${state}`}
              aria-current={state === "at" ? "step" : undefined}
            >
              <span className="lh-spine-dot" aria-hidden />
              {state === "at" ? (
                <Link
                  {...toLandingPage(go.page)}
                  title={go.label}
                  className="lh-spine-now lh-focus"
                >
                  <span className="lh-spine-label">{s.label}</span>
                  {line && (
                    <span className="lh-spine-line">
                      <span className="sr-only">, </span>
                      {line}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="lh-spine-label">{s.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

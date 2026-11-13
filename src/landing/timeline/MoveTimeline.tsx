import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, ChevronRight, Lock } from "lucide-react";
import { toMyPlace } from "@/landing/links";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { moveInLabel } from "../../../convex/lib/cityProfileFacts";
import {
  type MoveDate,
  type PlaceFacts,
  relativeDays,
  STAGES,
  type Stage,
  shortDate,
} from "../../../convex/lib/homeTimeline";

/** "Dec 1 · in 18 days", "March 2027". */
function when(d: MoveDate) {
  if (!d.date) return moveInLabel({ month: d.month });
  return d.days === null ? shortDate(d.date) : `${shortDate(d.date)} · ${relativeDays(d.days)}`;
}

/** The person's line under the timeline: their place, or the move-in they planned. */
function DateLine({
  place,
  moveIn,
  moveOut,
}: {
  place: PlaceFacts | null;
  moveIn: MoveDate | null;
  moveOut: MoveDate | null;
}) {
  const date = moveOut ?? moveIn;
  if (!place && !date) return null;
  const label = moveOut ? "Move-out" : moveIn?.from === "profile" ? "Planned move-in" : "Move-in";
  const where = place && [place.listingTitle, place.neighborhood?.name].filter(Boolean).join(" · ");
  return (
    <div className="mt-4 flex flex-col gap-2 border-divider border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {date && (
          <p className="flex items-center gap-1.5 font-semibold text-[15px] text-primary leading-5">
            <CalendarDays size={16} className="shrink-0 text-icon-secondary" aria-hidden />
            <span>
              {label} {when(date)}
            </span>
          </p>
        )}
        {where ? (
          <p className="mt-0.5 truncate text-[13px] text-secondary leading-4">{where}</p>
        ) : (
          moveIn?.from === "profile" && (
            <p className="mt-0.5 text-[13px] text-secondary leading-4">From your City Profile</p>
          )
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex items-center gap-1 text-[13px] text-secondary leading-4">
          <Lock size={12} aria-hidden /> Only you
        </span>
        {place && (
          <Link
            {...toMyPlace()}
            className="flex items-center gap-0.5 font-semibold text-[15px] text-link hover:underline"
          >
            My Place <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Landing Home's timeline: get started → searching → moving in → settling in
 * → settled → moving out, with the person's stage highlighted and the move-in
 * (or move-out) date and countdown when known. On a phone only the current
 * stage is labelled.
 */
export function MoveTimeline({
  stage,
  place,
  moveIn,
  moveOut,
}: {
  stage: Stage;
  place: PlaceFacts | null;
  moveIn: MoveDate | null;
  moveOut: MoveDate | null;
}) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-[17px] text-primary leading-5">Your move</h2>
        <p className="text-[13px] text-secondary leading-4 sm:hidden">
          Step {at + 1} of {STAGES.length}
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-6" aria-label="Your move">
        {STAGES.map((s, i) => {
          const done = i < at;
          const current = i === at;
          return (
            <li
              key={s.id}
              aria-current={current ? "step" : undefined}
              className="relative flex flex-col items-center text-center"
            >
              {/* The line to the previous stage. */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2",
                    i <= at ? "bg-fb" : "bg-divider",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full font-semibold text-[12px]",
                  done && "bg-fb text-white",
                  current && "bg-fb text-white ring-4 ring-fb/25",
                  !done && !current && "border-2 border-divider bg-card text-secondary",
                )}
              >
                {done ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-1.5 px-0.5 text-[12px] leading-4 sm:text-[13px]",
                  current ? "font-semibold text-primary" : "hidden text-secondary sm:block",
                )}
              >
                {s.label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <DateLine place={place} moveIn={moveIn} moveOut={moveOut} />
    </Card>
  );
}

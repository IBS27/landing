import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, ChevronDown, ChevronRight, Lock, Route } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { toMyPlace } from "@/landing/links";
import { cn } from "@/lib/format";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { moveInLabel, todayInSF } from "../../../convex/lib/cityProfileFacts";
import {
  type MoveDate,
  type PlaceFacts,
  relativeDays,
  STAGES,
  type Stage,
  shortDate,
} from "../../../convex/lib/homeTimeline";
import { ComingUp } from "./ComingUp";
import { NextSteps } from "./NextSteps";

/** The map is wide enough for the panel beside the chat (matches `.lh-stage` container rules). */
const SIDE_BY_SIDE = 900;

/** The time, refreshed every minute, so countdowns and "coming up" roll over on their own. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const label = (stage: Stage) => STAGES.find((s) => s.id === stage)?.label ?? "";

/**
 * Landing Home's "Your move" panel (#142), over the map: where the person is
 * in their move (the stage on a timeline, with the move-in or move-out date),
 * the one next step with why it's shown, a few more, and what's coming up.
 * All from `api.home.timeline`: plain rules, so it's the same with AI off,
 * and only the viewer's own data. Open beside the chat when the map is wide,
 * collapsed to a pill (opening over the map) when it isn't.
 */
export function MovePanel({
  open,
  onOpenChange,
}: {
  open: boolean | null;
  onOpenChange: (open: boolean) => void;
}) {
  const now = useNow();
  const t = useQ(api.home.timeline, { today: todayInSF(now) });
  const ref = useRef<HTMLDivElement>(null);

  // Starts open when there's room beside the chat.
  useLayoutEffect(() => {
    const stage = ref.current?.parentElement;
    if (open === null && stage) onOpenChange(stage.clientWidth >= SIDE_BY_SIDE);
  }, [open, onOpenChange]);

  if (!open)
    return (
      <div ref={ref} className="lh-move-pill">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-expanded={false}
          className="lh-glass flex max-w-full items-center gap-2 rounded-full py-1.5 pr-2.5 pl-2 text-left shadow-base"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fb text-white">
            <Route size={15} aria-hidden />
          </span>
          <span className="min-w-0 truncate text-[13px] text-primary leading-4">
            <b>Your move</b>
            {t && ` · ${label(t.stage)}`}
            {t?.nextStep && <span className="text-secondary"> · {t.nextStep.title}</span>}
          </span>
          <ChevronDown size={16} className="shrink-0 text-icon-secondary" aria-hidden />
        </button>
      </div>
    );

  return (
    <aside ref={ref} className="lh-move lh-glass" aria-label="Your move">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <h2 className="flex-1 font-bold text-[17px] text-primary leading-5">Your move</h2>
        <span className="flex items-center gap-1 text-[12px] text-secondary">
          <Lock size={11} aria-hidden /> Only you
        </span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Hide your move"
          aria-expanded
          className="rounded-full p-1 text-icon-secondary hover:bg-hover"
        >
          <ChevronDown size={18} className="rotate-180" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
        {t === undefined ? (
          <div className="flex flex-col gap-3" aria-busy>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <Stepper stage={t.stage} />
            <DateLine place={t.place} moveIn={t.moveIn} moveOut={t.moveOut} />
            <NextSteps step={t.nextStep} also={t.alsoSteps} />
            <ComingUp data={t.comingUp} now={now} />
          </>
        )}
      </div>
    </aside>
  );
}

/** The six stages, the person's highlighted. Only the current one is labelled; the rest say theirs to screen readers. */
function Stepper({ stage }: { stage: Stage }) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-[15px] text-primary">{label(stage)}</span>
        <span className="text-[12px] text-secondary">
          Stage {at + 1} of {STAGES.length}
        </span>
      </p>
      <ol className="mt-2 flex items-center" aria-label="Stages of your move">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === at ? "step" : undefined}
            className={cn("flex items-center", i > 0 && "flex-1")}
          >
            {i > 0 && (
              <span aria-hidden className={cn("h-0.5 flex-1", i <= at ? "bg-fb" : "bg-divider")} />
            )}
            <span
              title={s.label}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                i < at && "bg-fb text-white",
                i === at && "bg-fb ring-4 ring-fb/25",
                i > at && "border-2 border-divider",
              )}
            >
              {i < at && <Check size={12} strokeWidth={3} aria-hidden />}
              <span className="sr-only">
                {s.label}
                {i < at ? " (done)" : i === at ? " (now)" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "Dec 1 · in 18 days", "March 2027". */
function when(d: MoveDate) {
  if (!d.date) return moveInLabel({ month: d.month });
  return d.days === null ? shortDate(d.date) : `${shortDate(d.date)} · ${relativeDays(d.days)}`;
}

/** The move-in (or move-out) date and the place, linking to My Place. */
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
  const what = moveOut ? "Move-out" : moveIn?.from === "profile" ? "Planned move-in" : "Move-in";
  const where = place
    ? [place.listingTitle, place.neighborhood?.name].filter(Boolean).join(" · ")
    : "From your City Profile";
  const body = (
    <>
      <CalendarDays size={16} className="mt-0.5 shrink-0 text-icon-secondary" aria-hidden />
      <span className="min-w-0 flex-1">
        {date && (
          <span className="block font-semibold text-[13px] text-primary leading-5">
            {what} {when(date)}
          </span>
        )}
        {where && (
          <span className="block truncate text-[12px] text-secondary leading-4">{where}</span>
        )}
      </span>
      {place && (
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-icon-secondary" aria-hidden />
      )}
    </>
  );
  return place ? (
    <Link
      {...toMyPlace()}
      className="-mx-2 mt-2 flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-hover"
    >
      {body}
    </Link>
  ) : (
    <p className="mt-2 flex items-start gap-2 py-1.5">{body}</p>
  );
}

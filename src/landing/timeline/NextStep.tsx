import { Link } from "@tanstack/react-router";
import { ChevronRight, Info, PartyPopper } from "lucide-react";
import { Card } from "@/ui/primitives";
import type { Step } from "../../../convex/lib/homeTimeline";
import { STEP_ICONS, stepLink } from "./steps";

/** Why a step is shown: the facts it was picked from, which are its source. */
function Reason({ children }: { children: string }) {
  return (
    <p className="mt-1 flex gap-1.5 text-[15px] text-secondary leading-5">
      <Info
        size={16}
        className="mt-0.5 shrink-0 text-icon-secondary"
        aria-label="Why you're seeing this"
      />
      <span>{children}</span>
    </p>
  );
}

/** The one most useful thing to do now, and up to three more below it. */
export function NextStep({ step, also }: { step: Step | null; also: Step[] }) {
  if (!step)
    return (
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <PartyPopper size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-[17px] text-primary leading-5">You're all caught up</h2>
          <p className="mt-1 text-[15px] text-secondary leading-5">
            Nothing needs you right now. New steps show up here as your move goes on.
          </p>
        </div>
      </Card>
    );
  const Icon = STEP_ICONS[step.id];
  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <p className="font-semibold text-[13px] text-fb uppercase leading-4 tracking-wide">
          Next step
        </p>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
            <Icon size={24} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[20px] text-primary leading-6">{step.title}</h2>
            <Reason>{step.reason}</Reason>
            <Link
              {...stepLink(step.link)}
              className="mt-3 inline-flex h-9 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
            >
              {step.action}
            </Link>
          </div>
        </div>
      </Card>
      {also.length > 0 && (
        <Card className="py-2">
          <h3 className="px-4 pt-1 pb-1 font-semibold text-[15px] text-secondary leading-5">
            Also on your list
          </h3>
          <ul>
            {also.map((s) => (
              <AlsoRow key={s.id} step={s} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AlsoRow({ step }: { step: Step }) {
  const Icon = STEP_ICONS[step.id];
  return (
    <li className="px-2">
      <Link
        {...stepLink(step.link)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[15px] text-primary leading-5">
            {step.title}
          </span>
          <span className="block text-[13px] text-secondary leading-4">{step.reason}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
      </Link>
    </li>
  );
}

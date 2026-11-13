import { Link } from "@tanstack/react-router";
import { ChevronRight, Info, PartyPopper } from "lucide-react";
import type { Step } from "../../../convex/lib/homeTimeline";
import { STEP_ICONS, stepLink } from "./steps";

/** The one most useful thing to do now, why it's shown, and up to three more. */
export function NextSteps({ step, also }: { step: Step | null; also: Step[] }) {
  if (!step)
    return (
      <section className="mt-3 flex items-start gap-3 rounded-xl bg-card p-3 shadow-base">
        <PartyPopper size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div>
          <h3 className="font-semibold text-[15px] text-primary leading-5">You're all caught up</h3>
          <p className="mt-0.5 text-[13px] text-secondary leading-4">
            Nothing needs you right now. New steps show up here as your move goes on.
          </p>
        </div>
      </section>
    );
  const Icon = STEP_ICONS[step.id];
  return (
    <>
      <section className="mt-3 rounded-xl bg-card p-3 shadow-base" aria-label="Next step">
        <p className="font-semibold text-[12px] text-link uppercase tracking-wide">Next step</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
            <Icon size={20} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[17px] text-primary leading-[22px]">{step.title}</h3>
            <p className="mt-1 flex gap-1.5 text-[13px] text-secondary leading-[18px]">
              <Info size={14} className="mt-0.5 shrink-0" aria-label="Why you're seeing this" />
              <span>{step.reason}</span>
            </p>
            <Link
              {...stepLink(step.link)}
              className="mt-2.5 inline-flex h-8 items-center rounded-md bg-btn-primary px-3 font-semibold text-[14px] text-white hover:bg-btn-primary-hover"
            >
              {step.action}
            </Link>
          </div>
        </div>
      </section>
      {also.length > 0 && (
        <section className="mt-3" aria-label="Also on your list">
          <h3 className="font-semibold text-[13px] text-secondary">Also on your list</h3>
          <ul className="-mx-2 mt-1">
            {also.map((s) => {
              const AlsoIcon = STEP_ICONS[s.id];
              return (
                <li key={s.id}>
                  <Link
                    {...stepLink(s.link)}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-hover"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
                      <AlsoIcon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[14px] text-primary leading-[18px]">
                        {s.title}
                      </span>
                      <span className="block text-[12px] text-secondary leading-4">{s.reason}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-icon-secondary" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

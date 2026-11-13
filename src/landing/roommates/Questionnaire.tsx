import { useEffect, useRef } from "react";
import { cn } from "@/lib/format";
import { Button, Card } from "@/ui/primitives";
import {
  answeredCount,
  type LifestyleAnswers,
  QUESTION_COUNT,
  STEPS,
} from "../../../convex/lib/lifestyle";
import { type AnswerChange, QuestionInput, questionTitle } from "./questions";

/**
 * The questionnaire, one short step at a time. Every change is saved as it
 * happens (`onChange`), so leaving halfway keeps what was answered.
 */
export function Questionnaire({
  answers,
  onChange,
  step,
  onStep,
  onDone,
  saveError,
}: {
  answers: LifestyleAnswers;
  onChange: AnswerChange;
  step: number;
  onStep: (step: number) => void;
  onDone: () => void;
  saveError?: boolean;
}) {
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const answeredHere = current.fields.filter((f) => answers[f] !== undefined).length;
  const answered = answeredCount(answers);
  const heading = useRef<HTMLHeadingElement>(null);

  // On every step (including the first one shown), start at the top: scroll up and move
  // focus to the step's heading, so keyboard and screen reader users land there too.
  const shown = useRef(-1);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <Card className="overflow-hidden">
      <div className="border-divider-soft border-b px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-[13px] text-secondary">
            Step {step + 1} of {STEPS.length}
          </p>
          <p className="text-[13px] text-secondary" aria-live="polite">
            {answered} of {QUESTION_COUNT} answered
          </p>
        </div>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-fb" : "bg-btn")}
            />
          ))}
        </div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-3 font-bold text-[20px] text-primary leading-6 outline-none"
        >
          {current.title}
        </h2>
      </div>

      <div className="flex flex-col gap-6 px-4 py-4">
        {current.fields.map((field) => (
          <section key={field} aria-labelledby={`q-${field}`}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h3
                id={`q-${field}`}
                className="font-semibold text-[17px] text-primary leading-[22px]"
              >
                {questionTitle(field)}
              </h3>
              {answers[field] !== undefined && (
                <button
                  type="button"
                  onClick={() => onChange(field, () => undefined)}
                  className="shrink-0 font-semibold text-[13px] text-secondary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <QuestionInput field={field} answers={answers} onChange={onChange} />
          </section>
        ))}
      </div>

      {saveError && (
        <p role="alert" className="px-4 pb-3 text-[13px] text-negative">
          Your last change wasn't saved. Check your connection and try again.
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-divider-soft border-t px-4 py-3">
        <div>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => onStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onDone}>
              Exit
            </Button>
          )}
        </div>
        <Button
          variant={last || answeredHere > 0 ? "primary" : "secondary"}
          className="min-w-24"
          onClick={() => (last ? onDone() : onStep(step + 1))}
        >
          {last ? "Done" : answeredHere > 0 ? "Next" : "Skip"}
        </Button>
      </div>
    </Card>
  );
}

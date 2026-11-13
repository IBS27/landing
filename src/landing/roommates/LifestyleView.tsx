import { Check, Lock } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Card } from "@/ui/primitives";
import {
  answeredCount,
  type LifestyleAnswers,
  QUESTION_COUNT,
} from "../../../convex/lib/lifestyle";
import { LifestyleSummary, SharingCard } from "./LifestyleSummary";
import { Questionnaire } from "./Questionnaire";
import type { AnswerChange } from "./questions";

export type LifestyleState = {
  answers: LifestyleAnswers;
  shared: boolean;
  sharedAt: number | null;
} | null;

export type LifestyleActions = {
  save: (answers: LifestyleAnswers) => Promise<void>;
  share: (shared: boolean) => Promise<void>;
  remove: () => Promise<void>;
};

/**
 * The roommate lifestyle page without its data source: an intro until the
 * person starts, the questionnaire, then their answers with the sharing switch.
 */
export function LifestyleView({
  state,
  actions,
}: {
  state: LifestyleState;
  actions: LifestyleActions;
}) {
  const [step, setStep] = useState<number | null>(null);
  // While answering, the form shows its own copy so quick taps never wait on the server.
  // `latest` is the newest draft even before React re-renders, so every change builds on it.
  const [draft, setDraft] = useState<LifestyleAnswers>({});
  const latest = useRef<LifestyleAnswers>({});
  const [saveError, setSaveError] = useState(false);

  const edit = (at: number) => {
    latest.current = state?.answers ?? {};
    setDraft(latest.current);
    setStep(at);
  };
  const change: AnswerChange = (field, update) => {
    const next: Record<string, unknown> = { ...latest.current };
    const value = update(next[field]);
    if (value === undefined) delete next[field];
    else next[field] = value;
    latest.current = next as LifestyleAnswers;
    setDraft(latest.current);
    setSaveError(false);
    actions.save(latest.current).catch(() => setSaveError(true));
  };

  if (step !== null)
    return (
      <Questionnaire
        answers={draft}
        onChange={change}
        step={step}
        onStep={setStep}
        onDone={() => {
          setStep(null);
          window.scrollTo({ top: 0 });
        }}
        saveError={saveError}
      />
    );

  if (!state) return <Intro onStart={() => edit(0)} />;

  return (
    <div className="flex flex-col gap-3">
      <SharingCard
        shared={state.shared}
        sharedAt={state.sharedAt}
        canShare={answeredCount(state.answers) > 0}
        onShare={actions.share}
      />
      <LifestyleSummary answers={state.answers} onEdit={edit} onDelete={actions.remove} />
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const points = [
    `${QUESTION_COUNT} quick questions about sleep, guests, tidiness and habits. Skip any of them.`,
    "Private until you choose to share them for roommate matching.",
    "Edit or delete your answers at any time.",
    "Only what you answer here is used. Nothing is guessed from your activity.",
  ];
  return (
    <Card className="p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight text-accent">
        <Lock size={22} />
      </span>
      <h2 className="mt-3 font-bold text-[20px] text-primary leading-6">
        Find a roommate who lives like you
      </h2>
      <p className="mt-1 text-[15px] text-secondary leading-5">
        Your answers help Landing compare you with roommates from your network, so you can see the
        habits you share before you meet.
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[15px] text-primary leading-5">
            <Check size={18} className="mt-px shrink-0 text-fb" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <Button variant="primary" size="lg" className="mt-5 w-full sm:w-auto" onClick={onStart}>
        Get started
      </Button>
    </Card>
  );
}

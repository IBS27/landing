import { Info } from "lucide-react";
import {
  DEALBREAKER_COPY,
  DEALBREAKER_RULES,
  DEALBREAKERS,
  type LifestyleAnswers,
  type LifestyleField,
  PET_COPY,
  PETS,
  SCALE_COPY,
  SCALES,
  type ScaleField,
} from "../../../convex/lib/lifestyle";
import { type Choice, MultiChoice, SingleChoice, type Update } from "./Choices";

/** Applies `update` to one field of the latest answers (undefined = skipped). */
export type AnswerChange = (field: LifestyleField, update: Update<unknown>) => void;

/** The question's title, for the questionnaire and the summary. */
export function questionTitle(field: LifestyleField): string {
  if (field === "pets") return PET_COPY.title;
  if (field === "dealbreakers") return DEALBREAKER_COPY.title;
  return SCALE_COPY[field].title;
}

function scaleChoices(field: ScaleField): Choice<string>[] {
  const options = SCALE_COPY[field].options as Record<string, { label: string; hint?: string }>;
  return SCALES[field].map((id) => ({ id, label: options[id].label, hint: options[id].hint }));
}

const PET_CHOICES = PETS.map((id) => ({ id, label: PET_COPY.options[id].label }));
const DEALBREAKER_CHOICES = DEALBREAKERS.map((id) => ({ id, label: DEALBREAKER_RULES[id].label }));

/** One question's input. Every question can be left unanswered. */
export function QuestionInput({
  field,
  answers,
  onChange,
}: {
  field: LifestyleField;
  answers: LifestyleAnswers;
  onChange: AnswerChange;
}) {
  // Each input knows its own value type; the change is applied to `field` only.
  const set = <V,>(update: Update<V>) => onChange(field, update as unknown as Update<unknown>);
  const title = questionTitle(field);

  if (field === "pets")
    return (
      <>
        <MultiChoice
          label={title}
          options={PET_CHOICES}
          none={PET_COPY.none}
          value={answers.pets}
          onChange={set}
        />
        <p className="mt-2 flex gap-1.5 text-[13px] text-secondary leading-4">
          <Info size={14} className="mt-px shrink-0" aria-hidden />
          {PET_COPY.note}
        </p>
      </>
    );
  if (field === "dealbreakers")
    return (
      <MultiChoice
        label={title}
        options={DEALBREAKER_CHOICES}
        none={DEALBREAKER_COPY.none}
        value={answers.dealbreakers}
        onChange={set}
        tile
      />
    );
  return (
    <SingleChoice
      label={title}
      options={scaleChoices(field)}
      value={answers[field] as string | undefined}
      onChange={set}
    />
  );
}

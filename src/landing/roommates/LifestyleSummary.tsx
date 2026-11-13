import { Link } from "@tanstack/react-router";
import { Lock, Pencil, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/features/misc/settings/controls";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card } from "@/ui/primitives";
import { budgetLabel } from "../../../convex/lib/cityProfileFacts";
import {
  answeredCount,
  answerLabel,
  type BudgetRange,
  type LifestyleAnswers,
  QUESTION_COUNT,
  STEPS,
  WORKDAY_COPY,
  type Workday,
} from "../../../convex/lib/lifestyle";
import { questionTitle } from "./questions";

/** The sharing switch, with exactly what is shared, with whom, and how to stop. */
export function SharingCard({
  shared,
  sharedAt,
  canShare,
  fromProfile,
  onShare,
}: {
  shared: boolean;
  sharedAt: number | null;
  canShare: boolean;
  fromProfile: { budget: BudgetRange | null; workday: Workday | null };
  onShare: (shared: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onShare(next);
    } catch {
      setError(
        next ? "Couldn't turn on sharing. Try again." : "Couldn't turn off sharing. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            shared ? "bg-highlight text-accent" : "bg-btn text-icon",
          )}
        >
          {shared ? <UsersRound size={20} /> : <Lock size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="share-title" className="font-semibold text-[17px] text-primary leading-[22px]">
            Share for roommate matching
          </h2>
          <p className="text-[13px] text-secondary leading-4" aria-live="polite">
            {shared
              ? `On${sharedAt ? ` since ${new Date(sharedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}. People who match with you can see your answers.`
              : "Off. Only you can see your answers."}
          </p>
        </div>
        <Switch
          on={shared}
          label="Share for roommate matching"
          disabled={busy || (!shared && !canShare)}
          onChange={toggle}
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
      {!canShare && !shared && (
        <p className="mt-2 text-[13px] text-secondary">Answer at least one question to share.</p>
      )}
      <ul className="mt-3 flex flex-col gap-1.5 border-divider-soft border-t pt-3 text-[13px] text-secondary leading-[18px]">
        <li>
          <span className="font-semibold text-primary">Who sees them:</span> people in your network
          who also share their answers. You see theirs in return.
        </li>
        <li>
          <span className="font-semibold text-primary">What's compared:</span> your answers below,
          plus from your{" "}
          <Link to="/landing/profile" className="font-semibold text-link hover:underline">
            City Profile
          </Link>
          :{" "}
          {fromProfile.budget || fromProfile.workday
            ? [
                fromProfile.budget &&
                  `your budget (${budgetLabel(fromProfile.budget)}; matches only see whether budgets overlap, never the amounts)`,
                fromProfile.workday && `your workday (${WORKDAY_COPY[fromProfile.workday].label})`,
              ]
                .filter(Boolean)
                .join(" and ")
            : "nothing yet. Add your budget and workday there to compare them too"}
          .
        </li>
        <li>
          <span className="font-semibold text-primary">Never used:</span> age, gender, religion,
          ethnicity, disability, family status or anything like them.
        </li>
        <li>Turn sharing off at any time and your answers leave matching right away.</li>
      </ul>
    </Card>
  );
}

/** Every answer by step, with Edit per step and Delete all. */
export function LifestyleSummary({
  answers,
  onEdit,
  onDelete,
}: {
  answers: LifestyleAnswers;
  onEdit: (step: number) => void;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setConfirm(false);
    } catch {
      setError("Couldn't delete your answers. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <h2 className="font-semibold text-[17px] text-primary leading-[22px]">Your answers</h2>
          <p className="text-[13px] text-secondary">
            {answeredCount(answers)} of {QUESTION_COUNT} answered. Skipped questions aren't used.
          </p>
        </div>
      </div>
      <div className="divide-y divide-divider-soft">
        {STEPS.map((step, i) => (
          <section key={step.id} className="px-4 py-3" aria-labelledby={`sum-${step.id}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 id={`sum-${step.id}`} className="font-semibold text-[15px] text-primary">
                {step.title}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil size={14} />}
                aria-label={`Edit ${step.title}`}
                onClick={() => onEdit(i)}
              >
                Edit
              </Button>
            </div>
            <dl className="mt-1 flex flex-col gap-1.5">
              {step.fields.map((field) => {
                const label = answerLabel(answers, field);
                return (
                  <div key={field} className="sm:flex sm:gap-4">
                    <dt className="text-[13px] text-secondary leading-[18px] sm:w-[46%] sm:shrink-0">
                      {questionTitle(field)}
                    </dt>
                    <dd
                      className={cn(
                        "text-[15px] leading-5",
                        label ? "text-primary" : "text-secondary italic",
                      )}
                    >
                      {label ?? "Skipped"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      <div className="border-divider-soft border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          className="text-negative"
          onClick={() => setConfirm(true)}
        >
          Delete all answers
        </Button>
      </div>

      <Modal open={confirm} onOpenChange={setConfirm} title="Delete all answers?" width={440}>
        <div className="p-4">
          <p className="text-[15px] text-primary leading-5">
            This deletes every answer and turns off sharing. Nothing is kept. You can answer again
            any time.
          </p>
          {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-negative hover:brightness-95"
              disabled={busy}
              onClick={remove}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

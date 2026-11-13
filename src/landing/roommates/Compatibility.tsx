import { Link } from "@tanstack/react-router";
import { Ban, Check, CircleHelp, MessageCircle, MoveHorizontal, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { cn, plural } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import {
  type Compatibility,
  DEALBREAKER_CAP,
  MIN_COMPARED,
  scoreLabel,
} from "../../../convex/lib/compatibility";
import { fieldTopic, type MatchField } from "../../../convex/lib/lifestyle";
import type { RoommateCandidate } from "../../../convex/lib/roommates";
import {
  dealbreakerLine,
  differenceLine,
  scoreText,
  topicsLine,
  uncheckedLine,
} from "./candidateCopy";

/** Opens the viewer's own answer to a question, so they can check or change it. */
export type EditAnswer = (field: MatchField) => void;

/** Shared traits named on a candidate card; the rest are in the comparison. */
const TRAITS_ON_CARD = 2;

function tone(c: Compatibility) {
  if (c.dealbreakers.length > 0) return "bg-negative/10 text-negative";
  if (c.score === null) return "bg-btn text-secondary";
  if (c.score >= 65) return "bg-highlight text-accent";
  return "bg-btn text-primary";
}

/** "85% match", tinted by how good it is. */
export function ScoreBadge({ c, className }: { c: Compatibility; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 font-semibold text-[13px]",
        tone(c),
        className,
      )}
    >
      {c.dealbreakers.length > 0 && <Ban size={12} strokeWidth={2.5} aria-hidden />}
      {scoreText(c.score)}
      <span className="sr-only">, {scoreLabel(c)}</span>
    </span>
  );
}

/** The score's lines on a candidate card: dealbreakers, then up to two shared traits. */
export function CardTraits({ c, firstName }: { c: Compatibility; firstName: string }) {
  return (
    <>
      {c.dealbreakers.slice(0, 1).map((d) => (
        <Line
          key={`${d.holder}${d.dealbreaker}`}
          icon={<Ban size={14} />}
          className="text-negative"
        >
          {dealbreakerLine(d, firstName)}
        </Line>
      ))}
      {c.shared
        // The card's plans line already says whether budgets overlap.
        .filter((t) => t.field !== "budget")
        .slice(0, TRAITS_ON_CARD)
        .map((t) => (
          <Line key={t.field} icon={<Check size={14} />} className="text-primary">
            {t.sentence}
          </Line>
        ))}
    </>
  );
}

function Line({
  icon,
  className,
  children,
}: {
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex gap-1.5 text-[13px] leading-4", className)}>
      <span className="mt-px shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * The whole comparison with one candidate: the score, what they share, where
 * they differ, dealbreakers, and the answers it's based on, each linking to
 * where it came from (the viewer's own answer, or their City Profile).
 */
export function CompareDialog({
  candidate,
  onAsk,
  onEditAnswer,
  onClose,
}: {
  candidate: RoommateCandidate;
  onAsk: () => void;
  onEditAnswer?: EditAnswer;
  onClose: () => void;
}) {
  const c = candidate.compatibility;
  const first = candidate.user.firstName;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`You and ${first}`} width={560}>
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        <header className="flex items-center gap-3 px-2">
          <Avatar src={candidate.user.avatar} alt="" size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ScoreBadge c={c} className="h-7 px-2.5 text-[15px]" />
              <span className="font-semibold text-[15px] text-primary">{scoreLabel(c)}</span>
            </div>
            <p className="mt-1 text-[13px] text-secondary leading-4">
              {c.score === null
                ? `You and ${first} have answered fewer than ${MIN_COMPARED} of the same questions.`
                : `Based on ${plural(c.basedOn.length, "answer")} you both shared.`}
            </p>
          </div>
        </header>

        {(c.dealbreakers.length > 0 || c.unchecked.length > 0) && (
          <Section title="Dealbreakers">
            {c.dealbreakers.map((d) => (
              <Line
                key={`${d.holder}${d.dealbreaker}`}
                icon={<Ban size={16} />}
                className="text-[15px] text-negative leading-5"
              >
                {dealbreakerLine(d, first)}
              </Line>
            ))}
            {c.unchecked.map((d) => (
              <Line
                key={d.dealbreaker}
                icon={<CircleHelp size={16} />}
                className="text-[15px] text-secondary leading-5"
              >
                {uncheckedLine(d, first)}
              </Line>
            ))}
          </Section>
        )}

        {c.shared.length > 0 && (
          <Section title="What you share">
            {c.shared.map((t) => (
              <Line
                key={t.field}
                icon={<Check size={16} className="text-positive" />}
                className="text-[15px] text-primary leading-5"
              >
                {t.sentence}
              </Line>
            ))}
          </Section>
        )}

        {c.differences.length > 0 && (
          <Section title="Where you differ">
            {c.differences.map((t) => {
              const { topic, detail } = differenceLine(t, first);
              return (
                <Line
                  key={t.field}
                  icon={<MoveHorizontal size={16} className="text-secondary" />}
                  className="text-[15px] text-primary leading-5"
                >
                  <span className="font-semibold">{topic}</span>
                  <span
                    className={cn(
                      "text-[13px]",
                      t.outcome === "close" ? "text-secondary" : "text-negative",
                    )}
                  >
                    {" · "}
                    {t.outcome === "close" ? "Close" : "Different"}
                  </span>
                  <span className="block text-[13px] text-secondary leading-4">{detail}</span>
                </Line>
              );
            })}
          </Section>
        )}

        <Section title="Based on">
          <li className="text-[13px] text-secondary leading-[18px]">
            {c.basedOn.length > 0 ? (
              <>
                Your answers and {first}'s on{" "}
                <SourceLinks fields={c.basedOn} onEditAnswer={onEditAnswer} />.
              </>
            ) : (
              "Nothing you both answered yet."
            )}
            {c.notCompared.length > 0 &&
              ` Not compared, because one of you skipped it: ${topicsLine(c.notCompared)}.`}
          </li>
        </Section>

        <p className="rounded-lg bg-wash px-3 py-2.5 text-[13px] text-secondary leading-[18px]">
          How it works: each question you both answered counts, the closer your answers the more.
          Sleep, quiet hours, tidiness, smoking and budget count most. A dealbreaker keeps the score
          at {DEALBREAKER_CAP}% or below. Budgets are compared only as whether they overlap. It
          never uses age, gender, religion, ethnicity, disability, family status or anything like
          them, and no AI is involved.
        </p>

        <div className="flex justify-end gap-2 px-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" icon={<MessageCircle size={16} aria-hidden />} onClick={onAsk}>
            Ask to connect
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `compare-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="px-2">
      <h3 id={id} className="mb-1.5 font-semibold text-[15px] text-primary">
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

/**
 * The compared topics, each linking to its source: the viewer's own answer
 * (opens that question) or their City Profile for budget and workday.
 */
function SourceLinks({
  fields,
  onEditAnswer,
}: {
  fields: readonly MatchField[];
  onEditAnswer?: EditAnswer;
}) {
  const link = "font-semibold text-link hover:underline";
  return (
    <>
      {fields.map((f, i) => (
        <span key={f}>
          {i > 0 && (i === fields.length - 1 ? " and " : ", ")}
          {f === "budget" || f === "workday" ? (
            <Link to="/landing/profile" className={link} title="From your City Profile">
              {fieldTopic(f)}
            </Link>
          ) : onEditAnswer ? (
            <button
              type="button"
              className={cn(link, "inline-flex items-baseline gap-0.5")}
              title="See or change your answer"
              onClick={() => onEditAnswer(f)}
            >
              {fieldTopic(f)}
              <Pencil size={10} className="self-center" aria-hidden />
            </button>
          ) : (
            fieldTopic(f)
          )}
        </span>
      ))}
    </>
  );
}

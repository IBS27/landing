import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import type { FactEvidence, FactSource } from "../../../convex/lib/cityProfileFacts";

/** A selectable pill for multi-select lists (interests, neighborhoods, modes, goals). */
export function Chip({
  selected,
  onClick,
  children,
  emoji,
  hint,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  emoji?: string;
  /** Small marker after the label, e.g. "From your words". */
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-semibold text-[15px] transition-colors active:scale-[0.98] disabled:opacity-50",
        selected
          ? "border-transparent bg-btn-soft text-btn-soft-text"
          : "border-divider bg-card text-primary hover:bg-hover",
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {children}
      {hint}
    </button>
  );
}

/** Where a fact came from, in the words the person sees. */
export function sourceText(source: FactSource, evidence: FactEvidence): string {
  if (source === "inferred") return "Inferred";
  if (evidence.kind === "free_text") return "From your words";
  if (evidence.kind === "edit") return "You confirmed";
  return "You said";
}

/** Badge with a tooltip that explains the evidence ("RSVP'd to 3 climbing events"). */
export function SourceBadge({
  source,
  evidence,
  confidence,
}: {
  source: FactSource;
  evidence: FactEvidence;
  confidence?: number;
}) {
  const detail = (
    <span>
      {evidence.summary}
      {evidence.quote && <span className="mt-1 block italic">“{evidence.quote}”</span>}
      {source === "inferred" && confidence !== undefined && (
        <span className="mt-1 block opacity-70">{confidenceText(confidence)}</span>
      )}
    </span>
  );
  return (
    <Tooltip content={detail}>
      <button
        type="button"
        aria-label={`${sourceText(source, evidence)}: ${evidence.summary}`}
        className={cn(
          "inline-flex shrink-0 cursor-default items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
          source === "inferred"
            ? "border border-divider border-dashed text-secondary"
            : evidence.kind === "free_text"
              ? "bg-highlight text-accent"
              : "bg-btn text-secondary",
        )}
      >
        {source === "inferred" && <Sparkles size={11} aria-hidden />}
        {sourceText(source, evidence)}
      </button>
    </Tooltip>
  );
}

export function confidenceText(c: number): string {
  if (c >= 0.75) return "Pretty sure";
  if (c >= 0.5) return "Likely";
  return "A hunch";
}

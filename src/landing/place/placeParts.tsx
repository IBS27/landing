import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { moveInLabel, todayInSF } from "../../../convex/lib/cityProfileFacts";

/** "December 1, 2026" from "2026-12-01". */
export function dateLabel(date: string): string {
  return moveInLabel({ month: date.slice(0, 7), date });
}

export { todayInSF };

/** The message a Convex error carries, or a plain fallback. */
export function errorText(e: unknown): string {
  const data = (e as { data?: unknown }).data;
  return typeof data === "string" ? data : "Something went wrong. Try again.";
}

export const fieldCls =
  "h-10 w-full rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent";

/** A labeled form field: label above, optional hint below. */
export function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-semibold text-[13px] text-primary">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-secondary leading-4">{hint}</p>}
    </div>
  );
}

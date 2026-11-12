import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/format";

/**
 * Facebook's floating-label field: grey border, blue when focused, and the
 * label shrinks to the top once there's a value. `children` gets the input id.
 */
export function FloatingField({
  label,
  value,
  children,
  className,
  pinned,
}: {
  label: string;
  value: string;
  children: (id: string) => ReactNode;
  className?: string;
  /** Keep the label small (date inputs always show their own placeholder). */
  pinned?: boolean;
}) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  const up = pinned || focus || value !== "";
  return (
    <div
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className={cn(
        "relative rounded-md border bg-card transition-colors",
        focus
          ? "border-fb shadow-[0_0_0_1px_var(--fb-blue)]"
          : "border-divider hover:border-secondary/60",
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute left-3 text-secondary transition-all",
          up ? "top-2 text-[12px] leading-4" : "top-4 text-[17px] leading-6",
          focus && "text-fb",
        )}
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export const floatingInputCls =
  "h-14 w-full rounded-md bg-transparent px-3 pt-5 pb-1 text-[17px] text-primary outline-none [color-scheme:light] dark:[color-scheme:dark]";

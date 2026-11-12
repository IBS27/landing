import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { CountBadge } from "@/ui/primitives";

type Props = ComponentPropsWithoutRef<"button"> & {
  label: string;
  active?: boolean;
  count?: number;
  children: ReactNode;
};

/** 40px circle in the top-right header cluster; turns blue while its panel is open. */
export const HeaderButton = forwardRef<HTMLButtonElement, Props>(function HeaderButton(
  { label, active, count = 0, children, className, ...props },
  ref,
) {
  return (
    <Tooltip content={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
          active
            ? "bg-highlight text-fb"
            : "bg-btn text-icon hover:brightness-95 dark:hover:brightness-125",
          className,
        )}
        {...props}
      >
        {children}
        <CountBadge count={count} className="absolute -top-1 -right-1.5" />
      </button>
    </Tooltip>
  );
});

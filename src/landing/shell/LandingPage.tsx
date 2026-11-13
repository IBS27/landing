import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";

/** Column widths (padding included): content is 64px narrower at lg. */
const WIDTHS = {
  /** 896px content: the default. */
  default: "max-w-[960px]",
  /** 720px content: forms and profile pages. */
  narrow: "max-w-[784px]",
  /** 680px content: Facebook's feed column, for message-style lists. */
  feed: "max-w-[744px]",
  /** Editors that need the whole screen. */
  wide: "max-w-[1400px]",
} as const;

/**
 * A standard Landing page: title, optional description and actions, then a
 * centered column. Full-bleed pages (maps) can render without it.
 */
export function LandingPage({
  title,
  description,
  actions,
  children,
  width = "default",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-6 pb-10 lg:px-8", WIDTHS[width], className)}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-bold text-[24px] text-primary leading-7">{title}</h1>
          {description && (
            <p className="mt-1 text-[15px] text-secondary leading-5">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** Placeholder for a section that hasn't been built yet: what it will hold. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[17px] text-primary leading-5">Coming soon</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] text-primary leading-5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-fb" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

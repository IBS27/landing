import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Popover as P, Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconButton } from "./primitives";

/* ---------- Tooltip (Facebook's dark rounded bubble) ---------- */

export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <T.Root delayDuration={350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[100] max-w-xs rounded-lg bg-[rgba(0,0,0,0.8)] px-3 py-2 text-[13px] text-white leading-4 shadow-base dark:bg-[rgba(228,230,235,0.95)] dark:text-[#050505]"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const TooltipProvider = T.Provider;

/* ---------- Popover panel (header dropdowns) ---------- */

export function PopoverPanel({
  trigger,
  children,
  open,
  onOpenChange,
  align = "end",
  width = 360,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  align?: "start" | "center" | "end";
  width?: number;
  className?: string;
}) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "z-50 flex max-h-[calc(100vh-72px)] flex-col overflow-hidden rounded-lg bg-popover shadow-elevated outline-none data-[state=open]:animate-[fade-in_120ms_ease-out]",
            className,
          )}
          style={{ width }}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/* ---------- Dropdown menu (… menus) ---------- */

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({
  children,
  align = "end",
  width = 344,
  className,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  width?: number;
  className?: string;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn("z-50 rounded-lg bg-popover p-2 shadow-elevated outline-none", className)}
        style={{ width }}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  icon,
  label,
  sub,
  onSelect,
  danger,
}: {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-hover",
        danger && "text-negative",
      )}
    >
      {icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-icon">{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px] leading-5">{label}</span>
        {sub && <span className="block text-secondary text-xs">{sub}</span>}
      </span>
    </DM.Item>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="mx-2 my-1 h-px bg-divider" />;
}

/* ---------- Modal dialog ---------- */

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  width = 500,
  className,
  bodyClassName,
  hideHeader,
  onBack,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  className?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
  onBack?: () => void;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-[rgba(244,244,244,0.8)] dark:bg-[rgba(11,11,11,0.8)]" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-1/2 left-1/2 z-[61] flex max-h-[calc(100vh-40px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card shadow-elevated outline-none",
            className,
          )}
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        >
          {hideHeader ? (
            <D.Title className="sr-only">{title}</D.Title>
          ) : (
            <div className="relative flex h-[60px] shrink-0 items-center justify-center border-divider border-b px-16">
              {onBack && (
                <IconButton label="Back" className="absolute left-4" onClick={onBack}>
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
                    <path d="M12.7 3.3a1 1 0 0 1 0 1.4L7.4 10l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
                  </svg>
                </IconButton>
              )}
              <D.Title className="truncate font-bold text-lg text-primary">{title}</D.Title>
              <D.Close asChild>
                <IconButton label="Close" className="absolute right-4">
                  <X size={20} strokeWidth={2.4} className="text-secondary" />
                </IconButton>
              </D.Close>
            </div>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

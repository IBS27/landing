import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Popover as P, Tooltip as T } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/format";
import { IconButton } from "./primitives";

/* ---------- Tooltip (Facebook's frosted bubble: white in light mode, black in dark) ---------- */

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
      <T.Trigger
        asChild
        // Only keyboard focus shows the tooltip: a menu handing focus back to its
        // trigger after a mouse pick (e.g. "See all") must not leave it open.
        onFocus={(e) => {
          if (!e.currentTarget.matches(":focus-visible")) e.preventDefault();
        }}
      >
        {children}
      </T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[100] max-w-xs rounded-xl bg-[rgba(255,255,255,0.8)] px-3 py-2 text-[13px] text-[#080809] leading-[17px] shadow-[0_2px_4px_0_rgba(0,0,0,0.5)] backdrop-blur-md dark:bg-[rgba(0,0,0,0.8)] dark:text-[#e2e5e9]"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const TooltipProvider = T.Provider;

/* ---------- Auto-focus on open ---------- */

/** Whether the latest interaction was a pointer press (vs. a key press). */
let pointerInput = false;
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", () => (pointerInput = true), true);
  document.addEventListener("keydown", () => (pointerInput = false), true);
}

/**
 * Facebook draws no focus ring inside a panel opened with the mouse. When a
 * pointer opened it, focus the panel itself instead of its first control (Tab
 * still walks into it); keyboard opens keep Radix's first-control focus.
 */
function useOpenAutoFocus() {
  const ref = useRef<HTMLDivElement>(null);
  const onOpenAutoFocus = (e: Event) => {
    if (!pointerInput) return;
    e.preventDefault();
    ref.current?.focus({ preventScroll: true });
  };
  return { ref, onOpenAutoFocus };
}

/* ---------- Pointer arrow (the notch Facebook draws on "…" menus) ---------- */

type Align = "start" | "center" | "end";

/** 16x10 notch that sits on the panel's top edge, pointing at the trigger's center. */
function PanelArrow({ align }: { align: Align }) {
  return (
    <svg
      viewBox="0 0 16 10"
      width="16"
      height="10"
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-full fill-popover group-data-[side=top]:hidden",
        align === "end" && "right-0",
        align === "start" && "left-0 -scale-x-100",
        align === "center" && "left-1/2 -translate-x-1/2",
      )}
    >
      {align === "center" ? (
        <path d="M0 10C3 10 5.6 2.9 6.8 1.1a1.4 1.4 0 0 1 2.4 0C10.4 2.9 13 10 16 10Z" />
      ) : (
        <path d="M0 10C5 7.2 9.6 3.6 12.1 1.2a1.9 1.9 0 0 1 3 .3c.6.8.9 1.7.9 2.6V10Z" />
      )}
    </svg>
  );
}

/** With an arrow, the panel's square corner lines up 4px past the trigger's center. */
const arrowShift = (align: Align, triggerWidthVar: string) =>
  align === "center"
    ? undefined
    : `calc((var(${triggerWidthVar}) / 2 - 4px) * ${align === "end" ? -1 : 1}) 0`;

const ARROW_CORNER: Record<Align, string> = {
  end: "data-[side=bottom]:rounded-tr-none",
  start: "data-[side=bottom]:rounded-tl-none",
  center: "",
};

/** The card shadow as a filter, so the notch casts the same shadow as the panel. */
const ARROW_SHADOW =
  "drop-shadow(0 12px 14px var(--shadow-2)) drop-shadow(0 2px 2px var(--shadow-1))";

/* ---------- Popover panel (header dropdowns) ---------- */

export function PopoverPanel({
  trigger,
  children,
  open,
  onOpenChange,
  align = "end",
  alignOffset,
  width = 360,
  arrow = false,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  align?: Align;
  /** Shift along the alignment axis (header panels line up with the right edge). */
  alignOffset?: number;
  width?: number;
  /** Draw Facebook's pointer notch toward the trigger. */
  arrow?: boolean;
  className?: string;
}) {
  const autoFocus = useOpenAutoFocus();
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          ref={autoFocus.ref}
          onOpenAutoFocus={autoFocus.onOpenAutoFocus}
          align={align}
          alignOffset={alignOffset}
          sideOffset={arrow ? 15 : 4}
          collisionPadding={8}
          className={cn(
            "group z-50 flex max-h-[calc(100vh-72px)] flex-col rounded-xl bg-popover outline-none data-[state=open]:animate-[fade-in_120ms_ease-out]",
            arrow ? ARROW_CORNER[align] : "shadow-elevated",
            className,
          )}
          style={{
            width,
            translate: arrow ? arrowShift(align, "--radix-popover-trigger-width") : undefined,
            filter: arrow ? ARROW_SHADOW : undefined,
          }}
        >
          {arrow && <PanelArrow align={align} />}
          {/* Clip scrolling content to the rounded corners without clipping the arrow. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
            {children}
          </div>
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
  arrow = false,
  className,
}: {
  children: ReactNode;
  align?: Align;
  width?: number;
  /** Draw Facebook's pointer notch toward the trigger (header "…" menus). */
  arrow?: boolean;
  className?: string;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={arrow ? 15 : 6}
        collisionPadding={8}
        className={cn(
          "group z-50 rounded-xl bg-popover p-2 outline-none",
          arrow ? ARROW_CORNER[align] : "shadow-elevated",
          className,
        )}
        style={{
          width,
          translate: arrow ? arrowShift(align, "--radix-dropdown-menu-trigger-width") : undefined,
          filter: arrow ? ARROW_SHADOW : undefined,
        }}
      >
        {arrow && <PanelArrow align={align} />}
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
        "flex min-h-9 cursor-pointer select-none items-center gap-3 rounded-[4px] p-2 outline-none data-[highlighted]:bg-hover",
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

/** The header's left (logo, search) and right (Menu … Account) clusters stay undimmed. */
const NAV_LEFT = 320;
const NAV_RIGHT = 208;
const VEIL = "bg-[rgba(244,244,244,0.8)] dark:bg-[rgba(11,11,11,0.8)]";
/** Darkens the white header to the veil's grey (246) while dark icons keep full strength. */
const NAV_VEIL =
  "fixed top-0 z-[60] h-14 bg-[rgb(246,246,246)] mix-blend-darken dark:bg-[rgba(11,11,11,0.8)] dark:mix-blend-normal";

/** Facebook's modal scrim: veils the page and the header's centre tabs, not its icon clusters. */
export function ModalScrim() {
  return (
    <>
      <D.Overlay
        className={`fixed inset-0 z-[60] ${VEIL}`}
        style={{
          clipPath: `polygon(${NAV_LEFT}px 0, calc(100% - ${NAV_RIGHT}px) 0, calc(100% - ${NAV_RIGHT}px) 56px, 100% 56px, 100% 100%, 0 100%, 0 56px, ${NAV_LEFT}px 56px)`,
        }}
      />
      <div aria-hidden className={`${NAV_VEIL} left-0`} style={{ width: NAV_LEFT }} />
      <div aria-hidden className={`${NAV_VEIL} right-0`} style={{ width: NAV_RIGHT }} />
    </>
  );
}

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
  const autoFocus = useOpenAutoFocus();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <ModalScrim />
        <D.Content
          ref={autoFocus.ref}
          onOpenAutoFocus={autoFocus.onOpenAutoFocus}
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
                <IconButton label="Back" className="absolute! left-4" onClick={onBack}>
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
                    <path d="M12.7 3.3a1 1 0 0 1 0 1.4L7.4 10l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
                  </svg>
                </IconButton>
              )}
              <D.Title className="truncate font-bold text-lg text-primary">{title}</D.Title>
              <D.Close asChild>
                <IconButton label="Close" className="absolute! right-4">
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

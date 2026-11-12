import { ChevronRight, Globe, Lock, type LucideIcon, Users, UsersRound } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import { PREFS } from "../../../../convex/lib/settings";

/* ---------- Data ---------- */

/** The viewer's settings (live from Convex). */
export function useSettings() {
  return useQ(api.settings.get, {});
}

/**
 * Shows a new value the moment it's picked, then follows the server once
 * the mutation lands (or rolls back if it fails).
 */
export function useOptimistic<T>(server: T | undefined, save: (v: T) => Promise<unknown>) {
  const [pending, setPending] = useState<{ value: T } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the server value changes
  useEffect(() => setPending(null), [server]);
  const value = pending ? pending.value : server;
  const set = (v: T) => {
    setPending({ value: v });
    save(v).catch(() => setPending(null));
  };
  return [value, set] as const;
}

/** A display-only preference (see `PREFS` in convex/lib/settings.ts). */
export function usePref(key: string) {
  const settings = useSettings();
  const setPref = useM(api.settings.setPref);
  return useOptimistic(settings?.prefs[key], (value) => setPref({ key, value }));
}

export function prefOptions(key: string): Option<string>[] {
  return (PREFS[key]?.options ?? []).map((o) => ({ value: o, label: o }));
}

/* ---------- Layout ---------- */

/** A titled block inside a settings pane, Facebook's 17px section header. */
export function Group({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pt-2 [&+&]:mt-2 [&+&]:border-divider [&+&]:border-t [&+&]:pt-4">
      {title && <h3 className="px-2 font-semibold text-[17px] text-primary leading-5">{title}</h3>}
      {description && (
        <p className="px-2 pt-1 text-[15px] text-secondary leading-5">{description}</p>
      )}
      <div className={cn("flex flex-col", (title || description) && "pt-2")}>{children}</div>
    </section>
  );
}

function RowShell({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover active:bg-pressed"
    >
      {children}
    </button>
  );
}

export function RowIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn">
      <Icon size={20} className="text-icon" />
    </span>
  );
}

function RowText({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-medium text-[15px] text-primary leading-5">{title}</span>
      {sub && <span className="block text-[13px] text-secondary leading-4">{sub}</span>}
    </span>
  );
}

/** A navigation row: title, current value underneath, chevron. */
export function LinkRow({
  title,
  sub,
  Icon,
  onClick,
}: {
  title: ReactNode;
  sub?: ReactNode;
  Icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <RowShell onClick={onClick}>
      {Icon && <RowIcon Icon={Icon} />}
      <RowText title={title} sub={sub} />
      <ChevronRight size={20} className="shrink-0 text-icon-secondary" />
    </RowShell>
  );
}

/* ---------- Switch ---------- */

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const knob = (
    <span
      className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-[left]",
        on ? "left-[22px]" : "left-0.5",
      )}
    />
  );
  const track = cn(
    "relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors",
    on ? "bg-fb" : "bg-[#8f9297] dark:bg-[#5e6166]",
    disabled && "opacity-40",
  );
  // Inside a toggle row the row's own input is the control; this is just the visual.
  if (!onChange)
    return (
      <span aria-hidden className={track}>
        {knob}
      </span>
    );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={track}
    >
      {knob}
    </button>
  );
}

/** A row with a switch on the right; the whole row toggles. */
export function ToggleRow({
  title,
  sub,
  on,
  onChange,
  Icon,
  disabled,
}: {
  title: string;
  sub?: ReactNode;
  on: boolean | undefined;
  onChange: (v: boolean) => void;
  Icon?: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover",
        disabled && "pointer-events-none",
      )}
    >
      {Icon && <RowIcon Icon={Icon} />}
      <RowText title={title} sub={sub} />
      <input
        type="checkbox"
        role="switch"
        aria-checked={on ?? false}
        className="sr-only"
        checked={on ?? false}
        disabled={disabled || on === undefined}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={title}
      />
      <Switch on={on ?? false} label={title} disabled={disabled} />
    </label>
  );
}

/** A toggle stored as an "On" / "Off" display-only preference. */
export function PrefToggle({
  id,
  title,
  sub,
  Icon,
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  Icon?: LucideIcon;
}) {
  const [value, set] = usePref(id);
  return (
    <ToggleRow
      title={title}
      sub={sub}
      Icon={Icon}
      on={value === undefined ? undefined : value === "On"}
      onChange={(on) => set(on ? "On" : "Off")}
    />
  );
}

/* ---------- Radio + choice dialog ---------- */

export function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-5 w-5 shrink-0 rounded-full",
        checked ? "border-[6px] border-fb" : "border-2 border-icon-secondary",
      )}
    />
  );
}

export type Option<T extends string> = {
  value: T;
  label: string;
  sub?: string;
  Icon?: LucideIcon;
};

/** Audience-style icons for common option labels. */
const AUDIENCE_ICONS: Record<string, LucideIcon> = {
  Public: Globe,
  Everyone: Globe,
  Friends: Users,
  "Friends of friends": UsersRound,
  "Only me": Lock,
};

export function RadioList<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-col">
      {options.map((o) => {
        const Icon = o.Icon ?? AUDIENCE_ICONS[o.label];
        return (
          <label
            key={o.value}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
          >
            {Icon && <RowIcon Icon={Icon} />}
            <RowText title={o.label} sub={o.sub} />
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <Radio checked={value === o.value} />
          </label>
        );
      })}
    </div>
  );
}

/**
 * "Who can …?" row: shows the current choice and opens Facebook's radio
 * dialog (Cancel / Save) to change it.
 */
export function ChoiceRow<T extends string>({
  title,
  description,
  options,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T | undefined>(value);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <LinkRow
        title={title}
        sub={current?.label ?? " "}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      />
      <Modal open={open} onOpenChange={setOpen} title={title} width={548}>
        <div className="px-2 pt-3 pb-2">
          {description && (
            <p className="px-2 pb-2 text-[15px] text-secondary leading-5">{description}</p>
          )}
          <RadioList name={title} options={options} value={draft} onChange={setDraft} />
        </div>
        <div className="flex justify-end gap-2 border-divider border-t px-4 py-3">
          <CancelButton onClick={() => setOpen(false)} />
          <Button
            variant="primary"
            className="min-w-[84px]"
            disabled={draft === undefined || draft === value}
            onClick={() => {
              if (draft !== undefined) onChange(draft);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Facebook's blue text "Cancel" in dialog footers. */
export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-md px-3 font-semibold text-[15px] text-link hover:bg-hover"
    >
      Cancel
    </button>
  );
}

/** A choice row stored as a display-only preference. */
export function PrefChoice({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  const [value, set] = usePref(id);
  return (
    <ChoiceRow
      title={title}
      description={description}
      options={prefOptions(id)}
      value={value}
      onChange={set}
    />
  );
}

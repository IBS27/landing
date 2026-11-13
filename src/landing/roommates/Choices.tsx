import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type Choice<T extends string> = { id: T; label: string; hint?: string };

/**
 * One option. Options with hints render as tiles in a grid, short ones as
 * pills, so a question reads at a glance either way.
 */
function Option({
  role,
  selected,
  onClick,
  tile,
  label,
  hint,
}: {
  role: "radio" | "checkbox";
  selected: boolean;
  onClick: () => void;
  tile: boolean;
  label: string;
  hint?: string;
}) {
  const props = {
    type: "button" as const,
    onClick,
    className: cn(
      "border text-left transition-colors focus-visible:outline-2 focus-visible:outline-fb focus-visible:outline-offset-2",
      tile
        ? "flex min-h-14 items-start gap-2 rounded-lg px-3 py-2.5"
        : "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5",
      selected
        ? "border-fb bg-highlight text-accent"
        : "border-divider bg-card text-primary hover:bg-hover",
    ),
  };
  const content = (
    <>
      {role === "checkbox" && (
        <span
          aria-hidden
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            tile && "mt-0.5",
            selected ? "border-fb bg-fb text-white" : "border-secondary",
          )}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-semibold text-[15px] leading-5">{label}</span>
        {tile && hint && (
          <span className="mt-0.5 block text-[13px] text-secondary leading-4">{hint}</span>
        )}
      </span>
    </>
  );
  return role === "radio" ? (
    <button role="radio" aria-checked={selected} {...props}>
      {content}
    </button>
  ) : (
    <button role="checkbox" aria-checked={selected} {...props}>
      {content}
    </button>
  );
}

function Group({
  role,
  label,
  tile,
  children,
}: {
  role: "radiogroup" | "group";
  label: string;
  tile: boolean;
  children: ReactNode;
}) {
  const className = tile
    ? "grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
    : "flex flex-wrap gap-2";
  return role === "radiogroup" ? (
    <div role="radiogroup" aria-label={label} className={className}>
      {children}
    </div>
  ) : (
    <div role="group" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/**
 * Changes arrive as updaters on the latest answer, not as values computed from
 * what was rendered, so two quick taps can never overwrite each other.
 */
export type Update<V> = (prev: V | undefined) => V | undefined;

/** Picking the selected option again un-picks it (the question becomes skipped). */
export function pickOne<T extends string>(id: T): Update<T> {
  return (prev) => (prev === id ? undefined : id);
}

/**
 * Toggles one option (`null` = "none of these", an empty list), keeping
 * `order`. Un-picking the last option, or "none" again, skips the question.
 */
export function toggleMany<T extends string>(order: readonly T[], id: T | null): Update<T[]> {
  return (prev) => {
    if (id === null) return prev?.length === 0 ? undefined : [];
    const list = prev ?? [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    return next.length ? order.filter((x) => next.includes(x)) : undefined;
  };
}

/** Pick one. */
export function SingleChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Choice<T>[];
  value: T | undefined;
  onChange: (update: Update<T>) => void;
}) {
  const tile = options.some((o) => o.hint);
  return (
    <Group role="radiogroup" label={label} tile={tile}>
      {options.map((o) => (
        <Option
          key={o.id}
          role="radio"
          tile={tile}
          label={o.label}
          hint={o.hint}
          selected={value === o.id}
          onClick={() => onChange(pickOne(o.id))}
        />
      ))}
    </Group>
  );
}

/**
 * Pick any. `none` is an explicit "none of these" (an empty list), which is
 * different from skipping the question (undefined).
 */
export function MultiChoice<T extends string>({
  label,
  options,
  none,
  value,
  onChange,
  tile = false,
}: {
  label: string;
  options: readonly Choice<T>[];
  none: string;
  value: readonly T[] | undefined;
  onChange: (update: Update<T[]>) => void;
  tile?: boolean;
}) {
  const order = options.map((o) => o.id);
  return (
    <Group role="group" label={label} tile={tile}>
      <Option
        role="checkbox"
        tile={tile}
        label={none}
        selected={value?.length === 0}
        onClick={() => onChange(toggleMany(order, null))}
      />
      {options.map((o) => (
        <Option
          key={o.id}
          role="checkbox"
          tile={tile}
          label={o.label}
          hint={o.hint}
          selected={value?.includes(o.id) ?? false}
          onClick={() => onChange(toggleMany(order, o.id))}
        />
      ))}
    </Group>
  );
}

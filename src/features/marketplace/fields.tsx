import { DropdownMenu as DM } from "radix-ui";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuTrigger } from "@/ui/overlays";

/** Facebook's floating-label form fields (328x58, radius 12). */

const box =
  "relative w-full rounded-xl border border-[#CED0D4] bg-card transition-colors focus-within:border-fb focus-within:shadow-[0_0_0_1px_var(--fb-blue)] dark:border-[#3e4042]";

function Label({ htmlFor, up, children }: { htmlFor?: string; up: boolean; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "pointer-events-none absolute left-4 text-placeholder transition-all",
        up ? "top-2 text-[12px] leading-4" : "top-[18px] text-[16px] leading-5",
      )}
    >
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  prefix,
  inputMode,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  inputMode?: "numeric" | "decimal" | "text";
  type?: "text" | "date";
  maxLength?: number;
}) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  const up = focus || value !== "" || type === "date";
  return (
    <div className={cn(box, "h-[58px]")}>
      <Label htmlFor={id} up={up}>
        {label}
      </Label>
      <div className="flex h-full items-end px-4 pb-[10px]">
        {prefix && up && (
          <span className="mr-0.5 text-[16px] text-primary leading-5">{prefix}</span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-[16px] text-primary leading-5 outline-none [color-scheme:inherit]"
        />
      </div>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  const up = focus || value !== "";
  return (
    <div className={cn(box, "min-h-[116px]")}>
      <Label htmlFor={id} up={up}>
        {label}
      </Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => onChange(e.target.value)}
        className="block min-h-[114px] w-full resize-y rounded-xl bg-transparent px-4 pt-[26px] pb-[10px] text-[16px] text-primary leading-5 outline-none"
      />
    </div>
  );
}

/** A combobox-style select with the ▾ caret, opening a Facebook menu. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={undefined}
          className={cn(box, "h-[58px] text-left outline-none focus-visible:border-fb")}
        >
          <Label up={!!selected}>{label}</Label>
          <span className="absolute right-4 bottom-[10px] left-4 truncate pr-6 text-[16px] text-primary leading-5">
            {selected?.label ?? ""}
          </span>
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="currentColor"
            className="absolute top-1/2 right-4 -translate-y-1/2 text-icon"
            aria-hidden
          >
            <path d="M3.2 5.6h9.6a.6.6 0 0 1 .45 1l-4.8 5.2a.6.6 0 0 1-.9 0l-4.8-5.2a.6.6 0 0 1 .45-1Z" />
          </svg>
        </button>
      </MenuTrigger>
      <MenuContent align="start" width={328} className="max-h-[320px] overflow-y-auto">
        {options.map((o) => (
          <DM.Item
            key={o.value}
            onSelect={() => onChange(o.value)}
            className={cn(
              "flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-[15px] outline-none data-[highlighted]:bg-hover",
              o.value === value && "font-semibold",
            )}
          >
            {o.label}
          </DM.Item>
        ))}
      </MenuContent>
    </Menu>
  );
}

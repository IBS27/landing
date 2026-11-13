import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import {
  COLORS,
  type ColorId,
  colorOf,
  STYLES,
  type StyleId,
  styleLabel,
  VIBE_LIMITS,
  type VibeValue,
  vibeProblems,
} from "../../../convex/lib/vibe";

/** A selectable pill for styles and colors. */
export function Pill({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-semibold text-[15px] transition-colors active:scale-[0.98] disabled:opacity-40",
        selected
          ? "border-transparent bg-btn-soft text-btn-soft-text"
          : "border-divider bg-card text-primary hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

export function Swatch({ id, size = 16 }: { id: ColorId; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full border border-black/10 dark:border-white/20"
      style={{ width: size, height: size, background: colorOf(id).hex }}
    />
  );
}

/** A vibe as the person reads it: summary, styles, palette and keywords. */
export function VibeView({ vibe }: { vibe: VibeValue }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-primary leading-5">{vibe.summary}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px] leading-5">
        <dt className="text-secondary">Styles</dt>
        <dd className="font-semibold text-primary">{vibe.styles.map(styleLabel).join(", ")}</dd>
        <dt className="text-secondary">Colors</dt>
        <dd className="flex flex-wrap gap-x-3 gap-y-1 text-primary">
          {vibe.palette.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <Swatch id={c} />
              {colorOf(c).label}
            </span>
          ))}
        </dd>
        {vibe.keywords.length > 0 && (
          <>
            <dt className="text-secondary">Keywords</dt>
            <dd className="text-primary">{vibe.keywords.join(", ")}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/**
 * Writes or edits a vibe. Uses the same `vibeProblems` rules the server
 * checks, so what passes here saves.
 */
export function VibeEditor({
  initial,
  busy,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: VibeValue;
  busy: boolean;
  saveLabel: string;
  onSave: (vibe: VibeValue) => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState(initial.summary);
  const [styles, setStyles] = useState<StyleId[]>(initial.styles);
  const [palette, setPalette] = useState<ColorId[]>(initial.palette);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [draft, setDraft] = useState("");
  const [tried, setTried] = useState(false);
  const L = VIBE_LIMITS;
  const vibe: VibeValue = { summary, styles, palette, keywords };
  const problems = vibeProblems(vibe);

  const addKeyword = (raw: string = draft) => {
    const k = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, L.keywordMax);
    if (k && !keywords.includes(k) && keywords.length < L.keywordsMax)
      setKeywords([...keywords, k]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-[13px] text-secondary">Describe the vibe</span>
        <textarea
          value={summary}
          maxLength={L.summaryMax}
          rows={3}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Warm and plant-filled, with a reading corner and lots of natural wood."
          className="w-full resize-none rounded-lg border border-divider bg-card px-3 py-2.5 text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder focus:border-fb focus:shadow-[0_0_0_1px_var(--fb-blue)]"
        />
        <span className="self-end text-[12px] text-secondary">
          {summary.length}/{L.summaryMax}
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-[13px] text-secondary">
          Styles · pick {L.styles.min}–{L.styles.max}
        </legend>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Pill
              key={s.id}
              selected={styles.includes(s.id)}
              disabled={styles.length >= L.styles.max}
              onClick={() => setStyles(toggle(styles, s.id))}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-[13px] text-secondary">
          Colors · pick {L.palette.min}–{L.palette.max}
        </legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <Pill
              key={c.id}
              selected={palette.includes(c.id)}
              disabled={palette.length >= L.palette.max}
              onClick={() => setPalette(toggle(palette, c.id))}
            >
              <Swatch id={c.id} />
              {c.label}
            </Pill>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[13px] text-secondary">
          Keywords for finding pieces · up to {L.keywordsMax}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {keywords.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-md bg-btn py-0.5 pr-1 pl-2 text-[13px] text-primary"
            >
              {k}
              <button
                type="button"
                aria-label={`Remove ${k}`}
                onClick={() => setKeywords(keywords.filter((x) => x !== k))}
                className="rounded p-0.5 text-secondary hover:bg-hover"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {keywords.length < L.keywordsMax && (
            <input
              value={draft}
              aria-label="Add a keyword"
              placeholder={keywords.length ? "Add another" : "e.g. walnut, linen, floor lamp"}
              maxLength={L.keywordMax}
              onChange={(e) => {
                const v = e.target.value;
                // A comma finishes a keyword, like Enter.
                if (v.includes(",")) addKeyword(v.replace(/,/g, ""));
                else setDraft(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              onBlur={() => addKeyword()}
              className="h-8 min-w-[160px] flex-1 rounded-md border border-divider bg-card px-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-divider border-t pt-3">
        <p className="min-w-0 text-[13px] text-negative">{tried ? problems[0] : ""}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              setTried(true);
              if (problems.length === 0) onSave(vibe);
            }}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

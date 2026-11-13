import { Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck, Lock, Pencil, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { errorText } from "@/landing/errorText";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import {
  earliestMoveInMonth,
  type FactKey,
  factSlot,
  GOALS,
  SF_NEIGHBORHOODS,
  TRANSPORT_MODES,
  todayInSF,
  WORK_HOURS,
  WORKPLACES,
} from "../../../convex/lib/cityProfileFacts";
import { getInterest, INTEREST_SECTIONS, INTERESTS } from "../../../convex/lib/interests";
import {
  applyProposals,
  type BriefForm,
  briefFromProfile,
  briefProblems,
  type CityProfile,
  EMPTY_BRIEF,
  liveQuote,
  toggle,
  toSaveArgs,
  withMoveInDate,
  withMoveInMonth,
} from "./briefState";
import { Chip, confidenceText } from "./FactChip";
import { ProfileSummary } from "./ProfileSummary";
import { TellUsBox } from "./TellUsBox";

/**
 * Landing onboarding (#3): the City Profile brief. A structured form that
 * works without AI, plus an optional "Tell us about you" box where Muse
 * proposes facts the person confirms. Saved facts are "stated"; everything
 * Landing infers later shows up separately with its evidence.
 */
export function CityBriefPage({ startEditing = false }: { startEditing?: boolean }) {
  const profile = useQ(api.cityProfile.get, {});
  const navigate = useNavigate();
  // Opened from the City Profile's "Edit brief": edit straight away and go back there after.
  const [editing, setEditing] = useState(startEditing);
  const [justSaved, setJustSaved] = useState(false);
  const backToProfile = () => void navigate({ to: "/landing/profile" });

  if (profile === undefined) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </Shell>
    );
  }

  const onboarded = profile.briefCompletedAt !== null;
  if (onboarded && !editing) {
    return (
      <Shell>
        {justSaved && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-highlight px-4 py-3 text-[15px] text-primary">
            <CircleCheck size={20} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              Saved. Landing will use this for apartment search, neighborhoods and your crew.
            </span>
            <Link
              to="/landing"
              className="flex h-9 shrink-0 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
            >
              Continue to Landing
            </Link>
          </div>
        )}
        <ProfileSummary
          profile={profile}
          action={
            <Button
              icon={<Pencil size={16} />}
              onClick={() => {
                setJustSaved(false);
                setEditing(true);
              }}
            >
              Edit brief
            </Button>
          }
        />
        <PrivacyNote />
      </Shell>
    );
  }

  return (
    <Shell>
      <BriefEditor
        // Re-initialise when the viewer (persona) changes.
        key={profile.userId}
        profile={profile}
        onboarded={onboarded}
        onCancel={onboarded ? (startEditing ? backToProfile : () => setEditing(false)) : undefined}
        onSaved={() => {
          if (startEditing) return backToProfile();
          setEditing(false);
          setJustSaved(true);
          window.scrollTo({ top: 0 });
        }}
      />
    </Shell>
  );
}

/** Sits inside Landing's layout, which provides the page background and nav. */
function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[784px] px-4 pt-6 pb-10 lg:px-8">{children}</div>;
}

function BriefEditor({
  profile,
  onboarded,
  onCancel,
  onSaved,
}: {
  profile: CityProfile;
  onboarded: boolean;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const save = useM(api.cityProfile.saveBrief);
  const [form, setForm] = useState<BriefForm>(() =>
    onboarded ? briefFromProfile(profile) : EMPTY_BRIEF,
  );
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayInSF();
  const problems = briefProblems(form, today, profile.moveIn);
  const set = <K extends keyof BriefForm>(k: K, value: BriefForm[K]) =>
    setForm((f) => ({ ...f, [k]: value }));

  // A fresh viewer with nothing stated yet: start the move-in month two months out.
  useEffect(() => {
    if (onboarded) return;
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setForm((f) => (f.moveInMonth ? f : { ...f, moveInMonth: month }));
  }, [onboarded]);

  // Opened at one section from "What Muse knows about you" (`#brief-budget`): start there.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id.startsWith("brief-")) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  async function submit() {
    setTried(true);
    if (problems.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await save(toSaveArgs(form));
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const fromWords = (slot: string) => {
    const quote = liveQuote(form, slot);
    return quote ? (
      <Tooltip content={<span className="italic">“{quote}”</span>}>
        <span className="inline-flex text-accent" role="img" aria-label="From your words">
          <Sparkles size={13} />
        </span>
      </Tooltip>
    ) : undefined;
  };

  const suggestedInterests = profile.interests.filter(
    (f) => f.source === "inferred" && !form.interests.includes(f.value.id),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-2">
        <h1 className="font-bold text-[24px] text-primary leading-7">
          {onboarded ? "Edit your City Profile" : "Set up your City Profile"}
        </h1>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          A two-minute brief about your move to San Francisco. Landing uses it to rank apartments,
          compare neighborhoods and find people arriving when you do.
        </p>
      </div>

      <Section
        title="Tell us about you"
        badge="Optional"
        help="Write it the way you'd tell a friend. Muse turns it into suggestions you can check."
      >
        <TellUsBox onAdd={(picked) => setForm((f) => applyProposals(f, picked))} />
      </Section>

      <Section
        id={briefAnchor("budget")}
        title="Budget"
        help="Monthly rent you're comfortable with."
      >
        <div className="flex flex-wrap items-center gap-2">
          <MoneyInput
            label="From"
            value={form.budgetMin}
            onChange={(v) => set("budgetMin", v)}
            placeholder="1,500"
          />
          <span className="text-secondary">to</span>
          <MoneyInput
            label="Up to"
            value={form.budgetMax}
            onChange={(v) => set("budgetMax", v)}
            placeholder="2,400"
          />
          <span className="text-[15px] text-secondary">a month</span>
          {fromWords("budget")}
        </div>
      </Section>

      <Section
        id={briefAnchor("moveIn")}
        title="Move-in"
        help="Crews match people arriving the same month. Already moved? Pick when you did."
      >
        <div className="flex flex-wrap items-end gap-3">
          <LabeledInput label="Month">
            {(id) => (
              <input
                id={id}
                type="month"
                min={earliestMoveInMonth(today)}
                value={form.moveInMonth}
                onChange={(e) => setForm((f) => withMoveInMonth(f, e.target.value))}
                className={inputCls}
              />
            )}
          </LabeledInput>
          <LabeledInput label="Exact date (optional)">
            {(id) => (
              <input
                id={id}
                type="date"
                min={`${earliestMoveInMonth(today)}-01`}
                value={form.moveInDate}
                onChange={(e) => setForm((f) => withMoveInDate(f, e.target.value))}
                className={inputCls}
              />
            )}
          </LabeledInput>
          <span className="pb-2.5">{fromWords("moveIn")}</span>
        </div>
      </Section>

      <Section
        id={briefAnchor("neighborhood")}
        title="Neighborhoods you're considering"
        help="Pick any that interest you, or none if you're not sure yet."
      >
        <div className="flex flex-wrap gap-2">
          {SF_NEIGHBORHOODS.filter((n) => !("park" in n && n.park))
            .map((n) => ({ slug: n.slug, label: "short" in n ? n.short : n.name }))
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((n) => (
              <Chip
                key={n.slug}
                selected={form.neighborhoods.includes(n.slug)}
                onClick={() => set("neighborhoods", toggle(form.neighborhoods, n.slug))}
                hint={fromWords(`neighborhood:${n.slug}`)}
              >
                {n.label}
              </Chip>
            ))}
        </div>
      </Section>

      <Section
        id={briefAnchor("transport")}
        title="Getting around"
        help="How you'll get around the city. Leave Car off if you won't have one."
      >
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_MODES.map((m) => (
            <Chip
              key={m.id}
              selected={form.transport.includes(m.id)}
              onClick={() => set("transport", toggle(form.transport, m.id))}
            >
              {m.label}
            </Chip>
          ))}
          {fromWords("transport")}
        </div>
      </Section>

      <Section
        id={briefAnchor("schedule")}
        title="Schedule"
        help="So plans and suggestions fit when you're actually free."
      >
        <div className="flex flex-col gap-3">
          <Segmented
            label="Work hours"
            options={WORK_HOURS}
            value={form.workHours}
            onChange={(v) => set("workHours", v)}
          />
          <Segmented
            label="Where you work"
            options={WORKPLACES}
            value={form.workplace}
            onChange={(v) => set("workplace", v === form.workplace ? "" : v)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-[15px] text-primary">
            <input
              type="checkbox"
              checked={form.weekendsFree}
              onChange={(e) => set("weekendsFree", e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            My weekends are usually free
            {fromWords("schedule")}
          </label>
        </div>
      </Section>

      <Section
        id={briefAnchor("employer")}
        title="Work"
        badge="Optional"
        help="Only used to offer a crew of people starting at the same place, if you opt in."
      >
        <div className="flex flex-wrap gap-3">
          <LabeledInput label="Employer or school" className="min-w-[220px] flex-1">
            {(id) => (
              <input
                id={id}
                value={form.employer}
                maxLength={80}
                onChange={(e) => set("employer", e.target.value)}
                className={inputCls}
                placeholder="e.g. Figma"
              />
            )}
          </LabeledInput>
          <LabeledInput label="Where it is" className="min-w-[180px] flex-1">
            {(id) => (
              <input
                id={id}
                value={form.workArea}
                maxLength={80}
                onChange={(e) => set("workArea", e.target.value)}
                className={inputCls}
                placeholder="e.g. SoMa, Mountain View"
              />
            )}
          </LabeledInput>
        </div>
      </Section>

      <Section
        id={briefAnchor("interest")}
        title="Interests"
        help="Pick a few. These match you with Groups, Events and your crew."
        aside={
          <span
            className={cn(
              "text-[13px]",
              form.interests.length >= 3 ? "text-secondary" : "text-accent",
            )}
          >
            {form.interests.length} picked
          </span>
        }
      >
        {suggestedInterests.length > 0 && (
          <div className="mb-4 rounded-lg bg-comment p-3">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-[13px] text-secondary">
              <Sparkles size={13} /> Muse noticed from your activity. Add any that fit.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedInterests.map((f) => {
                const i = getInterest(f.value.id);
                return (
                  <Tooltip
                    key={f._id}
                    content={
                      <span>
                        {f.evidence.summary}
                        <span className="mt-1 block opacity-70">
                          {confidenceText(f.confidence)}
                        </span>
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => set("interests", [...form.interests, f.value.id])}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-secondary/50 border-dashed bg-card px-3 font-semibold text-[15px] text-primary hover:bg-hover"
                    >
                      <span aria-hidden>+</span>
                      <span aria-hidden>{i.emoji}</span>
                      {i.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {INTEREST_SECTIONS.map((s) => (
            <div key={s.id}>
              <h4 className="mb-2 font-semibold text-[13px] text-secondary">{s.label}</h4>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.filter((i) => i.section === s.id).map((i) => (
                  <Chip
                    key={i.id}
                    emoji={i.emoji}
                    selected={form.interests.includes(i.id)}
                    onClick={() => set("interests", toggle(form.interests, i.id))}
                    hint={fromWords(factSlot({ key: "interest", value: { id: i.id } }))}
                  >
                    {i.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id={briefAnchor("goal")}
        title="What do you want from the move?"
        help="Pick as many as you like."
      >
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip
              key={g.id}
              emoji={g.emoji}
              selected={form.goals.includes(g.id)}
              onClick={() => set("goals", toggle(form.goals, g.id))}
              hint={fromWords(`goal:${g.id}`)}
            >
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      <PrivacyNote />

      <Card className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 text-[13px]">
          {tried && problems.length > 0 ? (
            <ul className="text-negative">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : error ? (
            <p className="text-negative">{error}</p>
          ) : (
            <p className="text-secondary">You can change any of this later.</p>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={() => void submit()}
            icon={busy ? <Spinner size={16} className="text-white" /> : undefined}
          >
            {onboarded ? "Save changes" : "Save my City Profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb focus:shadow-[0_0_0_1px_var(--fb-blue)] [color-scheme:light] dark:[color-scheme:dark]";

/** The brief section for a fact key, so "What Muse knows about you" can link straight to it. */
export function briefAnchor(key: FactKey): string {
  return `brief-${key}`;
}

function Section({
  id,
  title,
  help,
  badge,
  aside,
  children,
}: {
  id?: string;
  title: string;
  help?: string;
  badge?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-[72px] px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-[17px] text-primary leading-[22px]">
            {title}
            {badge && (
              <span className="ml-1.5 font-normal text-[15px] text-secondary">· {badge}</span>
            )}
          </h2>
          {help && <p className="mt-0.5 text-[13px] text-secondary leading-4">{help}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function LabeledInput({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="font-semibold text-[13px] text-secondary">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-36">
      <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-[15px] text-secondary">
        $
      </span>
      <input
        aria-label={`${label} (dollars per month)`}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ""))}
        className={cn(inputCls, "pl-6")}
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-32 shrink-0 font-semibold text-[13px] text-secondary">{label}</span>
      {options.map((o) => (
        <Chip key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function PrivacyNote() {
  return (
    <div className="flex items-start gap-3 px-2 py-3 text-[13px] text-secondary">
      <Lock size={16} className="mt-0.5 shrink-0" />
      <p>
        Landing never asks for your age, gender, ethnicity, religion, health or family status, and
        never uses them for matching. Muse only suggests; nothing is added to your profile until you
        confirm it.
      </p>
    </div>
  );
}

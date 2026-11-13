import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useM } from "@/app/viewer";
import { timeAgo } from "@/lib/citations";
import { cn } from "@/lib/format";
import { Button, Card, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BillView, ChoreView, GroceryView } from "../../../convex/house";
import {
  BILL_CADENCES,
  type BillCadence,
  CHORE_CADENCES,
  type ChoreCadence,
  money,
  parseDollars,
  periodLabel,
  TITLE_MAX,
} from "../../../convex/lib/house";
import type { UserSummary } from "../../../convex/lib/users";

/**
 * A house's three lists (#38): chores, bills and groceries. Every row is
 * entered and checked by the people who live there; nothing here is written by
 * AI. #39 adds Muse's chore rotations and bill splits.
 */

export const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";
const select =
  "h-8 rounded-full bg-btn px-3 font-semibold text-[13px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The message a Convex error carries, or a plain fallback. */
export function errorText(e: unknown) {
  const data = (e as { data?: unknown }).data;
  return typeof data === "string" ? data : "Something went wrong. Try again.";
}

/** Run a mutation, keeping its error for the card to show. */
function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error };
}

function Section({
  title,
  sub,
  action,
  error,
  children,
}: {
  title: string;
  sub: string;
  action?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Card className="mb-4 overflow-hidden">
      <section aria-label={title}>
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <h2 className="font-bold text-[17px] text-primary leading-[22px]">{title}</h2>
            <p className="text-[13px] text-secondary leading-4">{sub}</p>
          </div>
          {action}
        </header>
        {error && (
          <p role="alert" className="px-4 pb-2 text-[13px] text-[#E41E3F]">
            {error}
          </p>
        )}
        {children}
      </section>
    </Card>
  );
}

const firstName = (u: UserSummary | null) => u?.firstName ?? "Someone who moved out";

/* ───────────── Chores ───────────── */

const CADENCE_LABEL: Record<ChoreCadence, string> = {
  once: "Once",
  weekly: "Every week",
  monthly: "Every month",
};

export function ChoresCard({
  houseId,
  chores,
  members,
}: {
  houseId: Id<"houses">;
  chores: ChoreView[];
  members: UserSummary[];
}) {
  const [adding, setAdding] = useState(false);
  const { run, error } = useAction();
  const setDone = useM(api.house.setChoreDone);
  const assign = useM(api.house.assignChore);
  const remove = useM(api.house.removeChore);
  return (
    <Section
      title="Chores"
      sub="Who's on what. Weekly and monthly chores start fresh each week or month."
      error={error}
      action={
        !adding && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={16} />}
            onClick={() => setAdding(true)}
          >
            Add chore
          </Button>
        )
      }
    >
      {adding && <AddChore houseId={houseId} members={members} onDone={() => setAdding(false)} />}
      {chores.length === 0 ? (
        !adding && <p className="px-4 pb-4 text-[15px] text-secondary">No chores yet.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {chores.map((c) => {
            const period = periodLabel(c.cadence);
            return (
              <li key={c._id} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={c.done !== null}
                  aria-label={`${c.title}: done${period ? ` ${period}` : ""}`}
                  onChange={(e) => run(() => setDone({ choreId: c._id, done: e.target.checked }))}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[15px] leading-5",
                      c.done ? "text-secondary line-through" : "text-primary",
                    )}
                  >
                    {c.title}
                  </p>
                  <p className="text-[13px] text-secondary leading-4">
                    {CADENCE_LABEL[c.cadence]}
                    {" · "}
                    {c.done
                      ? `Done by ${firstName(c.done.by)} ${timeAgo(c.done.at)}`
                      : c.assignee
                        ? `${c.assignee.firstName}'s turn`
                        : "Nobody's on it"}
                  </p>
                </div>
                <select
                  aria-label={`Who's on ${c.title}`}
                  className={cn(select, "max-w-[40%]")}
                  value={c.assignee?._id ?? ""}
                  onChange={(e) =>
                    run(() =>
                      assign({
                        choreId: c._id,
                        assigneeId: e.target.value ? (e.target.value as Id<"users">) : null,
                      }),
                    )
                  }
                >
                  <option value="">Nobody</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.firstName}
                    </option>
                  ))}
                </select>
                <IconButton
                  label={`Remove ${c.title}`}
                  variant="ghost"
                  size={32}
                  onClick={() => run(() => remove({ choreId: c._id }))}
                >
                  <Trash2 size={16} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function AddChore({
  houseId,
  members,
  onDone,
}: {
  houseId: Id<"houses">;
  members: UserSummary[];
  onDone: () => void;
}) {
  const add = useM(api.house.addChore);
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<ChoreCadence>("weekly");
  const [assignee, setAssignee] = useState("");
  const { run, busy, error } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() =>
      add({
        houseId,
        title,
        cadence,
        assigneeId: assignee ? (assignee as Id<"users">) : undefined,
      }),
    );
    if (ok) onDone();
  };
  return (
    <form onSubmit={submit} className="mx-4 mb-4 rounded-lg bg-wash p-3 dark:bg-hover">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px_150px]">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Chore</span>
          <input
            className={field}
            placeholder="Take the bins out"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">How often</span>
          <select
            className={field}
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ChoreCadence)}
          >
            {CHORE_CADENCES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Who's on it</span>
          <select className={field} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-2 text-[13px] text-[#E41E3F]">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !title.trim()}>
          Add chore
        </Button>
      </div>
    </form>
  );
}

/* ───────────── Bills ───────────── */

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtDay = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));
const fmtPaid = (ts: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(ts);

function dueLabel(b: BillView, today: string) {
  if (!b.dueDate) return "No due date";
  if (b.overdue) return `Overdue · was due ${fmtDay(b.dueDate)}`;
  if (b.dueDate === today) return "Due today";
  return `Due ${fmtDay(b.dueDate)}`;
}

export function BillsCard({
  houseId,
  bills,
  today,
}: {
  houseId: Id<"houses">;
  bills: { open: BillView[]; paid: BillView[]; paidCount: number };
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const { run, error } = useAction();
  const setPaid = useM(api.house.setBillPaid);
  const remove = useM(api.house.removeBill);
  const openTotal = bills.open.reduce((sum, b) => sum + b.amountCents, 0);
  return (
    <Section
      title="Bills"
      sub={
        bills.open.length > 0
          ? `What's due and who paid it. ${money(openTotal)} still to pay.`
          : "What's due and who paid it."
      }
      error={error}
      action={
        !adding && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={16} />}
            onClick={() => setAdding(true)}
          >
            Add bill
          </Button>
        )
      }
    >
      {adding && <AddBill houseId={houseId} today={today} onDone={() => setAdding(false)} />}
      {bills.open.length === 0 ? (
        !adding && <p className="px-4 pb-3 text-[15px] text-secondary">Nothing due.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {bills.open.map((b) => (
            <li key={b._id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-[15px] text-primary leading-5">
                  <span className="truncate">{b.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {money(b.amountCents)}
                  </span>
                </p>
                <p className="text-[13px] leading-4">
                  <span className={b.overdue ? "font-semibold text-[#E41E3F]" : "text-secondary"}>
                    {dueLabel(b, today)}
                  </span>
                  <span className="text-secondary">
                    {b.cadence === "monthly" && " · Every month"}
                    {b.addedBy && ` · Added by ${b.addedBy.firstName}`}
                  </span>
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => run(() => setPaid({ billId: b._id, paid: true }))}
              >
                I paid it
              </Button>
              <IconButton
                label={`Remove ${b.title}`}
                variant="ghost"
                size={32}
                onClick={() => run(() => remove({ billId: b._id }))}
              >
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {bills.paid.length > 0 && (
        <div className="border-divider border-t">
          <button
            type="button"
            aria-expanded={showPaid}
            onClick={() => setShowPaid((s) => !s)}
            className="flex w-full items-center gap-1.5 px-4 py-2.5 font-semibold text-[13px] text-secondary hover:bg-hover"
          >
            Paid ({bills.paidCount})
            <ChevronDown
              size={16}
              className={cn("transition-transform", showPaid && "rotate-180")}
              aria-hidden
            />
          </button>
          {showPaid && (
            <ul className="divide-y divide-divider">
              {bills.paid.map((b) => (
                <li key={b._id} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-[15px] text-secondary leading-5">
                      <span className="truncate">{b.title}</span>
                      <span className="shrink-0 tabular-nums">{money(b.amountCents)}</span>
                    </p>
                    {b.paid && (
                      <p className="text-[13px] text-secondary leading-4">
                        Paid by {firstName(b.paid.by)} · {fmtPaid(b.paid.at)}
                        {b.dueDate && ` · was due ${fmtDay(b.dueDate)}`}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => setPaid({ billId: b._id, paid: false }))}
                  >
                    Undo
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}

function AddBill({
  houseId,
  today,
  onDone,
}: {
  houseId: Id<"houses">;
  today: string;
  onDone: () => void;
}) {
  const add = useM(api.house.addBill);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [cadence, setCadence] = useState<BillCadence>("once");
  const [problem, setProblem] = useState<string | null>(null);
  const { run, busy, error } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollars(amount);
    if (cents === null) return setProblem("Enter an amount like 142.37");
    if (cadence === "monthly" && !due) return setProblem("Monthly bills need a due date");
    setProblem(null);
    const ok = await run(() =>
      add({ houseId, title, amountCents: cents, dueDate: due || undefined, cadence }),
    );
    if (ok) onDone();
  };
  return (
    <form onSubmit={submit} className="mx-4 mb-4 rounded-lg bg-wash p-3 dark:bg-hover">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_160px_140px]">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">What for</span>
          <input
            className={field}
            placeholder="PG&E"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Amount</span>
          <input
            className={field}
            inputMode="decimal"
            placeholder="$142.37"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Due</span>
          <input
            type="date"
            min={today}
            className={field}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Repeats</span>
          <select
            className={field}
            value={cadence}
            onChange={(e) => setCadence(e.target.value as BillCadence)}
          >
            {BILL_CADENCES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(problem ?? error) && <p className="mt-2 text-[13px] text-[#E41E3F]">{problem ?? error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy || !title.trim() || !amount.trim()}
        >
          Add bill
        </Button>
      </div>
    </form>
  );
}

/* ───────────── Groceries ───────────── */

export function GroceriesCard({
  houseId,
  groceries,
}: {
  houseId: Id<"houses">;
  groceries: GroceryView[];
}) {
  const [text, setText] = useState("");
  const { run, busy, error } = useAction();
  const add = useM(api.house.addGrocery);
  const setChecked = useM(api.house.setGroceryChecked);
  const remove = useM(api.house.removeGrocery);
  const clear = useM(api.house.clearChecked);
  const checked = groceries.filter((g) => g.checked).length;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => add({ houseId, text }))) setText("");
  };
  return (
    <Section
      title="Grocery list"
      sub="Add what the house needs. Check it off when you've got it."
      error={error}
      action={
        checked > 0 && (
          <Button size="sm" variant="ghost" onClick={() => run(() => clear({ houseId }))}>
            Clear checked ({checked})
          </Button>
        )
      }
    >
      <form onSubmit={submit} className="flex gap-2 px-4 pb-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Add to the grocery list</span>
          <input
            className={field}
            placeholder="Oat milk"
            maxLength={TITLE_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
          Add
        </Button>
      </form>
      {groceries.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-secondary">Nothing on the list.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {groceries.map((g) => (
            <li key={g._id} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={g.checked !== null}
                aria-label={`Got ${g.text}`}
                onChange={(e) =>
                  run(() => setChecked({ itemId: g._id, checked: e.target.checked }))
                }
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[15px] leading-5",
                    g.checked ? "text-secondary line-through" : "text-primary",
                  )}
                >
                  {g.text}
                </p>
                <p className="text-[13px] text-secondary leading-4">
                  {g.checked
                    ? `Got by ${firstName(g.checked.by)} ${timeAgo(g.checked.at)}`
                    : `Added by ${firstName(g.addedBy)}`}
                </p>
              </div>
              <IconButton
                label={`Remove ${g.text}`}
                variant="ghost"
                size={32}
                onClick={() => run(() => remove({ itemId: g._id }))}
              >
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

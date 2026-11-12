import { useAction } from "convex/react";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/format";
import { Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { FACT_KEY_LABELS, factSlot } from "../../../convex/lib/cityProfileFacts";
import type { Proposal, Suggestions } from "./briefState";

const MAX = 1000;

/**
 * Optional "Tell us about you" box. Muse reads the text and proposes facts,
 * each with the words it came from; nothing is added until the person ticks
 * it and presses "Add to my brief", and nothing is saved until they save.
 */
export function TellUsBox({ onAdd }: { onAdd: (picked: Proposal[]) => void }) {
  const suggest = useAction(api.cityProfile.suggestFromText);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [via, setVia] = useState<Suggestions["via"] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await suggest({ text });
      setProposals(res.proposals);
      setVia(res.via);
      setPicked(new Set(res.proposals.map((p) => factSlot(p.entry))));
    } catch (e) {
      setError(
        e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!proposals) return;
    onAdd(proposals.filter((p) => picked.has(factSlot(p.entry))));
    setProposals(null);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <textarea
          aria-label="Tell us about you"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. Moving from Chicago in March for a job in SoMa. No car, I bike and take BART. Budget around $2,000. I boulder, love live music and want to meet people."
          className="w-full resize-none rounded-lg border border-divider bg-card px-3 py-2.5 text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder focus:border-fb focus:shadow-[0_0_0_1px_var(--fb-blue)]"
        />
        <span className="absolute right-2 bottom-2 text-[12px] text-secondary">
          {text.length}/{MAX}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="soft"
          disabled={busy || text.trim().length < 10}
          onClick={() => void run()}
          icon={busy ? <Spinner size={16} /> : <Sparkles size={16} />}
        >
          {busy ? "Muse is reading…" : "Suggest from my words"}
        </Button>
        <span className="text-[13px] text-secondary">Muse suggests; you choose what goes in.</span>
      </div>
      {error && <p className="text-[13px] text-negative">{error}</p>}

      {proposals && (
        <div className="rounded-lg border border-divider bg-wash/60 p-3">
          {proposals.length === 0 ? (
            <p className="text-[15px] text-secondary">
              Muse didn't find anything to add. Try mentioning your budget, when you're moving, how
              you get around, or what you like to do.
            </p>
          ) : (
            <>
              <p className="font-semibold text-[15px] text-primary">
                Here's what Muse picked up. Untick anything that's wrong.
              </p>
              <p className="mb-2 text-[13px] text-secondary">
                {via === "fallback"
                  ? "Muse's AI is off right now, so these come from simple keyword matching."
                  : "Each one shows the words it came from."}
              </p>
              <ul className="flex flex-col gap-1">
                {proposals.map((p) => {
                  const slot = factSlot(p.entry);
                  const on = picked.has(slot);
                  return (
                    <li key={slot}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-hover">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const next = new Set(picked);
                            if (on) next.delete(slot);
                            else next.add(slot);
                            setPicked(next);
                          }}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                            on ? "border-accent bg-accent text-white" : "border-secondary/60",
                          )}
                        >
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] text-primary">
                            <span className="text-secondary">{FACT_KEY_LABELS[p.entry.key]}: </span>
                            {p.label}
                          </span>
                          <span className="block truncate text-[13px] text-secondary italic">
                            “{p.quote}”
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setProposals(null)}>
                  Dismiss
                </Button>
                <Button variant="primary" disabled={picked.size === 0} onClick={add}>
                  Add to my brief
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

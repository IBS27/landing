import { Link } from "@tanstack/react-router";
import { BadgePercent, Check, Sparkles, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toConversation } from "@/landing/links";
import { cn, price } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Avatar, Button, Card, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEIGHBORHOODS } from "../../../convex/lib/listings";
import { MOVE_SIZES, type MoveSize } from "../../../convex/lib/moverQuotes";

const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none focus:border-fb";

const STATUS = {
  none: { label: "Not asked yet", tone: "text-secondary" },
  waiting: { label: "Request waiting for your OK", tone: "text-link" },
  sent: { label: "Request sent", tone: "text-secondary" },
  replied: { label: "Replied", tone: "text-[#24832C] dark:text-[#3FBB46]" },
  discarded: { label: "You discarded the request", tone: "text-secondary" },
} as const;

/**
 * "Mover quotes" (#28): Muse reads moving companies' Page posts for rates and
 * deals, drafts a quote request to each (approved in the Inbox), negotiates
 * their replies, and the quotes show side by side.
 */
export function MoverQuotes() {
  const data = useQ(api.moverQuotes.mine, {});
  const save = useM(api.moverQuotes.saveRequest);
  const request = useM(api.moverQuotes.requestQuotes);
  const [jobId, setJobId] = useState<Id<"aiJobs"> | null>(null);
  const job = useQ(api.ai.jobs.get, jobId ? { jobId } : "skip");
  const [f, setF] = useState({
    size: "1br" as MoveSize,
    date: "",
    from: "Mission",
    to: "Inner Sunset",
    stairs: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Start from the saved move once it loads.
  const req = data?.request;
  useEffect(() => {
    if (req)
      setF({
        size: req.size,
        date: req.date,
        from: req.fromNeighborhood,
        to: req.toNeighborhood,
        stairs: req.stairs,
      });
  }, [req]);

  const running = job && (job.status === "queued" || job.status === "running");

  const getQuotes = async () => {
    setError(null);
    try {
      await save({
        size: f.size,
        date: f.date,
        fromNeighborhood: f.from,
        toNeighborhood: f.to,
        stairs: f.stairs,
      });
      setJobId(await request({}));
    } catch (e) {
      const d = (e as { data?: unknown }).data;
      setError(typeof d === "string" ? d : "Couldn't get quotes. Try again.");
    }
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="flex items-center gap-2 font-bold text-[17px] text-primary leading-5">
          <Truck size={18} aria-hidden /> Mover quotes
        </h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Muse reads moving companies' Pages for their rates and deals, asks each one for a quote,
          and pushes for a better price when they reply. You approve every message in your Inbox.
        </p>
      </div>

      <div className="mx-4 mb-3 grid grid-cols-2 gap-2 rounded-lg bg-wash p-3 sm:grid-cols-[110px_150px_1fr_1fr_auto] dark:bg-hover">
        <select
          aria-label="Move size"
          className={field}
          value={f.size}
          onChange={(e) => setF({ ...f, size: e.target.value as MoveSize })}
        >
          {MOVE_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Move date"
          type="date"
          className={field}
          value={f.date}
          onChange={(e) => setF({ ...f, date: e.target.value })}
        />
        <select
          aria-label="From"
          className={field}
          value={f.from}
          onChange={(e) => setF({ ...f, from: e.target.value })}
        >
          {NEIGHBORHOODS.map((n) => (
            <option key={n.name} value={n.name}>
              From {n.name}
            </option>
          ))}
        </select>
        <select
          aria-label="To"
          className={field}
          value={f.to}
          onChange={(e) => setF({ ...f, to: e.target.value })}
        >
          {NEIGHBORHOODS.map((n) => (
            <option key={n.name} value={n.name}>
              To {n.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[15px] text-primary">
          <input
            type="checkbox"
            checked={f.stairs}
            onChange={(e) => setF({ ...f, stairs: e.target.checked })}
          />
          Stairs
        </label>
        <div className="col-span-2 flex items-center justify-end gap-3 sm:col-span-5">
          {running && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-secondary">
              <Spinner size={14} /> {job?.progress?.label ?? "Working…"}
            </span>
          )}
          {error && <span className="text-[13px] text-[#E41E3F]">{error}</span>}
          <Button variant="primary" size="sm" disabled={!f.date || !!running} onClick={getQuotes}>
            {data?.movers.length ? "Get new quotes" : "Get quotes"}
          </Button>
        </div>
      </div>

      {data === undefined ? (
        <div className="p-4">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data.movers.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-secondary">
          Pick your move and Muse will gather quotes from movers on Facebook.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3">
          {data.movers.map((m, i) => {
            const st = m.counterWaiting
              ? { label: "Muse drafted a reply. Waiting for your OK", tone: "text-link" }
              : STATUS[m.status];
            const best = i === 0;
            return (
              <div
                key={m.page._id}
                className={cn(
                  "flex flex-col rounded-lg border p-3",
                  best ? "border-[#24832C] dark:border-[#3FBB46]" : "border-divider",
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar src={m.page.avatar} size={32} />
                  <div className="min-w-0 flex-1 truncate font-semibold text-[15px] text-primary">
                    {m.page.name}
                  </div>
                  {best && (
                    <span className="rounded-full bg-[#E3F5E5] px-2 py-0.5 font-semibold text-[#24832C] text-[11px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
                      Best price
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {m.quoted ? (
                    <>
                      <div className="text-[12px] text-secondary">Their quote</div>
                      <div className="font-bold text-[24px] text-primary leading-7">
                        {price(m.quoted.price)}
                      </div>
                      {m.estimate && (
                        <div className="text-[12px] text-secondary">
                          Estimate was {price(m.estimate.total)}
                        </div>
                      )}
                    </>
                  ) : m.estimate ? (
                    <>
                      <div className="text-[12px] text-secondary">
                        Estimate from their posted rates
                      </div>
                      <div className="font-bold text-[24px] text-primary leading-7">
                        {price(m.estimate.total)}
                      </div>
                    </>
                  ) : null}
                </div>

                {m.estimate && (
                  <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-secondary leading-4">
                    <li>
                      {m.estimate.hours} h × {price(m.card.hourly)}/h ({m.card.crew} movers) ={" "}
                      {price(m.estimate.labor)}
                    </li>
                    <li>Truck fee {price(m.estimate.truckFee)}</li>
                    {m.estimate.applied && (
                      <li className="font-semibold text-[#24832C] dark:text-[#3FBB46]">
                        −{price(m.estimate.applied.amount)} {m.estimate.applied.label}
                      </li>
                    )}
                  </ul>
                )}

                {m.card.discounts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.card.discounts.map((d) => (
                      <span
                        key={d.label}
                        className="inline-flex items-center gap-1 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[#8A6100] text-[11px] dark:bg-[#F7B928]/20 dark:text-[#F7B928]"
                      >
                        <BadgePercent size={11} aria-hidden /> {d.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[12px]">
                  {m.sources && <SourcesChip sources={m.sources} label="Rates" />}
                  {m.via === "fallback" && <span className="text-secondary">Read by rules</span>}
                </div>
                <div className={cn("mt-2 flex items-center gap-1 text-[12px]", st.tone)}>
                  {m.status === "replied" && !m.counterWaiting ? (
                    <Check size={12} aria-hidden />
                  ) : (
                    <Sparkles size={12} aria-hidden />
                  )}
                  {m.status === "waiting" || m.counterWaiting ? (
                    <Link to="/landing/inbox" className="font-semibold hover:underline">
                      {st.label}
                    </Link>
                  ) : (
                    st.label
                  )}
                  {m.conversationId && m.status !== "waiting" && m.status !== "none" && (
                    <Link
                      {...toConversation(m.conversationId)}
                      className="ml-auto font-semibold text-link hover:underline"
                    >
                      Open chat
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

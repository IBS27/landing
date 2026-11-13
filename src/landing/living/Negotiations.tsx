import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toConversation } from "@/landing/links";
import { price } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Row = NonNullable<ReturnType<typeof useRows>>[number];

function useRows() {
  return useQ(api.negotiations.mine, {});
}

/**
 * "Negotiate with Muse": the buyer's Marketplace chats, each with limits they
 * set. Muse's messages go to the Inbox for approval (#6).
 */
export function Negotiations() {
  const rows = useRows();
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-bold text-[17px] text-primary leading-5">Negotiate with Muse</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Set your limits and Muse drafts each message to the seller. Nothing is sent until you
          approve it in your Inbox.
        </p>
      </div>
      {rows === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-secondary">
          Message a seller on Marketplace and the chat shows up here.
        </p>
      ) : (
        <ul className="divide-y divide-divider">
          {rows.map((r) => (
            <NegotiationRow key={r.conversationId} r={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function statusLine(r: Row) {
  const n = r.negotiation;
  if (!n) return null;
  const seller = r.seller?.firstName ?? "the seller";
  if (n.status === "stopped") return "Stopped";
  if (n.status === "paused") return "Paused";
  if (n.draft?.status === "pending") return "Muse's next message is waiting for your approval";
  if (n.lastMove === "accept" && (n.draft?.status === "approved" || n.draft?.status === "edited"))
    return `You agreed on ${n.lastOffer ? price(n.lastOffer) : "a price"}`;
  if (
    n.lastMove === "walk_away" &&
    (n.draft?.status === "approved" || n.draft?.status === "edited")
  )
    return "You walked away";
  if (n.draft?.status === "approved" || n.draft?.status === "edited")
    return `Waiting for ${seller} to reply`;
  if (!n.draft) return "Muse is drafting…";
  return `Waiting for ${seller}. Muse drafts again when they reply`;
}

function NegotiationRow({ r }: { r: Row }) {
  const [editing, setEditing] = useState(false);
  const setStatus = useM(api.negotiations.setStatus);
  const n = r.negotiation;
  const line = statusLine(r);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        {r.listing.photo ? (
          <img
            src={r.listing.photo}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-md bg-wash" />
        )}
        <div className="min-w-0 flex-1">
          <Link
            {...toConversation(r.conversationId)}
            className="block truncate font-semibold text-[15px] text-primary hover:underline"
          >
            {r.listing.title}
          </Link>
          <div className="text-[13px] text-secondary">
            Asking {price(r.listing.price)}
            {r.seller ? ` · ${r.seller.name}` : ""}
          </div>
          {n && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
              <span className="text-primary">
                Max <b>{price(n.maxPrice)}</b>
                {n.targetPrice ? ` · Ideal ${price(n.targetPrice)}` : ""}
              </span>
              {line && (
                <span className="inline-flex items-center gap-1 text-secondary">
                  <Sparkles size={12} className="text-[#8A3FFC]" aria-hidden />
                  {n.draft?.status === "pending" ? (
                    <Link to="/landing/inbox" className="font-semibold text-link hover:underline">
                      {line}
                    </Link>
                  ) : (
                    line
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!n || n.status === "stopped" ? (
            !editing && (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Negotiate with Muse
              </Button>
            )
          ) : (
            <>
              {!editing && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Edit limits
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setStatus({
                    negotiationId: n._id,
                    status: n.status === "paused" ? "active" : "paused",
                  })
                }
              >
                {n.status === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus({ negotiationId: n._id, status: "stopped" })}
              >
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
      {editing && (
        <LimitsForm
          listingId={r.listing._id}
          asking={r.listing.price}
          initial={n && n.status !== "stopped" ? n : null}
          onDone={() => setEditing(false)}
        />
      )}
    </li>
  );
}

const field =
  "rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";

function LimitsForm({
  listingId,
  asking,
  initial,
  onDone,
}: {
  listingId: Id<"listings">;
  asking: number;
  initial: { maxPrice: number; targetPrice: number | null; notes: string | null } | null;
  onDone: () => void;
}) {
  const start = useM(api.negotiations.start);
  const [max, setMax] = useState(String(initial?.maxPrice ?? ""));
  const [target, setTarget] = useState(String(initial?.targetPrice ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const maxPrice = Number(max);
    const targetPrice = target.trim() ? Number(target) : undefined;
    setBusy(true);
    setError(null);
    try {
      await start({ listingId, maxPrice, targetPrice, notes: notes.trim() || undefined });
      onDone();
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setError(typeof data === "string" ? data : "Check your limits and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-wash p-3 dark:bg-hover">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Your max (required)</span>
          <input
            type="number"
            min={1}
            step={5}
            placeholder={String(asking)}
            className={`${field} w-32`}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Ideal price</span>
          <input
            type="number"
            min={1}
            step={5}
            className={`${field} w-32`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Notes for Muse</span>
          <input
            placeholder="Can pick up today"
            className={field}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-[13px] text-[#E41E3F]">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={busy || !max}>
          {busy ? "Starting…" : initial ? "Save limits" : "Start"}
        </Button>
      </div>
    </div>
  );
}

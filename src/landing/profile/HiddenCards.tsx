import { Link } from "@tanstack/react-router";
import { CalendarDays, Eye, Tag, UsersRound } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toEvent, toGroup, toListing } from "@/landing/links";
import { timeAgo } from "@/lib/citations";
import { plural } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { HiddenCard } from "../../../convex/lib/museKnows";
import { ConfirmAction } from "./ConfirmAction";

/**
 * Cards the viewer marked "Not for me" (#100, #108), with "Show again" for one
 * and "Show all again". Showing a card again only lets it come back in
 * recommendations: what Muse learned from the skip stays until the viewer
 * removes the interest or clears their activity, and clearing activity keeps
 * these hidden.
 */
export function HiddenCards() {
  const hidden = useQ(api.museKnows.hidden, {});
  const showCard = useM(api.museKnows.showCard);
  const showAll = useM(api.museKnows.showAllCards);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = (targetId: string) => {
    setBusy(targetId);
    setError(null);
    showCard({ targetId })
      .catch(() => setError("Couldn't show that again. Try again."))
      .finally(() => setBusy(null));
  };
  const n = hidden ? `${hidden.total.toLocaleString("en-US")}${hidden.more ? "+" : ""}` : "";
  const one = hidden?.total === 1 && !hidden.more;
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h2 className="font-bold text-[17px] text-primary leading-[22px]">Cards you hid</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-4">
          Events, Groups and listings you marked "Not for me" stay out of your recommendations.
          Showing one again lets it come back. It doesn't change your interests: remove those above,
          or clear your activity, which keeps these hidden.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-negative">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-divider-soft border-t pt-3">
          <p className="min-w-0 flex-1 text-[13px] text-secondary leading-4" aria-live="polite">
            {hidden === undefined ? (
              <Skeleton className="h-3 w-40" />
            ) : hidden.total === 0 ? (
              "You haven't hidden any cards."
            ) : (
              <>
                <span className="font-semibold text-primary">Hidden:</span> {n}{" "}
                {one ? "card" : "cards"}
              </>
            )}
          </p>
          <ConfirmAction
            label="Show all again"
            icon={<Eye size={16} aria-hidden />}
            disabled={!hidden || hidden.total === 0}
            title="Show all your hidden cards again?"
            body={
              <>
                {one ? "The card you hid" : `All ${n} cards you hid`} can show up in your
                recommendations again. What Muse learned from them doesn't change: remove the
                interest or clear your activity for that.
              </>
            }
            confirmLabel="Show all"
            onConfirm={() => showAll({})}
          />
        </div>
      </div>
      {hidden && hidden.total > 0 && (
        <ul
          aria-label="Hidden cards"
          className="divide-y divide-divider-soft border-divider-soft border-t"
        >
          {hidden.cards.map((c) => (
            <HiddenRow
              key={c.targetId}
              card={c}
              busy={busy === c.targetId}
              onShow={() => show(c.targetId)}
            />
          ))}
          {(hidden.unavailable > 0 || hidden.older > 0) && (
            <li className="px-4 py-2.5 text-[13px] text-secondary leading-4">
              {[
                hidden.unavailable > 0 &&
                  `${hidden.cards.length > 0 ? "+" : ""}${hidden.unavailable} ${hidden.unavailable === 1 ? "isn't" : "aren't"} available to you now`,
                hidden.older > 0 && `${plural(hidden.older, "older card")} not listed`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

const KIND = {
  event: { icon: CalendarDays, label: "Event" },
  group: { icon: UsersRound, label: "Group" },
  listing: { icon: Tag, label: "Listing" },
} as const;

function HiddenRow({
  card: c,
  busy,
  onShow,
}: {
  card: HiddenCard;
  busy: boolean;
  onShow: () => void;
}) {
  const { icon: Icon, label } = KIND[c.kind];
  const name = c.kind === "group" ? c.name : c.title;
  const link =
    c.kind === "event"
      ? toEvent(c.eventId)
      : c.kind === "group"
        ? toGroup(c)
        : toListing(c.listingId);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-primary">
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          {...link}
          className="block truncate font-semibold text-[15px] text-primary leading-5 hover:underline"
        >
          {name}
        </Link>
        <p className="text-[13px] text-secondary leading-4">
          {label} · hidden {timeAgo(c.at)}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Show again: ${name}`}
        disabled={busy}
        onClick={onShow}
        className="shrink-0"
      >
        Show again
      </Button>
    </li>
  );
}

import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronDown,
  Heart,
  Info,
  Lightbulb,
  MessageCircle,
  Moon,
  Ticket,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn, shortAge } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CitedSource } from "../../../convex/lib/citations";

/**
 * Neighborhood scores (#17): Things to do, Food and Transit (shared percentiles
 * across SF, computed by code, each with its sources), Interest fit (the
 * viewer's own), "How this is calculated", and "Getting around at night":
 * cited facts and locals' words, never a safety score.
 *
 * `NeighborhoodScores` loads one neighborhood. For a side-by-side comparison
 * (#19), load `api.neighborhoodScores.get` per neighborhood and render
 * `ScoreTiles` and `NightFacts` in two columns.
 */
export function NeighborhoodScores({ neighborhoodId }: { neighborhoodId: Id<"neighborhoods"> }) {
  const data = useQ(api.neighborhoodScores.get, { neighborhoodId });
  if (data === undefined) return <ScoresSkeleton />;
  if (data === null) return null;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-bold text-[20px] text-primary leading-6">
          How {data.neighborhood.label} scores
        </h2>
        <p className="mt-0.5 text-secondary text-sm">
          Compared with other San Francisco neighborhoods, from public data. Tap a score's sources
          to see where it comes from.
        </p>
        <ScoreTiles data={data} className="mt-4" />
        <HowCalculated lines={data.howCalculated} computedAt={data.computedAt} />
      </Card>
      <NightFacts data={data} />
    </div>
  );
}

export type ScoresData = NonNullable<FunctionReturnType<typeof api.neighborhoodScores.get>>;

const TILE: Record<
  ScoresData["scores"][number]["kind"] | "fit",
  { title: string; icon: ReactNode }
> = {
  things_to_do: { title: "Things to do", icon: <Ticket size={18} aria-hidden /> },
  food: { title: "Food", icon: <UtensilsCrossed size={18} aria-hidden /> },
  transit: { title: "Transit", icon: <TrainFront size={18} aria-hidden /> },
  fit: { title: "Interest fit", icon: <Heart size={18} aria-hidden /> },
};

/** The four score tiles. A score the viewer can't see the sources of isn't shown. */
export function ScoreTiles({ data, className }: { data: ScoresData; className?: string }) {
  const fit = data.interestFit;
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {data.scores.map((s) =>
        s.state === "ok" ? (
          <Tile
            key={s.kind}
            {...TILE[s.kind]}
            score={s.score}
            label={s.label}
            detail={s.breakdown}
            sources={s.sources}
          />
        ) : (
          <Tile key={s.kind} {...TILE[s.kind]} detail="Not enough public data to score this yet." />
        ),
      )}
      {fit.state === "ok" ? (
        <Tile
          {...TILE.fit}
          personal
          score={fit.score}
          label={fitLabel(fit.score)}
          detail={fitDetail(fit.matched, fit.missing)}
          sources={fit.sources}
        />
      ) : (
        <Tile
          {...TILE.fit}
          personal
          detail={
            <>
              Add your interests to your{" "}
              <Link to="/landing/welcome" className="font-semibold text-link hover:underline">
                City Profile
              </Link>{" "}
              to see how this neighborhood fits you.
            </>
          }
        />
      )}
    </div>
  );
}

function Tile({
  title,
  icon,
  score,
  label,
  detail,
  sources,
  personal = false,
}: {
  title: string;
  icon: ReactNode;
  score?: number;
  label?: string;
  detail: ReactNode;
  sources?: readonly CitedSource[];
  personal?: boolean;
}) {
  const [first, ...rest] = sources ?? [];
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col rounded-lg border border-divider p-3"
    >
      <div className="flex items-center gap-2 text-secondary">
        {icon}
        <h3 className="font-semibold text-[15px] text-primary">{title}</h3>
        {personal && (
          <span className="ml-auto rounded-full bg-btn-soft px-2 py-0.5 font-semibold text-btn-soft-text text-xs">
            Just for you
          </span>
        )}
      </div>
      {score !== undefined ? (
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-bold text-[28px] text-primary leading-8">{score.toFixed(1)}</span>
          <span className="text-secondary text-sm">/ 10</span>
          {label && <span className="ml-1 font-semibold text-[15px] text-primary">{label}</span>}
        </p>
      ) : (
        <p className="mt-2 font-bold text-[28px] text-secondary leading-8">
          <span aria-hidden>–</span>
          <span className="sr-only">No score</span>
        </p>
      )}
      <p className="mt-1 flex-1 text-secondary text-sm leading-[18px]">{detail}</p>
      {first && (
        <div className="mt-2">
          <SourcesChip sources={[first, ...rest]} />
        </div>
      )}
    </section>
  );
}

function fitLabel(score: number) {
  return score >= 8
    ? "A great fit"
    : score >= 6
      ? "A good fit"
      : score >= 4
        ? "Some fit"
        : "Not much for you";
}

function fitDetail(matched: string[], missing: string[]) {
  const list = (xs: string[]) =>
    xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
  if (matched.length === 0) return `Nothing here yet for ${list(missing.slice(0, 3))}.`;
  const have = `${list(matched.slice(0, 4))} ${matched.length === 1 ? "has" : "have"} Groups, Events or places here.`;
  return missing.length ? `${have} Not yet: ${list(missing.slice(0, 3))}.` : have;
}

function HowCalculated({ lines, computedAt }: { lines: string[]; computedAt: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md py-1 font-semibold text-secondary text-sm hover:underline"
      >
        <Info size={16} aria-hidden />
        How this is calculated
        <ChevronDown
          size={16}
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 rounded-lg bg-wash p-3 text-primary text-sm leading-[18px]">
          {lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          {computedAt && (
            <p className="text-secondary text-xs">Updated {shortAge(computedAt)} ago, every day.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** "Getting around at night": cited facts and locals' words. Deliberately no score. */
export function NightFacts({ data }: { data: ScoresData }) {
  const { transit, streetlights, quotes } = data.night;
  if (!transit && !streetlights && quotes.length === 0) return null;
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-bold text-[20px] text-primary leading-6">
        <Moon size={20} aria-hidden />
        Getting around at night
      </h2>
      <p className="mt-0.5 text-secondary text-sm">
        Cited facts and what locals say. There's no safety score.
      </p>
      <div className="mt-3 space-y-4">
        {transit && (
          <NightRow
            icon={<TrainFront size={18} aria-hidden />}
            title="Late-night transit"
            sources={transit.sources}
          >
            {transit.allNight.length > 0 ? (
              <p>
                All-night Muni: <span className="font-semibold">{transit.allNight.join(", ")}</span>
              </p>
            ) : (
              <p>No all-night Muni lines stop here.</p>
            )}
            {transit.lastTrains.map((t) => (
              <p key={`${t.system}:${t.station}`}>
                Last {t.system === "bart" ? "BART" : "Caltrain"} departure from {t.station}:{" "}
                {lastTimes(t)}
              </p>
            ))}
          </NightRow>
        )}
        {streetlights && (
          <NightRow
            icon={<Lightbulb size={18} aria-hidden />}
            title="Street lighting"
            sources={streetlights.sources}
          >
            <p>
              {streetlights.count} streetlight repair{" "}
              {streetlights.count === 1 ? "request" : "requests"} to 311 since{" "}
              {new Date(streetlights.since).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              . These are reports, not confirmed outages.
            </p>
          </NightRow>
        )}
        {quotes.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-[15px] text-primary">
              <MessageCircle size={18} aria-hidden className="text-secondary" />
              What locals say
            </h3>
            <ul className="mt-1.5 space-y-2">
              {quotes.map((q) => (
                <Quote key={q.source.key} quote={q.quote} source={q.source} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function NightRow({
  icon,
  title,
  sources,
  children,
}: {
  icon: ReactNode;
  title: string;
  sources: readonly CitedSource[];
  children: ReactNode;
}) {
  const [first, ...rest] = sources;
  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold text-[15px] text-primary">
        <span className="text-secondary">{icon}</span>
        {title}
      </h3>
      <div className="mt-1 space-y-0.5 text-primary text-sm leading-[18px]">{children}</div>
      {first && (
        <div className="mt-1.5">
          <SourcesChip sources={[first, ...rest]} />
        </div>
      )}
    </div>
  );
}

function lastTimes(t: { weekday: string | null; saturday: string | null; sunday: string | null }) {
  if (t.weekday && t.weekday === t.saturday && t.weekday === t.sunday)
    return `${t.weekday} every day`;
  return [
    t.weekday && `${t.weekday} weekdays`,
    t.saturday && `${t.saturday} Saturdays`,
    t.sunday && `${t.sunday} Sundays`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** What a local said, with who said it and when, and the post or comment it's from. */
function Quote({ quote, source }: { quote: string; source: CitedSource }) {
  const who = source.kind === "post" || source.kind === "comment" ? source.author.firstName : null;
  const when = "createdAt" in source ? shortAge(source.createdAt) : null;
  return (
    <li className="rounded-lg bg-wash px-3 py-2">
      <p className="text-primary text-sm leading-[18px]">“{quote}”</p>
      <div className="mt-1 flex items-center gap-2 text-secondary text-xs">
        {who && <span>{who}</span>}
        {when && <span>· {when}</span>}
        <span className="ml-auto">
          <SourcesChip sources={[source]} label="Source" />
        </span>
      </div>
    </li>
  );
}

function ScoresSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </Card>
  );
}

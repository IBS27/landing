import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeftRight,
  ChevronRight,
  Heart,
  Moon,
  Route,
  Sparkles,
  TrainFront,
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CitedSource } from "../../../convex/lib/citations";
import type { NeighborhoodSlug } from "../../../convex/lib/cityProfileFacts";
import {
  type AnswerLine,
  BY_SLUG,
  CLOSE,
  type CompareProfile,
  type CompareSide,
  compareAnswer,
  HOODS,
  type Hood,
  inSentence,
  isNeighborhoodSlug,
  namedNeighborhoods,
} from "./compare";
import {
  fitDetail,
  fitLabel,
  HowCalculated,
  NightFacts,
  type ScoresData,
  TILE,
} from "./NeighborhoodScores";
import { ForYouSection, SkipsProvider } from "./sections";
import { useWeekendRoute, WeekendRouteCard } from "./WeekendRoute";

/**
 * `/landing/find/neighborhoods/compare?a=&b=`: "Try the neighborhood" (#19).
 * Ask "What's my Saturday like in the Mission vs the Inner Sunset?" (or pick
 * two) and get both side by side: a personal answer from the City Profile,
 * the scores (#17), each Weekend Route (#18), "For you" picks (#16) and
 * getting around at night. Works without AI: the question is read by code.
 */

const EXAMPLE = "What's my Saturday like in the Mission vs the Inner Sunset?";

export function ComparePage({ a, b }: { a?: NeighborhoodSlug; b?: NeighborhoodSlug }) {
  const hoodA = a ? BY_SLUG.get(a) : undefined;
  const hoodB = b ? BY_SLUG.get(b) : undefined;
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-12 lg:px-8">
      <Crumbs />
      <header className="mb-4">
        <h1 className="font-bold text-[28px] text-primary leading-8 tracking-[-0.01em]">
          Try the neighborhood
        </h1>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          Compare two neighborhoods side by side: a Saturday on each one's Weekend Route, their
          scores, and what fits you.
        </p>
      </header>
      <Ask a={hoodA} b={hoodB} />
      {hoodA && hoodB ? (
        <SkipsProvider>
          <Comparison key={`${hoodA.slug}:${hoodB.slug}`} a={hoodA} b={hoodB} />
        </SkipsProvider>
      ) : (
        <Suggestions a={hoodA} b={hoodB} />
      )}
    </div>
  );
}

function Crumbs() {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[13px] leading-4">
      <Link to="/landing/find" className="text-secondary hover:underline">
        Find
      </Link>
      <ChevronRight size={14} className="text-secondary" aria-hidden />
      <Link to="/landing/find/neighborhoods" className="text-secondary hover:underline">
        Neighborhoods
      </Link>
      <ChevronRight size={14} className="text-secondary" aria-hidden />
      <span aria-current="page" className="font-semibold text-primary">
        Compare
      </span>
    </nav>
  );
}

/* ───────────── Asking ───────────── */

function useCompareNavigate() {
  const navigate = useNavigate();
  return (a: NeighborhoodSlug | undefined, b: NeighborhoodSlug | undefined) =>
    navigate({
      to: "/landing/find/neighborhoods/compare",
      search: { a, b: b === a ? undefined : b },
    });
}

/** The question box and the two pickers. */
function Ask({ a, b }: { a?: Hood; b?: Hood }) {
  const go = useCompareNavigate();
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function ask(e: FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    const named = namedNeighborhoods(text);
    const [x, y] = named;
    if (x && y) {
      setNote(
        named.length > 2 ? `Comparing the first two you named: ${label(x)} and ${label(y)}.` : null,
      );
      void go(x, y);
    } else if (x) {
      const other = a && a.slug !== x ? a.slug : b && b.slug !== x ? b.slug : undefined;
      setNote(other ? null : `Pick a second neighborhood to compare with ${label(x)}.`);
      void go(x, other);
    } else {
      setNote(
        "We couldn't find a San Francisco neighborhood in that. Try “the Mission vs the Inner Sunset”, or pick two below.",
      );
    }
  }

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-input px-4 focus-within:ring-2 focus-within:ring-accent">
          <Sparkles size={16} className="shrink-0 text-secondary" aria-hidden />
          <span className="sr-only">Ask about two neighborhoods</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setNote(null);
            }}
            placeholder={EXAMPLE}
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-secondary"
          />
        </label>
        <Button type="submit" variant="primary" disabled={!q.trim()}>
          Compare
        </Button>
      </form>
      {note && (
        <p role="status" className="mt-2 text-secondary text-sm">
          {note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Picker
          label="First neighborhood"
          value={a?.slug}
          other={b?.slug}
          onChange={(s) => {
            setNote(null);
            void go(s, b?.slug);
          }}
        />
        <button
          type="button"
          aria-label="Swap the two neighborhoods"
          disabled={!a && !b}
          onClick={() => void go(b?.slug, a?.slug)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover disabled:opacity-40"
        >
          <ArrowLeftRight size={16} aria-hidden />
        </button>
        <Picker
          label="Second neighborhood"
          value={b?.slug}
          other={a?.slug}
          onChange={(s) => {
            setNote(null);
            void go(a?.slug, s);
          }}
        />
      </div>
    </Card>
  );
}

function label(slug: NeighborhoodSlug) {
  return BY_SLUG.get(slug)?.label ?? slug;
}

function Picker({
  label: aria,
  value,
  other,
  onChange,
}: {
  label: string;
  value: NeighborhoodSlug | undefined;
  other: NeighborhoodSlug | undefined;
  onChange: (slug: NeighborhoodSlug | undefined) => void;
}) {
  return (
    <select
      aria-label={aria}
      value={value ?? ""}
      onChange={(e) => onChange(isNeighborhoodSlug(e.target.value) ? e.target.value : undefined)}
      className="h-8 min-w-0 max-w-[calc(50%-24px)] flex-1 rounded-full bg-btn px-3 font-semibold text-[13px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent sm:max-w-[240px]"
    >
      <option value="">Pick a neighborhood</option>
      {HOODS.map((n) => (
        <option key={n.slug} value={n.slug} disabled={n.slug === other}>
          {n.label}
        </option>
      ))}
    </select>
  );
}

/** Before two are picked: pairs to try, the viewer's own neighborhoods first. */
function Suggestions({ a, b }: { a?: Hood; b?: Hood }) {
  const profile = useQ(api.cityProfile.get, {});
  const go = useCompareNavigate();
  const yours = (profile?.neighborhoods ?? [])
    .map((f) => f.value.slug)
    .filter((s, i, all) => all.indexOf(s) === i);
  const picked = a ?? b;
  const pairs: [NeighborhoodSlug, NeighborhoodSlug][] = picked
    ? [...yours, "mission", "inner-sunset", "hayes-valley", "north-beach"]
        .filter((s): s is NeighborhoodSlug => s !== picked.slug)
        .filter((s, i, all) => all.indexOf(s) === i)
        .slice(0, 3)
        .map((s) => [picked.slug, s])
    : [
        ...(yours.length >= 2
          ? ([[yours[0], yours[1]]] as [NeighborhoodSlug, NeighborhoodSlug][])
          : []),
        ["mission", "inner-sunset"],
        ["hayes-valley", "north-beach"],
        ["noe-valley", "inner-richmond"],
      ];
  const unique = pairs
    .filter(([x, y], i) => pairs.findIndex(([p, q]) => p === x && q === y) === i)
    .slice(0, 3);
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-btn-soft text-btn-soft-text">
        <ArrowLeftRight size={22} aria-hidden />
      </span>
      <h2 className="mt-3 font-bold text-[20px] text-primary leading-6">
        {picked ? `Compare ${picked.label} with…` : "Pick two neighborhoods"}
      </h2>
      <p className="mt-1 max-w-[440px] text-[15px] text-secondary leading-5">
        Ask a question above, pick two, or start with one of these.
        {yours.length > 0 && !picked && " Neighborhoods from your City Profile come first."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {unique.map(([x, y]) => (
          <Button key={`${x}:${y}`} variant="soft" size="sm" onClick={() => void go(x, y)}>
            {label(x)} vs {label(y)}
          </Button>
        ))}
      </div>
    </Card>
  );
}

/* ───────────── The comparison ───────────── */

type Loaded = {
  hood: Hood;
  id: Id<"neighborhoods"> | undefined;
  scores: ScoresData | null | undefined;
  route: ReturnType<typeof useWeekendRoute>;
  page: ReturnType<typeof usePage>;
};

function usePage(slug: NeighborhoodSlug) {
  return useQ(api.neighborhoods.page, { slug });
}

function useSide(hood: Hood, ids: ReadonlyMap<string, Id<"neighborhoods">> | undefined): Loaded {
  const id = ids?.get(hood.slug);
  const scores = useQ(api.neighborhoodScores.get, id ? { neighborhoodId: id } : "skip");
  const route = useWeekendRoute(id);
  const page = usePage(hood.slug);
  return { hood, id, scores, route, page };
}

/** The stops the answer reads: undefined while the route loads or is being planned. */
function stopsOf(route: Loaded["route"]): CompareSide["stops"] {
  if (route === undefined) return undefined;
  if (route.route && route.route.stops.length > 0) return route.route.stops;
  return route.building ? undefined : null;
}

function Comparison({ a, b }: { a: Hood; b: Hood }) {
  const list = useQ(api.neighborhoods.list, {});
  const ids = useMemo(
    () => (list ? new Map(list.map((n) => [n.slug, n._id] as const)) : undefined),
    [list],
  );
  const A = useSide(a, ids);
  const B = useSide(b, ids);
  const profile = useQ(api.cityProfile.get, {});
  const yours = new Set((profile?.neighborhoods ?? []).map((f) => f.value.slug as string));
  const sides = [A, B] as const;

  if (ids && (!A.id || !B.id)) return <Missing />;

  return (
    <div className="flex flex-col gap-4">
      <Answer a={A} b={B} profile={profile} />
      <ScoreTable a={A} b={B} yours={yours} />
      <Row
        title="Your Saturday"
        sub="Each neighborhood's Weekend Route: what locals agree on, morning to night."
        icon={<Route size={20} aria-hidden />}
      >
        {sides.map((s) => (
          <Cell key={s.hood.slug} hood={s.hood}>
            <WeekendRouteCard data={s.route} />
          </Cell>
        ))}
      </Row>
      <Row label="For you">
        {sides.map((s) => (
          <Cell key={s.hood.slug} hood={s.hood}>
            {s.page === undefined ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : s.page === null ? null : (
              <ForYouSection forYou={s.page.forYou} label={s.page.neighborhood.label} />
            )}
          </Cell>
        ))}
      </Row>
      <Row label="Getting around at night">
        {sides.map((s) => (
          <Cell key={s.hood.slug} hood={s.hood}>
            {s.scores === undefined ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : s.scores && hasNight(s.scores) ? (
              <NightFacts data={s.scores} />
            ) : (
              <Card className="p-4 text-secondary text-sm">
                No late-night facts for {inSentence(s.hood)} yet.
              </Card>
            )}
          </Cell>
        ))}
      </Row>
    </div>
  );
}

function hasNight(d: ScoresData) {
  const { transit, streetlights, quotes } = d.night;
  return Boolean(transit || streetlights || quotes.length > 0);
}

function Missing() {
  return (
    <Card className="px-6 py-10 text-center text-[15px] text-secondary">
      We couldn't load one of these neighborhoods. Pick another above.
    </Card>
  );
}

/**
 * Two side-by-side cells (stacked on narrow screens), under a heading when the
 * cards don't carry their own (`label` names the row for screen readers).
 */
function Row({
  title,
  sub,
  icon,
  label,
  children,
}: {
  title?: string;
  sub?: string;
  icon?: ReactNode;
  label?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title ?? label}>
      {title && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-secondary">{icon}</span>
          <div className="min-w-0">
            <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
            {sub && <p className="text-secondary text-sm leading-[18px]">{sub}</p>}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Cell({ hood, children }: { hood: Hood; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Link
        to="/landing/find/neighborhoods/$slug"
        params={{ slug: hood.slug }}
        className="mb-1.5 inline-block px-1 font-semibold text-[15px] text-primary hover:underline"
      >
        {hood.label}
      </Link>
      {children}
    </div>
  );
}

/* ───────────── The answer ───────────── */

const LINE_ICON: Record<AnswerLine["key"], ReactNode> = {
  interests: <Heart size={16} aria-hidden />,
  route: <Route size={16} aria-hidden />,
  scores: <Sparkles size={16} aria-hidden />,
  transit: <TrainFront size={16} aria-hidden />,
  night: <Moon size={16} aria-hidden />,
};

type CityProfile = FunctionReturnType<typeof api.cityProfile.get>;

/** What the answer reads from the City Profile besides interests (the scores carry those). */
function toProfile(p: CityProfile): CompareProfile {
  return {
    transport: p.transport?.value.modes ?? [],
    workHours: p.schedule?.value.workHours ?? null,
  };
}

function Answer({ a, b, profile }: { a: Loaded; b: Loaded; profile: CityProfile | undefined }) {
  if (a.scores === undefined || b.scores === undefined || profile === undefined)
    return (
      <Card className="space-y-3 p-4" aria-busy>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </Card>
    );
  const side = (s: Loaded): CompareSide => ({
    slug: s.hood.slug,
    label: s.hood.label,
    scores: s.scores ?? null,
    stops: stopsOf(s.route),
  });
  const answer = compareAnswer(side(a), side(b), toProfile(profile));
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">
        Your Saturday: {a.hood.label} vs {b.hood.label}
      </h2>
      {answer.lead ? (
        <p className="mt-1 font-semibold text-[17px] text-primary leading-[22px]">{answer.lead}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3 rounded-lg bg-comment p-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-[15px] text-primary leading-5">
            Add your interests to your City Profile to see which neighborhood fits you, and which
            Weekend Route stops are your kind of thing.
          </p>
          <Link
            to="/landing/welcome"
            className="flex h-9 shrink-0 items-center justify-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white transition-colors hover:bg-btn-primary-hover"
          >
            Set up your City Profile
          </Link>
        </div>
      )}
      {answer.lines.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {answer.lines.map((l) => (
            <li key={l.key} className="flex gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-btn text-secondary">
                {LINE_ICON[l.key]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-primary leading-5">{l.text}</p>
                <Sources sources={l.sources} className="mt-1" />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-secondary text-xs">
        {answer.lead
          ? "Written from the data below and your City Profile, without AI."
          : "Written from the data below, without AI."}
      </p>
    </Card>
  );
}

function Sources({ sources, className }: { sources: CitedSource[]; className?: string }) {
  const [first, ...rest] = sources;
  if (!first) return null;
  return <SourcesChip sources={[first, ...rest]} className={className} />;
}

/* ───────────── Scores side by side ───────────── */

const KINDS = ["things_to_do", "food", "transit"] as const;

type CellScore =
  | { state: "ok"; score: number; label: string; detail: string; sources: CitedSource[] }
  | { state: "none"; detail: ReactNode }
  | { state: "loading" };

function cellFor(s: Loaded, kind: (typeof KINDS)[number] | "fit"): CellScore {
  if (s.scores === undefined) return { state: "loading" };
  if (s.scores === null) return { state: "none", detail: "Not available." };
  if (kind === "fit") {
    const f = s.scores.interestFit;
    if (f.state !== "ok")
      return {
        state: "none",
        detail: (
          <>
            Add your interests to your{" "}
            <Link to="/landing/welcome" className="font-semibold text-link hover:underline">
              City Profile
            </Link>
            .
          </>
        ),
      };
    return {
      state: "ok",
      score: f.score,
      label: fitLabel(f.score),
      detail: fitDetail(f.matched, f.missing),
      sources: f.sources,
    };
  }
  const x = s.scores.scores.find((r) => r.kind === kind);
  if (x?.state !== "ok")
    return { state: "none", detail: "Not enough public data to score this yet." };
  return {
    state: "ok",
    score: x.score,
    label: x.label,
    detail: x.breakdown,
    sources: [...x.sources],
  };
}

function ScoreTable({ a, b, yours }: { a: Loaded; b: Loaded; yours: ReadonlySet<string> }) {
  const rows = [...KINDS, "fit"] as const;
  const how = a.scores ?? b.scores;
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">Scores side by side</h2>
      <p className="mt-0.5 text-secondary text-sm">
        Compared with other San Francisco neighborhoods, from public data. Interest fit is just for
        you.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 border-divider border-b pb-2">
        {[a, b].map((s) => (
          <div key={s.hood.slug} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to="/landing/find/neighborhoods/$slug"
              params={{ slug: s.hood.slug }}
              className="truncate font-bold text-[17px] text-primary hover:underline"
            >
              {s.hood.label}
            </Link>
            {yours.has(s.hood.slug) && (
              <span className="rounded-full bg-btn-soft px-2 py-0.5 font-semibold text-btn-soft-text text-xs">
                On your list
              </span>
            )}
          </div>
        ))}
      </div>
      {rows.map((kind) => {
        const ca = cellFor(a, kind);
        const cb = cellFor(b, kind);
        const higher =
          ca.state === "ok" && cb.state === "ok" && Math.abs(ca.score - cb.score) >= CLOSE
            ? ca.score > cb.score
              ? 0
              : 1
            : null;
        const t = TILE[kind];
        return (
          <section
            key={kind}
            aria-label={t.title}
            className="border-divider border-b py-3 last:border-b-0"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-[15px] text-primary">
              <span className="text-secondary">{t.icon}</span>
              {t.title}
              {kind === "fit" && (
                <span className="rounded-full bg-btn-soft px-2 py-0.5 font-semibold text-btn-soft-text text-xs">
                  Just for you
                </span>
              )}
            </h3>
            <div className="grid grid-cols-2 gap-x-3">
              {[ca, cb].map((c, i) => (
                <ScoreCell
                  key={i === 0 ? a.hood.slug : b.hood.slug}
                  cell={c}
                  higher={higher === i}
                  where={i === 0 ? a.hood.label : b.hood.label}
                />
              ))}
            </div>
          </section>
        );
      })}
      {how && <HowCalculated lines={how.howCalculated} computedAt={how.computedAt} />}
    </Card>
  );
}

function ScoreCell({ cell, higher, where }: { cell: CellScore; higher: boolean; where: string }) {
  if (cell.state === "loading") return <Skeleton className="h-16 rounded-lg" />;
  return (
    <div className="min-w-0">
      <span className="sr-only">{where}: </span>
      {cell.state === "ok" ? (
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={cn(
              "font-bold text-[24px] leading-7",
              higher ? "text-accent" : "text-primary",
            )}
          >
            {cell.score.toFixed(1)}
          </span>
          <span className="text-secondary text-sm">/ 10</span>
          <span className="font-semibold text-[15px] text-primary">{cell.label}</span>
          {higher && <span className="sr-only">(higher)</span>}
        </p>
      ) : (
        <p className="font-bold text-[24px] text-secondary leading-7">
          <span aria-hidden>–</span>
          <span className="sr-only">No score</span>
        </p>
      )}
      <p className="mt-0.5 text-secondary text-sm leading-[18px]">{cell.detail}</p>
      {cell.state === "ok" && <Sources sources={cell.sources} className="mt-1.5" />}
    </div>
  );
}

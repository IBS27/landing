import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarDays,
  Check,
  MessageSquare,
  Pencil,
  Sparkles,
  Tag,
  UsersRound,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM } from "@/app/viewer";
import { toEvent, toGroup, toListing, toMyPlace, toPost } from "@/landing/links";
import { Button, Card, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  FACT_KEY_LABELS,
  type FactEntry,
  type FactKey,
  factLabel,
  GOALS,
} from "../../../convex/lib/cityProfileFacts";
import { getInterest } from "../../../convex/lib/interests";
import type { EvidenceLink } from "../../../convex/lib/museKnows";
import type { SignalKind } from "../../../convex/lib/profileSignals";
import { briefAnchor } from "./CityBrief";
import { confidenceText } from "./FactChip";

type Known = FunctionReturnType<typeof api.museKnows.facts>;
type KnownFact = Known["facts"][number];
type RemovedFact = Known["removed"][number];

/** Profile order: the brief's single answers, then the lists. */
const KEYS: readonly FactKey[] = [
  "budget",
  "moveIn",
  "home",
  "transport",
  "schedule",
  "employer",
  "neighborhood",
  "interest",
  "goal",
];

function display(f: FactEntry): { emoji?: string; text: string } {
  if (f.key === "interest") {
    const i = getInterest(f.value.id);
    return { emoji: i.emoji, text: i.label };
  }
  if (f.key === "goal") {
    const g = GOALS.find((x) => x.id === f.value.id);
    return { emoji: g?.emoji, text: factLabel(f) };
  }
  return { text: factLabel(f) };
}

/**
 * "What Muse knows about you" (#5): every City Profile fact with where it came
 * from. Inferred facts can be kept (they become stated) or removed (never
 * inferred again); stated ones are removed here or changed in the brief.
 */
export function KnownFacts({ known }: { known: Known }) {
  const confirm = useM(api.museKnows.confirmFact);
  const remove = useM(api.museKnows.removeFact);
  const restore = useM(api.museKnows.restoreFact);
  const [busy, setBusy] = useState<Id<"cityProfileFacts"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (
    factId: Id<"cityProfileFacts">,
    fn: (a: { factId: Id<"cityProfileFacts"> }) => Promise<unknown>,
    failed: string,
  ) => {
    setBusy(factId);
    setError(null);
    fn({ factId })
      .catch(() => setError(failed))
      .finally(() => setBusy(null));
  };
  const actions: FactActions = {
    busy,
    keep: (id) => run(id, confirm, "Couldn't keep that. Try again."),
    remove: (id) => run(id, remove, "Couldn't remove that. Try again."),
    restore: (id) => run(id, restore, "Couldn't undo that. Try again."),
  };
  const inferred = known.facts.filter((f) => f.source === "inferred").length;
  const onboarded = known.briefCompletedAt !== null;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <h2 className="font-bold text-[17px] text-primary leading-[22px]">Your City Profile</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-4">
          {inferred > 0
            ? `Muse inferred ${inferred === 1 ? "1 of these" : `${inferred} of these`} from your activity. Keep what's right and remove the rest.`
            : "Everything here is something you told Landing."}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-negative">
            {error}
          </p>
        )}
      </div>
      <div className="divide-y divide-divider-soft">
        {KEYS.map((key) => (
          <FactSection
            key={key}
            factKey={key}
            facts={known.facts.filter((f) => f.key === key)}
            onboarded={onboarded}
            actions={actions}
          />
        ))}
      </div>
      {known.removed.length > 0 && <RemovedList removed={known.removed} actions={actions} />}
    </Card>
  );
}

type FactActions = {
  busy: Id<"cityProfileFacts"> | null;
  keep: (id: Id<"cityProfileFacts">) => void;
  remove: (id: Id<"cityProfileFacts">) => void;
  restore: (id: Id<"cityProfileFacts">) => void;
};

function FactSection({
  factKey,
  facts,
  onboarded,
  actions,
}: {
  factKey: FactKey;
  facts: KnownFact[];
  onboarded: boolean;
  actions: FactActions;
}) {
  const title = FACT_KEY_LABELS[factKey];
  const headingId = `known-${factKey}`;
  return (
    <section aria-labelledby={headingId} className="px-4 py-2 sm:flex sm:gap-4">
      <div className="flex items-center justify-between gap-3 sm:w-36 sm:shrink-0 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:pt-2">
        <h3 id={headingId} className="font-semibold text-[15px] text-primary leading-5">
          {title}
        </h3>
        {factKey === "home" ? (
          // Where they live comes from their place, so it's changed on My Place.
          <Link {...toMyPlace()} aria-label={`Edit ${title} on My Place`} className={editLink}>
            <Pencil size={14} aria-hidden />
            Edit
          </Link>
        ) : (
          <Link
            to="/landing/welcome"
            search={onboarded ? { edit: true } : {}}
            hash={briefAnchor(factKey)}
            aria-label={`Edit ${title} in your brief`}
            className={editLink}
          >
            <Pencil size={14} aria-hidden />
            Edit
          </Link>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {facts.length === 0 ? (
          <p className="pb-2 text-[13px] text-secondary sm:pt-2">Not set</p>
        ) : (
          <ul className="flex flex-col">
            {facts.map((f) => (
              <FactRow key={f._id} fact={f} actions={actions} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const editLink =
  "-mr-2 sm:-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-semibold text-[13px] text-secondary hover:bg-hover sm:mr-0 sm:h-7";

function FactRow({ fact: f, actions }: { fact: KnownFact; actions: FactActions }) {
  const { emoji, text } = display(f);
  const busy = actions.busy === f._id;
  return (
    <li className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-primary leading-5">
          {emoji && (
            <span aria-hidden className="mr-1.5">
              {emoji}
            </span>
          )}
          {text}
        </p>
        <Provenance fact={f} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {f.source === "inferred" && (
          <Button
            size="sm"
            variant="soft"
            icon={<Check size={16} aria-hidden />}
            aria-label={`Keep ${text}`}
            disabled={busy}
            onClick={() => actions.keep(f._id)}
            className="max-sm:w-8 max-sm:px-0"
          >
            <span className="max-sm:hidden">Keep</span>
          </Button>
        )}
        <IconButton
          size={32}
          variant="ghost"
          label={`Remove ${text}`}
          disabled={busy}
          onClick={() => actions.remove(f._id)}
        >
          <X size={18} className="text-secondary" />
        </IconButton>
      </div>
    </li>
  );
}

/** Where a fact came from: the brief, the person's own words, a confirmation, or activity with its links. */
function Provenance({ fact: f }: { fact: KnownFact }) {
  const line = "mt-0.5 text-[13px] text-secondary leading-4";
  if (f.source === "inferred")
    return (
      <div className={line}>
        <p>
          <span className="font-semibold">
            <Sparkles size={12} aria-hidden className="mr-1 inline align-[-1px]" />
            Inferred
          </span>{" "}
          · {confidenceText(f.confidence)} · {f.evidence.summary}
        </p>
        {f.evidenceLinks && (
          <EvidenceLinks links={f.evidenceLinks.links} unavailable={f.evidenceLinks.unavailable} />
        )}
      </div>
    );
  if (f.evidence.kind === "free_text" && f.evidence.quote)
    return (
      <p className={line}>
        From your words: <q className="text-primary italic">{f.evidence.quote}</q>
      </p>
    );
  if (f.evidence.kind === "place")
    return (
      <p className={line}>
        From{" "}
        <Link {...toMyPlace()} className="font-semibold text-primary hover:underline">
          your place
        </Link>
      </p>
    );
  return <p className={line}>{f.evidence.summary}</p>;
}

const SHOWN = 4;

const VERB: Record<SignalKind, string> = {
  going: "Going",
  interested: "Interested",
  join: "Joined",
  like: "Liked",
  save: "Saved",
  skip: "Not for me",
};

/** The Events, Groups, posts and listings behind an inferred fact, each linking to its page. */
function EvidenceLinks({ links, unavailable }: { links: EvidenceLink[]; unavailable: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? links : links.slice(0, SHOWN);
  const more = links.length - shown.length;
  if (links.length === 0 && unavailable === 0) return null;
  return (
    <ul aria-label="Based on" className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {shown.map((l) => (
        <li key={linkKey(l)} className="min-w-0 max-w-full">
          <EvidenceChip link={l} />
        </li>
      ))}
      {more > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setAll(true)}
            className="font-semibold text-[13px] text-link hover:underline"
          >
            {more} more
          </button>
        </li>
      )}
      {unavailable > 0 && (
        <li>
          {links.length > 0 ? `+${unavailable} ` : `${unavailable} `}
          {unavailable === 1 ? "isn't" : "aren't"} available to you now
        </li>
      )}
    </ul>
  );
}

function linkKey(l: EvidenceLink) {
  switch (l.kind) {
    case "event":
      return l.eventId;
    case "group":
      return l.slug;
    case "post":
      return l.postId;
    case "listing":
      return l.listingId;
  }
}

const CHIP =
  "inline-flex max-w-full items-center gap-1 text-[13px] text-primary leading-5 hover:underline [&>svg]:text-secondary";

function EvidenceChip({ link: l }: { link: EvidenceLink }) {
  const body = (icon: ReactNode, text: string) => (
    <>
      {icon}
      <span className="truncate">{text}</span>
    </>
  );
  const label = (text: string) => `${VERB[l.signal]}: ${text}`;
  switch (l.kind) {
    case "event":
      return (
        <Link {...toEvent(l.eventId)} className={CHIP} aria-label={label(l.title)}>
          {body(<CalendarDays size={14} aria-hidden className="shrink-0" />, l.title)}
        </Link>
      );
    case "group":
      return (
        <Link {...toGroup({ slug: l.slug })} className={CHIP} aria-label={label(l.name)}>
          {body(<UsersRound size={14} aria-hidden className="shrink-0" />, l.name)}
        </Link>
      );
    case "post":
      return (
        <Link {...toPost(l)} className={CHIP} aria-label={label(l.label)}>
          {body(<MessageSquare size={14} aria-hidden className="shrink-0" />, l.label)}
        </Link>
      );
    case "listing":
      return (
        <Link {...toListing(l.listingId)} className={CHIP} aria-label={label(l.title)}>
          {body(<Tag size={14} aria-hidden className="shrink-0" />, l.title)}
        </Link>
      );
  }
}

/** Facts the person removed: Muse won't infer them again unless they undo it. */
function RemovedList({ removed, actions }: { removed: RemovedFact[]; actions: FactActions }) {
  return (
    <section aria-labelledby="known-removed" className="border-divider border-t px-4 py-3">
      <h3 id="known-removed" className="font-semibold text-[15px] text-primary leading-5">
        Removed
      </h3>
      <p className="mt-0.5 text-[13px] text-secondary leading-4">
        Muse won't add these back from your activity.
      </p>
      <ul className="mt-1 flex flex-col">
        {removed.map((f) => {
          const { emoji, text } = display(f);
          return (
            <li key={f._id} className="flex items-center gap-3 py-1.5">
              <p className="min-w-0 flex-1 text-[15px] text-secondary leading-5">
                {emoji && (
                  <span aria-hidden className="mr-1.5 opacity-60">
                    {emoji}
                  </span>
                )}
                {FACT_KEY_LABELS[f.key]}: {text}
                <span className="ml-1.5 text-[13px]">
                  · {f.source === "inferred" ? "was inferred" : "you said"}
                </span>
              </p>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${f.source === "inferred" ? "Allow again" : "Undo"}: ${text}`}
                disabled={actions.busy === f._id}
                onClick={() => actions.restore(f._id)}
              >
                {f.source === "inferred" ? "Allow again" : "Undo"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

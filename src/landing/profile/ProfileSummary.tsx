import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";
import {
  budgetLabel,
  FACT_KEY_LABELS,
  type FactKey,
  goalLabel,
  moveInLabel,
  neighborhoodLabel,
  scheduleLabel,
  transportLabel,
} from "../../../convex/lib/cityProfileFacts";
import { getInterest } from "../../../convex/lib/interests";
import type { CityProfile } from "./briefState";
import { SourceBadge } from "./FactChip";

type AnyFact = CityProfile["facts"][number];

/** Plain "you said it in the brief" facts go unmarked; anything else shows its source. */
function marked(f: AnyFact) {
  return f.source === "inferred" || f.evidence.kind !== "brief";
}

/**
 * Read-only view of a City Profile: every fact with where it came from.
 * Landing's Profile section and "What Muse knows about you" (#5) build on it.
 */
export function ProfileSummary({
  profile,
  action,
  showHeader = true,
}: {
  profile: CityProfile;
  /** Header action, e.g. an "Edit brief" button. */
  action?: ReactNode;
  /** Off when the page already has a title (Landing → City Profile). */
  showHeader?: boolean;
}) {
  const statedInterests = profile.interests.filter((f) => f.source === "stated");
  const inferredInterests = profile.interests.filter((f) => f.source === "inferred");
  return (
    <Card className="overflow-hidden">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <h2 className="font-bold text-[20px] text-primary leading-6">Your City Profile</h2>
            <p className="text-[13px] text-secondary">
              What Landing uses to tune search, neighborhoods and crews. Only you can see it.
              Everything comes from your brief unless it's marked.
            </p>
          </div>
          {action}
        </div>
      ) : (
        <p className="px-4 pt-3 text-[13px] text-secondary">
          Everything comes from your brief unless it's marked.
        </p>
      )}
      <dl className="divide-y divide-divider px-4 pb-2">
        <Row k="budget" fact={profile.budget}>
          {profile.budget && budgetLabel(profile.budget.value)}
        </Row>
        <Row k="moveIn" fact={profile.moveIn}>
          {profile.moveIn && moveInLabel(profile.moveIn.value)}
        </Row>
        {profile.home && (
          <Row k="home" fact={profile.home}>
            {neighborhoodLabel(profile.home.value.slug)}
          </Row>
        )}
        <ListRow k="neighborhood" facts={profile.neighborhoods}>
          {(f) => neighborhoodLabel(f.value.slug)}
        </ListRow>
        <Row k="transport" fact={profile.transport}>
          {profile.transport && transportLabel(profile.transport.value)}
        </Row>
        <Row k="schedule" fact={profile.schedule}>
          {profile.schedule && scheduleLabel(profile.schedule.value)}
        </Row>
        {profile.employer && (
          <Row k="employer" fact={profile.employer}>
            {profile.employer.value.workArea
              ? `${profile.employer.value.name} · ${profile.employer.value.workArea}`
              : profile.employer.value.name}
          </Row>
        )}
        <ListRow k="interest" facts={statedInterests}>
          {(f) => {
            const i = getInterest(f.value.id);
            return `${i.emoji} ${i.label}`;
          }}
        </ListRow>
        <ListRow k="goal" facts={profile.goals}>
          {(f) => goalLabel(f.value.id)}
        </ListRow>
        {inferredInterests.length > 0 && (
          <div className="py-3">
            <dt className="font-semibold text-[15px] text-primary">Muse also noticed</dt>
            <dd className="mt-2 flex flex-col gap-2">
              {inferredInterests.map((f) => {
                const i = getInterest(f.value.id);
                return (
                  <div key={f._id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] text-primary">
                        <span aria-hidden className="mr-1.5">
                          {i.emoji}
                        </span>
                        {i.label}
                      </p>
                      <p className="text-[13px] text-secondary">{f.evidence.summary}</p>
                    </div>
                    <SourceBadge
                      source={f.source}
                      evidence={f.evidence}
                      confidence={f.confidence}
                    />
                  </div>
                );
              })}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

function Row({ k, fact, children }: { k: FactKey; fact: AnyFact | null; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="w-32 shrink-0 font-semibold text-[15px] text-primary">{FACT_KEY_LABELS[k]}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-right text-[15px] text-primary">
        {fact ? (
          <>
            <span>{children}</span>
            {marked(fact) && (
              <SourceBadge
                source={fact.source}
                evidence={fact.evidence}
                confidence={fact.confidence}
              />
            )}
          </>
        ) : (
          <span className="text-secondary">Not set</span>
        )}
      </dd>
    </div>
  );
}

function ListRow<F extends AnyFact>({
  k,
  facts,
  children,
}: {
  k: FactKey;
  facts: F[];
  children: (f: F) => ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="w-32 shrink-0 font-semibold text-[15px] text-primary">{FACT_KEY_LABELS[k]}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
        {facts.length === 0 ? (
          <span className="text-[15px] text-secondary">Not set</span>
        ) : (
          facts.map((f) => (
            <span
              key={f._id}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full bg-btn pl-3 text-[15px] text-primary",
                marked(f) ? "pr-1" : "pr-3",
              )}
            >
              {children(f)}
              {marked(f) && (
                <SourceBadge source={f.source} evidence={f.evidence} confidence={f.confidence} />
              )}
            </span>
          ))
        )}
      </dd>
    </div>
  );
}

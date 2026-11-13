import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useQ } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { PrivacyNote } from "./CityBrief";
import { HiddenCards } from "./HiddenCards";
import { KnownFacts } from "./KnownFacts";
import { LearnFromActivity } from "./LearnFromActivity";
import { OtherData } from "./OtherData";

/**
 * Landing → City Profile (`/landing/profile`): "What Muse knows about you" (#5).
 * Every fact with where it came from, what's recorded from activity, and the
 * other data Muse reads, each with a way to change or clear it.
 */
export function CityProfilePage() {
  const known = useQ(api.museKnows.facts, {});
  const onboarded = Boolean(known?.briefCompletedAt);
  return (
    <LandingPage
      title="What Muse knows about you"
      description="Everything Landing uses to tune search, neighborhoods and crews, where each piece came from, and how to change it. Only you can see it."
      actions={
        onboarded ? (
          <Link
            to="/landing/welcome"
            search={{ edit: true }}
            className="flex h-9 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
          >
            <Pencil size={16} />
            Edit brief
          </Link>
        ) : undefined
      }
    >
      <div className="max-w-[720px]">
        {known === undefined ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!onboarded && (
              <Card className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-[17px] text-primary leading-5">
                    You haven't set up your City Profile yet
                  </h2>
                  <p className="mt-0.5 text-[15px] text-secondary leading-5">
                    A two-minute brief: budget, move-in, how you get around and what you're into.
                  </p>
                </div>
                <Link
                  to="/landing/welcome"
                  className="flex h-9 shrink-0 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
                >
                  Set up your City Profile
                </Link>
              </Card>
            )}
            {(onboarded || known.facts.length > 0 || known.removed.length > 0) && (
              <KnownFacts known={known} />
            )}
            <LearnFromActivity />
            <HiddenCards />
            <OtherData />
            <PrivacyNote />
          </div>
        )}
      </div>
    </LandingPage>
  );
}

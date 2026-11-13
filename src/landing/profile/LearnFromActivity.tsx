import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Switch } from "@/features/misc/settings/controls";
import { plural } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { ActivityCounts } from "../../../convex/lib/museKnows";
import { ConfirmAction } from "./ConfirmAction";

/** "4 RSVPs · 2 Groups joined · 12 likes", in the order they count most. */
function countsText(c: ActivityCounts): string {
  return [
    c.going > 0 && plural(c.going, "RSVP"),
    c.interested > 0 && `${c.interested} interested`,
    c.join > 0 && `${plural(c.join, "Group")} joined`,
    c.save > 0 && plural(c.save, "save"),
    c.like > 0 && plural(c.like, "like"),
    c.skip > 0 && `${c.skip} "Not for me"`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The "Learn from your activity" switch (#4), what's recorded, and "Clear my activity" (#5). */
export function LearnFromActivity() {
  const on = useQ(api.profileSignals.learning, {});
  const activity = useQ(api.museKnows.activity, {});
  const setLearning = useM(api.profileSignals.setLearning);
  const clear = useM(api.museKnows.clearActivity);
  const [saving, setSaving] = useState(false);
  const change = (next: boolean) => {
    setSaving(true);
    setLearning({ on: next }).finally(() => setSaving(false));
  };
  const counts = activity ? countsText(activity.counts) : "";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[15px] text-primary leading-5">
            Learn from your activity
          </h2>
          <p className="mt-0.5 text-[13px] text-secondary leading-4">
            Events you RSVP to, Groups you join and things you like, save or mark "Not for me" add
            inferred interests and neighborhoods, each with the reason. Only you can see them.
          </p>
        </div>
        <Switch
          on={on ?? true}
          label="Learn from your activity"
          disabled={on === undefined || saving}
          onChange={change}
        />
      </div>
      {activity && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-divider-soft border-t pt-3">
          <p className="min-w-0 flex-1 text-[13px] text-secondary leading-4" aria-live="polite">
            {activity.stored === 0 ? (
              "Nothing recorded from your activity."
            ) : (
              <>
                <span className="font-semibold text-primary">Recorded:</span>{" "}
                {counts || "only actions you've since undone"}
              </>
            )}
          </p>
          <ConfirmAction
            label="Clear my activity"
            icon={<Trash2 size={16} aria-hidden />}
            disabled={activity.stored === 0}
            title="Clear your activity?"
            body={
              <>
                Landing deletes everything it recorded from your activity and the interests and
                neighborhoods Muse inferred from it. Your RSVPs, Groups, likes and saves themselves
                don't change, cards you marked "Not for me" stay hidden (show them again under
                "Cards you hid"), and facts you removed stay removed.
              </>
            }
            confirmLabel="Clear activity"
            onConfirm={() => clear({})}
          />
        </div>
      )}
    </Card>
  );
}

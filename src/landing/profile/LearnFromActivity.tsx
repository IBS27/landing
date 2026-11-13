import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Switch } from "@/features/misc/settings/controls";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/** The "Learn from your activity" switch on the City Profile page (#4). */
export function LearnFromActivity() {
  const on = useQ(api.profileSignals.learning, {});
  const setLearning = useM(api.profileSignals.setLearning);
  const [saving, setSaving] = useState(false);
  const change = (next: boolean) => {
    setSaving(true);
    setLearning({ on: next }).finally(() => setSaving(false));
  };
  return (
    <Card className="flex items-center gap-4 p-4">
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
    </Card>
  );
}

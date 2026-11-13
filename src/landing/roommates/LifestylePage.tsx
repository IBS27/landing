import { useMemo } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { RoommateCandidates } from "./Candidates";
import { type LifestyleActions, LifestyleView } from "./LifestyleView";

/**
 * `/landing/place/roommates`: roommate candidates from the viewer's network,
 * and the opt-in lifestyle answers they're matched on.
 */
export function LifestylePage() {
  const viewer = useViewer();
  const data = useQ(api.roommates.myLifestyle, {});
  const save = useM(api.roommates.saveLifestyle);
  const share = useM(api.roommates.setLifestyleSharing);
  const remove = useM(api.roommates.deleteLifestyle);

  const actions = useMemo<LifestyleActions>(
    () => ({
      save: async (answers) => {
        await save({ answers });
      },
      share: async (shared) => {
        await share({ shared });
      },
      remove: async () => {
        await remove({});
      },
    }),
    [save, share, remove],
  );

  return (
    <LandingPage
      title="Roommates"
      description="Find a roommate through people you know, matched on how you like to live at home."
      className="max-w-[720px]"
    >
      {data === undefined ? (
        <Card className="p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-3 h-24 w-full" />
        </Card>
      ) : (
        // Keyed by viewer, so switching persona never carries one person's draft to another.
        <LifestyleView
          key={viewer._id}
          state={data}
          actions={actions}
          candidates={(editAnswer) => <RoommateCandidates onEditAnswer={editAnswer} />}
        />
      )}
    </LandingPage>
  );
}

import { Inbox } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { LandingPage } from "@/landing/shell/LandingPage";
import { cn } from "@/lib/format";
import { Card, EmptyState, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { HistoryRow, ProposalCard } from "./ProposalCard";

/** `/landing/inbox`: every Muse proposal waiting on the viewer, plus what happened to past ones. */
export function InboxPage() {
  const [tab, setTab] = useState<"waiting" | "history">("waiting");
  const pending = useQ(api.proposals.pending, {});
  const history = useQ(api.proposals.history, tab === "history" ? {} : "skip");
  const count = pending?.length ?? 0;

  return (
    <LandingPage
      title="Inbox"
      description="Everything Muse drafted for you. Nothing is sent or created until you approve it."
    >
      <div className="mb-3 flex items-center gap-1 border-divider border-b">
        <TabButton active={tab === "waiting"} onClick={() => setTab("waiting")}>
          Waiting for you
          {count > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1.5 font-semibold text-[12px] text-white">
              {count}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
      </div>

      {tab === "waiting" ? (
        <>
          {pending === undefined ? (
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="mt-3 h-16 w-full" />
                </Card>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Inbox size={40} />}
                title="You're all caught up"
                body="When Muse drafts something for you, it shows up here first."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((p) => (
                <ProposalCard key={p._id} p={p} />
              ))}
            </div>
          )}
        </>
      ) : (
        <Card className="overflow-hidden">
          {history === undefined ? (
            <div className="p-4">
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<Inbox size={40} />}
              title="No history yet"
              body="Approved, discarded and expired proposals show up here."
            />
          ) : (
            <ul className="divide-y divide-divider">
              {history.map((p) => (
                <HistoryRow key={p._id} p={p} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </LandingPage>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "relative -mb-px inline-flex h-12 items-center px-4 font-semibold text-[15px] transition-colors",
        active ? "border-fb border-b-[3px] text-fb" : "rounded-t-lg text-secondary hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

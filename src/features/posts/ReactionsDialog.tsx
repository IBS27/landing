import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { cn, compactCount } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { REACTIONS, ReactionIcon, type ReactionType } from "./reactions";

/** "Who reacted" dialog with All + per-reaction tabs. */
export function ReactionsDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: "post" | "comment";
  targetId: string;
  onClose: () => void;
}) {
  const rows = useQ(api.reactions.list, { targetType, targetId });
  const [tab, setTab] = useState<ReactionType | "all">("all");
  const counts = new Map<ReactionType, number>();
  for (const r of rows ?? []) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  const tabs = REACTIONS.filter((r) => counts.has(r.type)).sort(
    (a, b) => (counts.get(b.type) ?? 0) - (counts.get(a.type) ?? 0),
  );
  const shown = (rows ?? []).filter((r) => tab === "all" || r.type === tab);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} width={548} hideHeader title="Reactions">
      <div className="flex h-[60px] items-center border-divider border-b px-4">
        <div className="flex h-full flex-1 items-stretch">
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            All
          </TabButton>
          {tabs.map((r) => (
            <TabButton key={r.type} active={tab === r.type} onClick={() => setTab(r.type)}>
              <ReactionIcon type={r.type} size={20} />
              <span>{compactCount(counts.get(r.type) ?? 0)}</span>
            </TabButton>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-secondary hover:brightness-95"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
            <path
              d="m5 5 10 10m0-10L5 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="max-h-[60vh] min-h-[200px] overflow-y-auto p-2">
        {rows === undefined ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          shown.map((r) => (
            <Link
              key={`${r.user!._id}`}
              to="/$username"
              params={{ username: r.user!.username }}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover"
            >
              <span className="relative">
                <Avatar src={r.user!.avatar} size={40} />
                <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-card">
                  <ReactionIcon type={r.type} size={16} />
                </span>
              </span>
              <span className="font-semibold text-[15px]">{r.user!.name}</span>
            </Link>
          ))
        )}
      </div>
    </Modal>
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
      className={cn(
        "relative flex items-center gap-1.5 px-4 font-semibold text-[15px]",
        active ? "text-fb" : "rounded-lg text-secondary hover:bg-hover",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-fb" />}
    </button>
  );
}

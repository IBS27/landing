import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock, UsersRound } from "lucide-react";
import { useQ } from "@/app/viewer";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/** My Place's entry to roommate matching, with the viewer's sharing status. */
export function RoommatesCard() {
  const mine = useQ(api.roommates.myLifestyle, {});
  const status =
    mine === undefined
      ? ""
      : mine === null
        ? "Answer a few questions about how you live. Private until you share."
        : mine.shared
          ? "See roommate candidates from your network."
          : "Your answers are private. Share them when you're ready.";
  return (
    <Card className="mb-4 overflow-hidden">
      <Link to="/landing/place/roommates" className="flex items-center gap-3 p-4 hover:bg-hover">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          {mine?.shared ? <UsersRound size={20} /> : <Lock size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[17px] text-primary leading-[22px]">
            Roommates
          </span>
          <span className="block min-h-4 text-[13px] text-secondary leading-4">{status}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
      </Link>
    </Card>
  );
}

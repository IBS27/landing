import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useQ } from "@/app/viewer";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * On a House Group's page (#38), for the people who live there: the way to
 * the house's chores, bills and grocery list in Landing. Renders nothing for
 * other Groups.
 */
export function HouseBanner({ groupId }: { groupId: Id<"groups"> }) {
  const house = useQ(api.house.forGroup, { groupId });
  if (!house) return null;
  return (
    <Link
      to="/landing/place/house"
      search={{ group: house.slug }}
      className="mb-3 flex items-center gap-3 rounded-lg bg-card p-3 shadow-base transition-colors hover:bg-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
        <Home size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[15px] text-primary leading-5">
          This is your House Group
        </span>
        <span className="block text-[13px] text-secondary leading-4">
          Chores, bills and the grocery list are in Landing.
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
    </Link>
  );
}

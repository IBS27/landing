import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPinned } from "lucide-react";
import { Card } from "@/ui/primitives";

/** Find's way into the neighborhood pages (#16). */
export function NeighborhoodsLink() {
  return (
    <Card className="mb-4">
      <Link
        to="/landing/find/neighborhoods"
        className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-hover active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn-soft text-btn-soft-text">
          <MapPinned size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[15px] text-primary leading-5">
            Neighborhoods
          </span>
          <span className="block text-[13px] text-secondary leading-4">
            Groups, events and people in each part of the city
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-secondary" aria-hidden />
      </Link>
    </Card>
  );
}

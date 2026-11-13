import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronRight, MapPinned } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/ui/primitives";

/** Find's way into the neighborhood pages (#16) and "Try the neighborhood" (#19). */
export function NeighborhoodsLink() {
  return (
    <Card className="mb-4 p-1">
      <Row
        to="/landing/find/neighborhoods"
        icon={<MapPinned size={20} strokeWidth={2.2} />}
        title="Neighborhoods"
        sub="Groups, events and people in each part of the city"
      />
      <Row
        to="/landing/find/neighborhoods/compare"
        icon={<ArrowLeftRight size={20} strokeWidth={2.2} />}
        title="Try the neighborhood"
        sub="Compare two side by side: a Saturday in each, scores and what fits you"
      />
    </Card>
  );
}

function Row({
  to,
  icon,
  title,
  sub,
}: {
  to: LinkProps["to"];
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn-soft text-btn-soft-text">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[15px] text-primary leading-5">{title}</span>
        <span className="block text-[13px] text-secondary leading-4">{sub}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-secondary" aria-hidden />
    </Link>
  );
}

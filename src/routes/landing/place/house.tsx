import { createFileRoute } from "@tanstack/react-router";
import { HousePage } from "@/landing/living/HousePage";

/** `?group=<slug>` picks one of the viewer's houses. */
type Search = { group?: string };

export const Route = createFileRoute("/landing/place/house")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    group: typeof s.group === "string" && s.group.length <= 120 ? s.group : undefined,
  }),
  component: function HouseRoute() {
    const { group } = Route.useSearch();
    return <HousePage key={group ?? ""} group={group} />;
  },
});

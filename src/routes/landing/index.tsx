import { createFileRoute } from "@tanstack/react-router";
import { type HomeSearch, LandingHome } from "@/landing/home/LandingHome";

export const Route = createFileRoute("/landing/")({
  validateSearch: (s: Record<string, unknown>): HomeSearch =>
    s.view === "apartment" ? { view: "apartment" } : {},
  component: () => {
    const { view } = Route.useSearch();
    return <LandingHome view={view ?? "map"} />;
  },
});

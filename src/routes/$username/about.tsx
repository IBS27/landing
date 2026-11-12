import { createFileRoute } from "@tanstack/react-router";
import { type AboutSection, AboutTab, isAboutSection } from "@/features/profile";

export const Route = createFileRoute("/$username/about")({
  validateSearch: (s: Record<string, unknown>): { section?: AboutSection } =>
    isAboutSection(s.section) ? { section: s.section } : {},
  component: function AboutRoute() {
    const { section } = Route.useSearch();
    return <AboutTab section={section ?? "intro"} />;
  },
});

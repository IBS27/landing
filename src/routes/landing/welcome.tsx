import { createFileRoute } from "@tanstack/react-router";
import { CityBriefPage } from "@/landing/profile/CityBrief";

/** Landing onboarding: the City Profile brief (#3). `?edit=true` opens it ready to edit. */
export const Route = createFileRoute("/landing/welcome")({
  validateSearch: (s: Record<string, unknown>): { edit?: boolean } =>
    s.edit === true || s.edit === "true" ? { edit: true } : {},
  component: function WelcomeRoute() {
    const { edit } = Route.useSearch();
    return <CityBriefPage key={edit ? "edit" : "brief"} startEditing={Boolean(edit)} />;
  },
});

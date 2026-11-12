import { createFileRoute } from "@tanstack/react-router";
import { SETTINGS_TABS, SettingsPage } from "@/features/misc/SettingsPage";

export const Route = createFileRoute("/settings")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
    tab: typeof s.tab === "string" && SETTINGS_TABS.includes(s.tab) ? s.tab : undefined,
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { tab } = Route.useSearch();
  return <SettingsPage tab={tab} />;
}

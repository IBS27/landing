import { Outlet, useRouterState } from "@tanstack/react-router";
import { useQ } from "@/app/viewer";
import { AppRail, AppRailDivider, AppRailItem } from "@/features/misc/AppRail";
import { CountBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { BmLanding } from "./icons";
import { type LandingSection, SECTIONS, sectionFor, YOU_SECTIONS } from "./sections";

/**
 * Landing's layout (`/landing/*`). Landing is a section of the Facebook clone,
 * like Gaming or Marketplace: the root layout keeps Facebook's TopNav and
 * ChatDock, and Landing adds its 360px sidebar (the clone's `AppRail`) with
 * the page beside it.
 */
export function LandingLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionFor(path);
  const inboxCount = useQ(api.proposals.pendingCount, {}) ?? 0;
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <AppRail
        label="Landing"
        title={
          <span className="flex items-center gap-2">
            <BmLanding size={32} />
            Landing
          </span>
        }
      >
        <SectionRows sections={SECTIONS} current={current} />
        <AppRailDivider />
        <SectionRows
          sections={YOU_SECTIONS}
          current={current}
          badges={{ "/landing/inbox": inboxCount }}
        />
      </AppRail>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function SectionRows({
  sections,
  current,
  badges,
}: {
  sections: readonly LandingSection[];
  current: LandingSection | undefined;
  /** Count badges by section path (Inbox: Muse proposals waiting). */
  badges?: Record<string, number>;
}) {
  return sections.map(({ label, to, Icon }) => (
    <AppRailItem
      key={to}
      large
      to={to}
      label={label}
      selected={current?.to === to}
      icon={<Icon size={20} strokeWidth={2.2} />}
      trailing={<CountBadge count={badges?.[to] ?? 0} />}
    />
  ));
}

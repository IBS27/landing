import { Outlet, useRouterState } from "@tanstack/react-router";
import { AppRail, AppRailDivider, AppRailItem } from "@/features/misc/AppRail";
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
        <SectionRows sections={YOU_SECTIONS} current={current} />
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
}: {
  sections: readonly LandingSection[];
  current: LandingSection | undefined;
}) {
  return sections.map(({ label, to, Icon }) => (
    <AppRailItem
      key={to}
      large
      to={to}
      label={label}
      selected={current?.to === to}
      icon={<Icon size={20} strokeWidth={2.2} />}
    />
  ));
}

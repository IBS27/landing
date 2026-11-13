import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LandingPage } from "@/landing/shell/LandingPage";
import { cn } from "@/lib/format";

const TABS = [
  {
    label: "Move-in Crew",
    to: "/landing/crew",
    description: "Meet people arriving when you do, matched on what you're into, before move day.",
  },
  {
    label: "Journeys",
    to: "/landing/crew/journeys",
    description:
      "A plan for each weekend of your first 90 days, from real Events and Group plans near you.",
  },
] as const;

/**
 * Landing → Crew & Journeys: the page header and a tab bar over the Move-in
 * Crew (#30, #31) and Journeys (#32) pages, so each page stays its own file.
 */
export function CrewTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") });
  const current = TABS.find((t) => t.to === path) ?? TABS[0];
  return (
    <LandingPage title="Crew & Journeys" description={current.description}>
      <nav
        aria-label="Crew & Journeys"
        className="-mt-1 mb-4 flex max-w-[760px] gap-1 border-divider border-b"
      >
        {TABS.map((t) => {
          const active = t.to === current.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center",
                active ? "text-link" : "text-secondary",
              )}
            >
              <span
                className={cn(
                  "my-1 flex h-10 items-center rounded-md px-4 font-semibold text-[15px] transition-colors",
                  !active && "group-hover:bg-hover",
                )}
              >
                {t.label}
              </span>
              {active && (
                <span className="absolute inset-x-0 bottom-[-1px] h-[3px] rounded-t-[2px] bg-fb" />
              )}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </LandingPage>
  );
}

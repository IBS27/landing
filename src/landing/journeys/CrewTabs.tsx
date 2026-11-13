import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/format";

const TABS = [
  { label: "Move-in Crew", to: "/landing/crew" },
  { label: "Journeys", to: "/landing/crew/journeys" },
] as const;

/**
 * Landing → Crew & Journeys: a tab bar over the Move-in Crew (#30, #31) and
 * Journeys (#32) pages, so each page stays its own file.
 */
export function CrewTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") });
  return (
    <>
      <div className="mx-auto w-full max-w-[960px] px-4 pt-3 lg:px-8">
        <nav aria-label="Crew & Journeys" className="flex border-divider border-b">
          {TABS.map((t) => {
            const active = path === t.to;
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
                  <span className="absolute inset-x-0 bottom-[-1px] h-[3px] rounded-t-[1px] bg-fb" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </>
  );
}

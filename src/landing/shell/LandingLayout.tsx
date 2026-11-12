import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { FacebookLogo } from "@/icons";
import { AccountMenu } from "@/layout/AccountMenu";
import { cn } from "@/lib/format";
import { BmLanding } from "./icons";
import { type LandingSection, SECTIONS, sectionFor, YOU_SECTIONS } from "./sections";

/**
 * Landing's root layout (`/landing/*`): its own header and section nav in
 * place of Facebook's TopNav and ChatDock. Pages render in `<main>`.
 */
export function LandingLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionFor(path);

  useEffect(() => {
    document.title =
      current && current.to !== "/landing" ? `${current.label} | Landing` : "Landing";
  }, [current]);

  return (
    <div className="min-h-screen bg-wash">
      <LandingHeader />
      <div className="flex pt-14">
        <nav
          aria-label="Landing"
          className="sticky top-14 flex h-[calc(100vh-56px)] w-[72px] shrink-0 flex-col overflow-y-auto bg-card px-2 py-3 shadow-[1px_0_0_var(--shadow-1)] lg:w-[280px]"
        >
          <NavList sections={SECTIONS} current={current} />
          <div className="mx-2 my-2 h-px bg-divider" />
          <NavList sections={YOU_SECTIONS} current={current} />
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-4 bg-nav px-4 shadow-[0_1px_2px_var(--shadow-1)] dark:shadow-[0_1px_0_var(--divider)]">
      <Link to="/landing" className="flex shrink-0 items-center gap-2">
        <BmLanding size={40} />
        <span className="font-bold text-[24px] text-primary leading-7">Landing</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/"
          aria-label="Back to Facebook"
          className="flex h-10 items-center gap-2 rounded-full bg-btn pr-1 pl-1 font-semibold text-[15px] text-primary transition-[filter] hover:brightness-95 sm:pr-4 dark:hover:brightness-125"
        >
          <FacebookLogo size={32} />
          <span className="hidden sm:inline">Back to Facebook</span>
        </Link>
        <AccountMenu home="/landing" />
      </div>
    </header>
  );
}

function NavList({
  sections,
  current,
}: {
  sections: readonly LandingSection[];
  current: LandingSection | undefined;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {sections.map(({ label, to, Icon }) => {
        const active = current?.to === to;
        return (
          <li key={to}>
            <Link
              to={to}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              activeOptions={{ exact: true }}
              className={cn(
                "flex min-h-[52px] items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                active ? "bg-wash dark:bg-hover" : "hover:bg-hover",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-accent text-white" : "bg-btn text-icon",
                )}
              >
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <span className="hidden min-w-0 flex-1 truncate font-medium text-[15px] text-primary leading-5 lg:block">
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

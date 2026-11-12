import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useViewer } from "@/app/viewer";
import { Card } from "@/ui/primitives";
import { BmLanding } from "./icons";
import { LandingPage } from "./LandingPage";
import { SECTIONS } from "./sections";

/** The City Profile onboarding brief. Its route arrives with #3, so link by plain path. */
const WELCOME_PATH: string = "/landing/welcome";

/** Landing Home (`/landing`). A stub until the dashboard is built. */
export function HomePage() {
  const viewer = useViewer();
  return (
    <LandingPage
      title={`Welcome to Landing, ${viewer.firstName}`}
      description="Find a place, meet people before you land and settle into San Francisco."
    >
      <Card className="flex items-center gap-4 p-4">
        <BmLanding size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[17px] text-primary leading-5">Set up your City Profile</h2>
          <p className="mt-0.5 text-[15px] text-secondary leading-5">
            Tell Landing your interests, schedule and budget. Everything else builds on it.
          </p>
        </div>
        <Link
          to={WELCOME_PATH}
          className="flex h-9 shrink-0 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
        >
          Get started
        </Link>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SECTIONS.filter((s) => s.to !== "/landing").map(({ label, to, Icon, description }) => (
          <Link key={to} to={to} className="rounded-lg bg-card shadow-base">
            {/* The hover wash is translucent, so it sits on top of the card's fill. */}
            <span className="flex items-center gap-3 rounded-lg p-4 transition-colors hover:bg-hover">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
                <Icon size={22} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[15px] text-primary leading-5">
                  {label}
                </span>
                <span className="block text-[13px] text-secondary leading-4">{description}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-icon-secondary" />
            </span>
          </Link>
        ))}
      </div>
    </LandingPage>
  );
}

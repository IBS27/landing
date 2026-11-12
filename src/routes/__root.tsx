import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useViewerContext } from "@/app/viewer";
import { ChatDock } from "@/features/messenger/ChatDock";
import { FacebookLogo } from "@/icons";
import { TopNav } from "@/layout/TopNav";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const { viewer } = useViewerContext();
  if (viewer === undefined) return <Splash />;
  if (viewer === null)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <FacebookLogo size={64} />
        <p className="font-semibold text-lg">No demo accounts yet</p>
        <p className="text-secondary">
          Seed the database with <code className="rounded bg-btn px-1">bun run seed</code>.
        </p>
      </div>
    );
  return (
    <>
      <TopNav />
      <div className="min-h-screen pt-14">
        <Outlet />
      </div>
      <ChatDock />
    </>
  );
}

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-card">
      <FacebookLogo size={72} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center">
      <svg
        viewBox="0 0 112 112"
        width="112"
        height="112"
        className="mb-4 text-secondary"
        aria-hidden
      >
        <rect
          x="16"
          y="24"
          width="80"
          height="64"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          d="M40 52l32 16M72 52 40 68"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <h1 className="font-bold text-lg text-secondary">This content isn't available right now</h1>
      <p className="mt-2 max-w-md text-secondary">
        When this happens, it's usually because the owner only shared it with a small group of
        people, changed who can see it or it's been deleted.
      </p>
      <a href="/" className="mt-6 rounded-md bg-btn-primary px-12 py-2 font-semibold text-white">
        Go to Feed
      </a>
    </div>
  );
}

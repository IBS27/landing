import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useViewerContext } from "@/app/viewer";
import { ChatDock } from "@/features/messenger/ChatDock";
import { PhotoTheaterHost } from "@/features/posts/photoTheater";
import { FacebookLogo } from "@/icons";
import { PageUnavailable } from "@/layout/PageUnavailable";
import { TopNav } from "@/layout/TopNav";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: PageUnavailable,
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
      <PhotoTheaterHost />
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

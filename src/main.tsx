import {
  createRouter,
  ErrorComponent,
  type ErrorComponentProps,
  RouterProvider,
} from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChatDockProvider } from "./app/chat-dock";
import { ThemeProvider } from "./app/theme";
import { ViewerProvider } from "./app/viewer";
import { PageUnavailable } from "./layout/PageUnavailable";
import { routeTree } from "./routeTree.gen";
import { TooltipProvider } from "./ui/overlays";
import "./styles.css";

const convex = new ConvexReactClient(import.meta.env.CONVEX_URL as string);

/** An id from another table in a URL fails Convex's `v.id()` check: show the broken-link page. */
function RouteError(props: ErrorComponentProps) {
  if (props.error instanceof Error && props.error.message.includes("ArgumentValidationError"))
    return <PageUnavailable />;
  return <ErrorComponent {...props} />;
}

const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ThemeProvider>
        <ViewerProvider>
          <TooltipProvider delayDuration={350}>
            <ChatDockProvider>
              <RouterProvider router={router} />
            </ChatDockProvider>
          </TooltipProvider>
        </ViewerProvider>
      </ThemeProvider>
    </ConvexProvider>
  </StrictMode>,
);

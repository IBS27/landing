import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChatDockProvider } from "./app/chat-dock";
import { ThemeProvider } from "./app/theme";
import { ViewerProvider } from "./app/viewer";
import { routeTree } from "./routeTree.gen";
import { TooltipProvider } from "./ui/overlays";
import "./styles.css";

const convex = new ConvexReactClient(import.meta.env.CONVEX_URL as string);

const router = createRouter({
  routeTree,
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

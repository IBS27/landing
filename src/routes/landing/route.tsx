import { createFileRoute } from "@tanstack/react-router";
import { LandingLayout } from "@/landing/shell/LandingLayout";
import { PageUnavailable } from "@/layout/PageUnavailable";

export const Route = createFileRoute("/landing")({
  component: LandingLayout,
  notFoundComponent: PageUnavailable,
});

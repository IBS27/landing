import { createFileRoute } from "@tanstack/react-router";
import { PageUnavailable } from "@/layout/PageUnavailable";

// Unknown /landing/* paths show the broken-link page inside Landing's layout.
// Without this splat, Facebook's /$username/$section would claim them.
export const Route = createFileRoute("/landing/$")({
  component: PageUnavailable,
});

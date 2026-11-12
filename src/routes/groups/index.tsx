import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/groups/")({
  beforeLoad: () => {
    throw redirect({ to: "/groups/feed", replace: true });
  },
});

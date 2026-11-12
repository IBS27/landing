import { createFileRoute, redirect } from "@tanstack/react-router";

/** facebook.com/reels is an alias of the Reels tab (/reel). */
export const Route = createFileRoute("/reels")({
  beforeLoad: () => {
    throw redirect({ to: "/reel", replace: true });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

/** facebook.com/video is an alias of Video (/watch). */
export const Route = createFileRoute("/video")({
  beforeLoad: () => {
    throw redirect({ to: "/watch", replace: true });
  },
});

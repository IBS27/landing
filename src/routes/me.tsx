import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useViewer } from "@/app/viewer";

/** facebook.com/me opens the viewer's own profile. */
export const Route = createFileRoute("/me")({
  component: function MeRedirect() {
    const { username } = useViewer();
    return <Navigate to="/$username" params={{ username }} replace />;
  },
});

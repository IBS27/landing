import { createFileRoute } from "@tanstack/react-router";
import { ProfileLayout } from "@/features/profile";

export const Route = createFileRoute("/$username")({
  component: function ProfileRoute() {
    const { username } = Route.useParams();
    return <ProfileLayout username={username} />;
  },
});

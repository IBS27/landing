import { createFileRoute } from "@tanstack/react-router";
import { FriendsHome } from "@/features/friends";

export const Route = createFileRoute("/friends/")({
  component: FriendsHome,
});

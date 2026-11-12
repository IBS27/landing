import { createFileRoute } from "@tanstack/react-router";
import { FriendListsPage } from "@/features/friends";

export const Route = createFileRoute("/friends/lists")({
  component: FriendListsPage,
});

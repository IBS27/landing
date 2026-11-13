import { createFileRoute } from "@tanstack/react-router";
import { RoomPage } from "@/landing/move-in/RoomPage";

/** My Place → Your room: room scans and style vibes (#25). `?room=<id>` picks a room. */
export const Route = createFileRoute("/landing/place/room")({
  validateSearch: (s: Record<string, unknown>): { room?: string } =>
    typeof s.room === "string" && s.room ? { room: s.room } : {},
  component: function RoomRoute() {
    const { room } = Route.useSearch();
    return <RoomPage roomId={room} />;
  },
});

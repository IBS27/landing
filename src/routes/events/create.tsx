import { createFileRoute } from "@tanstack/react-router";
import { CreateEvent } from "@/features/events/CreateEvent";

export const Route = createFileRoute("/events/create")({
  // ?edit=<eventId> edits an event; ?group=<groupId> creates one in a Group.
  validateSearch: (s: Record<string, unknown>): { edit?: string; group?: string } => ({
    ...(typeof s.edit === "string" && s.edit ? { edit: s.edit } : {}),
    ...(typeof s.group === "string" && s.group ? { group: s.group } : {}),
  }),
  component: function CreateRoute() {
    const { edit, group } = Route.useSearch();
    return <CreateEvent key={edit ?? group ?? "new"} editId={edit} groupId={group} />;
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { CreateEvent } from "@/features/events/CreateEvent";

export const Route = createFileRoute("/events/create")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } =>
    typeof s.edit === "string" && s.edit ? { edit: s.edit } : {},
  component: function CreateRoute() {
    const { edit } = Route.useSearch();
    return <CreateEvent key={edit ?? "new"} editId={edit} />;
  },
});

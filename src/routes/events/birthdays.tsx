import { createFileRoute } from "@tanstack/react-router";
import { Birthdays } from "@/features/events/Birthdays";

export const Route = createFileRoute("/events/birthdays")({
  component: Birthdays,
});

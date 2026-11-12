import { createFileRoute } from "@tanstack/react-router";
import { LiveProducer } from "@/features/posts/LiveSetup";

/** facebook.com/live/producer: set up and run a live video. */
export const Route = createFileRoute("/live/producer")({
  component: LiveProducer,
});

import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/ui/Placeholder";

export const Route = createFileRoute("/messages/t/$conversationId")({
  component: () => <Placeholder title="Chat" />,
});

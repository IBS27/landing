import { createFileRoute } from "@tanstack/react-router";
import { ConversationPage } from "@/features/messenger/MessagesPage";
import { requireConvexId } from "@/lib/ids";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/messages/t/$conversationId")({
  beforeLoad: ({ params }) => requireConvexId(params.conversationId),
  component: function Conversation() {
    const { conversationId } = Route.useParams();
    return <ConversationPage conversationId={conversationId as Id<"conversations">} />;
  },
});

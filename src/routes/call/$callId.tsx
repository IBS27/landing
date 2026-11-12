import { createFileRoute } from "@tanstack/react-router";
import { CallWindowPage } from "@/features/messenger/CallScreen";

export const Route = createFileRoute("/call/$callId")({
  component: CallRoute,
});

function CallRoute() {
  const { callId } = Route.useParams();
  return <CallWindowPage callId={callId} />;
}

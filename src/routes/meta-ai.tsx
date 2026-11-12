import { createFileRoute } from "@tanstack/react-router";
import { MetaAIPage } from "@/features/misc/MetaAIPage";

export const Route = createFileRoute("/meta-ai")({
  component: MetaAIPage,
});

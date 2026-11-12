import { createFileRoute } from "@tanstack/react-router";
import { FundraisersPage } from "@/features/misc/FundraisersPage";

export const Route = createFileRoute("/fundraisers")({
  component: FundraisersPage,
});

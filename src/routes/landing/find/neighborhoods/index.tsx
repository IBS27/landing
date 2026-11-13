import { createFileRoute } from "@tanstack/react-router";
import { NeighborhoodsIndex } from "@/landing/neighborhoods/NeighborhoodsIndex";

export const Route = createFileRoute("/landing/find/neighborhoods/")({
  component: NeighborhoodsIndex,
});

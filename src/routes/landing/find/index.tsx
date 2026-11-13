import { createFileRoute } from "@tanstack/react-router";
import { FindPage } from "@/landing/search/FindPage";

export const Route = createFileRoute("/landing/find/")({ component: FindPage });

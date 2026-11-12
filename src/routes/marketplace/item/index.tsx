import { createFileRoute, redirect } from "@tanstack/react-router";

/** /marketplace/item without a listing id goes to Marketplace's browse page. */
export const Route = createFileRoute("/marketplace/item/")({
  beforeLoad: () => {
    throw redirect({ to: "/marketplace", replace: true });
  },
});

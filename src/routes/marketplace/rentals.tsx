import { createFileRoute, redirect } from "@tanstack/react-router";

/** facebook.com/marketplace/rentals is an alias of the Property Rentals category. */
export const Route = createFileRoute("/marketplace/rentals")({
  beforeLoad: () => {
    throw redirect({
      to: "/marketplace/category/$category",
      params: { category: "propertyrentals" },
      replace: true,
    });
  },
});

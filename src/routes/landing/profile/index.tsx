import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

// Placeholder: #3 (City Profile) replaces this with its page from `src/landing/profile/`.
export const Route = createFileRoute("/landing/profile/")({
  component: () => (
    <LandingPage
      title="City Profile"
      description="What Landing knows about you, and what it uses it for."
    >
      <ComingSoon
        items={[
          "Your brief: interests, schedule, budget and how you get around",
          "What Landing learns from your RSVPs, joins, likes, skips and pins",
          "See and edit everything Muse thinks it knows about you",
        ]}
      />
    </LandingPage>
  ),
});

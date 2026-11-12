import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";

// Placeholder: #6 (Muse approval queue) builds the inbox from `src/landing/inbox/`.
export const Route = createFileRoute("/landing/inbox/")({
  component: () => (
    <LandingPage title="Inbox" description="Messages Muse drafted for you, waiting for your OK.">
      <ComingSoon
        items={[
          "Review, edit and approve each draft before Muse sends it",
          "Nothing goes out without your approval",
        ]}
      />
    </LandingPage>
  ),
});

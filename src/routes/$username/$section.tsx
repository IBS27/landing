import { createFileRoute, notFound } from "@tanstack/react-router";
import { SECTION_KEYS, type SectionKey, SectionTab } from "@/features/profile";

export const Route = createFileRoute("/$username/$section")({
  beforeLoad: ({ params }) => {
    if (!SECTION_KEYS.includes(params.section as SectionKey)) throw notFound();
  },
  component: function SectionRoute() {
    const { section } = Route.useParams();
    return <SectionTab section={section as SectionKey} />;
  },
});

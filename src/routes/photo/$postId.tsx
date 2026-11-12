import { createFileRoute } from "@tanstack/react-router";
import { PhotoTheaterPage } from "@/features/posts/photoTheater";

export const Route = createFileRoute("/photo/$postId")({
  validateSearch: (search: Record<string, unknown>): { i?: number } => {
    const i = Number(search.i);
    return Number.isInteger(i) && i > 0 ? { i } : {};
  },
  component: PhotoRoute,
});

function PhotoRoute() {
  const { postId } = Route.useParams();
  const { i } = Route.useSearch();
  return <PhotoTheaterPage postId={postId} index={i ?? 0} />;
}

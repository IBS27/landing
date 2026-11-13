import { Link } from "@tanstack/react-router";
import { ChevronRight, Sofa } from "lucide-react";
import { useQ } from "@/app/viewer";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { styleLabel } from "../../../convex/lib/vibe";

/** My Place's entry to the room scan and vibe (#25). */
export function RoomCard() {
  const rooms = useQ(api.rooms.mine, {});
  const room = rooms?.[0];
  const sub = !room
    ? "Photograph your room and set its vibe. Muse can suggest one from what you save, like and follow."
    : room.vibe
      ? `${room.name} · ${room.vibe.styles.map(styleLabel).join(", ")}${rooms && rooms.length > 1 ? ` · ${rooms.length} rooms` : ""}`
      : `${room.name} · ${room.photos.length} photos · no vibe yet`;
  return (
    <Card className="mb-3 overflow-hidden">
      <Link to="/landing/place/room" className="flex items-center gap-3 p-4 hover:bg-hover">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <Sofa size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[17px] text-primary leading-[22px]">
            Your room
          </span>
          <span className="block truncate text-[13px] text-secondary leading-4">{sub}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
      </Link>
    </Card>
  );
}

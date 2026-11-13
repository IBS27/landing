import { Link } from "@tanstack/react-router";
import { ChevronRight, Sofa } from "lucide-react";
import { useQ } from "@/app/viewer";
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
    <Link to="/landing/place/room" className="rounded-lg bg-card shadow-base">
      <span className="flex items-center gap-3 rounded-lg p-4 transition-colors hover:bg-hover">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <Sofa size={22} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[15px] text-primary leading-5">Your room</span>
          <span className="block truncate text-[13px] text-secondary leading-4">{sub}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-icon-secondary" />
      </span>
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useQ } from "@/app/viewer";
import { toListing } from "@/landing/links";
import { price } from "@/lib/format";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PlaceInRoom } from "./PlaceInRoom";

/**
 * "Matches for this room" (#26): Marketplace items that fit the room's vibe,
 * best first, each with the words that matched. Shown once the room has a vibe.
 */
export function VibeMatches({ roomId }: { roomId: Id<"rooms"> }) {
  const matches = useQ(api.rooms.matches, { roomId });
  const placed = useQ(api.unitItems.placed, { roomId })?.[0];
  const rooms = [{ _id: roomId, name: "" }];
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h2 className="font-bold text-[17px] text-primary leading-5">Matches for this room</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Marketplace pieces that fit this room's vibe, best first.
        </p>
      </div>
      {matches === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : matches.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-secondary">
          Nothing on Marketplace matches this vibe right now. Try adding a few keywords to it.
        </p>
      ) : (
        <ul className="divide-y divide-divider border-divider border-t">
          {matches.map((m) => (
            <li key={m._id} className="flex gap-3 px-4 py-3">
              <Link {...toListing(m._id)} className="shrink-0 self-start" tabIndex={-1} aria-hidden>
                {m.photo ? (
                  <img src={m.photo} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-btn" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  {...toListing(m._id)}
                  className="block truncate font-semibold text-[15px] text-primary leading-5 hover:underline"
                >
                  {m.title}
                </Link>
                <div className="text-[13px] text-secondary leading-[18px]">
                  {m.price === 0 ? "Free" : price(m.price)}
                  {m.neighborhood ? ` · ${m.neighborhood}` : ""}
                </div>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {m.reasons.map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-1.5 text-[13px] text-secondary leading-[18px]"
                    >
                      <Sparkles size={12} className="mt-[3px] shrink-0 text-accent" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <PlaceInRoom
                    item={{ placeListing: m._id }}
                    rooms={rooms}
                    placedIn={placed?.listingIds.includes(m._id) ? placed.unitId : null}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

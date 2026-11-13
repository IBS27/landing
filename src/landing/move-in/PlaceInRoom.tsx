import { Link, useNavigate } from "@tanstack/react-router";
import { Box, Check, ChevronDown } from "lucide-react";
import { toUnit } from "@/landing/links";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import type { Id } from "../../../convex/_generated/dataModel";

const action =
  "inline-flex h-8 select-none items-center gap-1.5 whitespace-nowrap rounded-md px-3 font-semibold text-sm transition-[filter] hover:brightness-95 active:scale-[0.98] dark:hover:brightness-125";
const secondary = cn(action, "bg-btn text-btn-text");
const soft = cn(action, "bg-btn-soft text-btn-soft-text");

type Item = { placeItem: Id<"ownedItems"> } | { placeListing: Id<"listings"> };

/**
 * "Place in my room" (#131): opens a room's 3D unit with this item ready to
 * place. Once placed, it reads "In your room" and opens that unit instead.
 * Pass `rooms` to choose among several; with none, it leads to setting one up.
 */
export function PlaceInRoom({
  item,
  rooms,
  placedIn,
}: {
  item: Item;
  rooms: { _id: Id<"rooms">; name: string }[];
  /** The unit it's already placed in, if any. */
  placedIn: Id<"unitScenes"> | null;
}) {
  const navigate = useNavigate();
  if (placedIn)
    return (
      <Link {...toUnit({ unit: placedIn })} className={soft}>
        <Check size={14} strokeWidth={3} aria-hidden /> In your room
      </Link>
    );
  const icon = <Box size={14} aria-hidden />;
  if (rooms.length === 0)
    return (
      <Link to="/landing/place/room" className={secondary}>
        {icon} Place in my room
      </Link>
    );
  if (rooms.length === 1)
    return (
      <Link {...toUnit({ room: rooms[0]._id, ...item })} className={secondary}>
        {icon} Place in my room
      </Link>
    );
  return (
    <Menu>
      <MenuTrigger className={secondary}>
        {icon} Place in my room <ChevronDown size={14} aria-hidden />
      </MenuTrigger>
      <MenuContent align="start" width={240}>
        {rooms.map((r) => (
          <MenuItem
            key={r._id}
            label={r.name}
            onSelect={() => void navigate(toUnit({ room: r._id, ...item }))}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

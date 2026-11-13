import { Link } from "@tanstack/react-router";
import { ChevronRight, Home, MailOpen } from "lucide-react";
import { useQ } from "@/app/viewer";
import { plural } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/**
 * My Place's way into the House Group (#38): an invite (the house page shows it,
 * with Join and Decline), the viewer's house, or a start.
 */
export function HouseCard() {
  const mine = useQ(api.house.mine, {});
  const house = mine?.houses[0];
  const invite = mine?.invites[0];
  const status =
    mine === undefined
      ? ""
      : invite
        ? `${invite.invitedBy.name} invited you to ${invite.name}.`
        : house
          ? `${house.name} · ${plural(house.memberCount, "person", "people")}. Chores, bills and groceries.`
          : "Share chores, bills and a grocery list with the people you live with.";
  return (
    <Card className="mb-3 overflow-hidden">
      <Link
        to="/landing/place/house"
        search={house ? { group: house.slug } : {}}
        className="flex items-center gap-3 p-4 hover:bg-hover"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          {invite ? <MailOpen size={20} /> : <Home size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[17px] text-primary leading-[22px]">House</span>
          <span className="block min-h-4 text-[13px] text-secondary leading-4">{status}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-icon-secondary" aria-hidden />
      </Link>
    </Card>
  );
}

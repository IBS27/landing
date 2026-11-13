import type { LinkOptions } from "@tanstack/react-router";
import {
  BedDouble,
  Box,
  CalendarCheck,
  Camera,
  CircleUserRound,
  Columns2,
  DoorOpen,
  House,
  KeyRound,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Package,
  Search,
  Tag,
  Truck,
  UsersRound,
} from "lucide-react";
import {
  toCompare,
  toCrew,
  toFind,
  toJourneys,
  toMoveOut,
  toMyPlace,
  toNeighborhood,
  toNeighborhoods,
  toRentalCheck,
  toUnit,
  toWelcome,
} from "@/landing/links";
import type { StepId, StepLink } from "../../../convex/lib/homeTimeline";

/** A step's destination, through the `links.ts` helpers. */
export function stepLink(link: StepLink): LinkOptions {
  switch (link.to) {
    case "welcome":
      return toWelcome();
    case "find":
      return toFind();
    case "neighborhoods":
      return toNeighborhoods();
    case "neighborhood":
      return toNeighborhood(link.slug);
    case "compare":
      return toCompare(link.a, link.b);
    case "rental":
      return toRentalCheck(link.listingId);
    case "place":
      return toMyPlace();
    case "unit":
      return toUnit();
    case "crew":
      return toCrew();
    case "journeys":
      return toJourneys();
    case "moveOut":
      return toMoveOut();
  }
}

export const STEP_ICONS: Record<StepId, LucideIcon> = {
  setUpProfile: CircleUserRound,
  findRentals: Search,
  exploreNeighborhoods: MapIcon,
  compareNeighborhoods: Columns2,
  takePlace: KeyRound,
  joinCrew: UsersRound,
  markMovedIn: House,
  moverQuotes: Truck,
  planUnit: Box,
  addRoom: Camera,
  checkIn: CalendarCheck,
  trackItems: Package,
  exploreHome: MapPin,
  markMovedOut: DoorOpen,
  sublet: BedDouble,
  sellItems: Tag,
};

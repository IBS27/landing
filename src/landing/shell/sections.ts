import {
  CircleUserRound,
  House,
  Inbox,
  type LucideIcon,
  PackageOpen,
  Search,
  Sofa,
  UsersRound,
} from "lucide-react";

export type LandingSection = {
  label: string;
  to: string;
  Icon: LucideIcon;
  description: string;
};

/** Landing's main sections, in the order of the move: find → move in → settle → move out. */
export const SECTIONS = [
  {
    label: "Home",
    to: "/landing",
    Icon: House,
    description: "Your move to San Francisco at a glance.",
  },
  {
    label: "Find",
    to: "/landing/find",
    Icon: Search,
    description: "Apartments and neighborhoods tuned to your City Profile.",
  },
  {
    label: "My Place",
    to: "/landing/place",
    Icon: Sofa,
    description: "Move in, decorate and run the house with your roommates.",
  },
  {
    label: "Crew & Journeys",
    to: "/landing/crew",
    Icon: UsersRound,
    description: "Your Move-in Crew and a plan for your first 90 days.",
  },
  {
    label: "Move out",
    to: "/landing/move-out",
    Icon: PackageOpen,
    description: "Sell what you own and sublease your place.",
  },
] as const satisfies readonly LandingSection[];

/** Below a divider in the nav: things about you rather than a stage of the move. */
export const YOU_SECTIONS = [
  {
    label: "City Profile",
    to: "/landing/profile",
    Icon: CircleUserRound,
    description: "What Landing knows about you, and what it uses it for.",
  },
  {
    label: "Inbox",
    to: "/landing/inbox",
    Icon: Inbox,
    description: "Messages Muse drafted for you, waiting for your OK.",
  },
] as const satisfies readonly LandingSection[];

const ALL: readonly LandingSection[] = [...SECTIONS, ...YOU_SECTIONS];

/** The section a Landing path belongs to (longest matching prefix). */
export function sectionFor(path: string): LandingSection | undefined {
  return ALL.filter((s) => path === s.to || path.startsWith(`${s.to}/`)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];
}

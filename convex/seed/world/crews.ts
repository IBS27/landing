import type { MatchBy } from "../../lib/crews";

/**
 * Move-in Crew opt-ins for the seed (#30), keyed by username. Each person needs
 * a City Profile (`world/cityProfiles.ts`). Leo has a profile but hasn't joined,
 * so the opt-in can be demoed; Priya, Jordan and Derek have no profile yet.
 */
export const crewOptInSeeds: { username: string; matchBy: MatchBy; daysAgo: number }[] = [
  {
    username: "maya.chen",
    matchBy: { month: true, neighborhood: true, employer: true },
    daysAgo: 5,
  },
  {
    username: "marcus.bell",
    matchBy: { month: true, neighborhood: true, employer: true },
    daysAgo: 10,
  },
  {
    username: "sofia.alvarez",
    matchBy: { month: true, neighborhood: true, employer: false },
    daysAgo: 12,
  },
  {
    username: "tasha.okafor",
    matchBy: { month: true, neighborhood: true, employer: false },
    daysAgo: 7,
  },
  {
    username: "zoe.nguyen",
    matchBy: { month: true, neighborhood: true, employer: false },
    daysAgo: 4,
  },
  {
    username: "daniel.reyes",
    matchBy: { month: true, neighborhood: true, employer: false },
    daysAgo: 6,
  },
  {
    username: "ethan.park",
    matchBy: { month: true, neighborhood: true, employer: true },
    daysAgo: 1,
  },
];

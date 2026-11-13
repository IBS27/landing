import type {
  FactValue,
  GoalId,
  NeighborhoodSlug,
  TransportMode,
} from "../../lib/cityProfileFacts";
import type { InterestId } from "../../lib/interests";

/**
 * Landing City Profiles for the seeded personas (#3), keyed by username. Each
 * reads clearly differently so personalization shows in demos. Personas left
 * out (priya.raman, jordan.kim, derek.holloway) have no profile yet, so the
 * onboarding brief can be demoed from scratch.
 *
 * Inferred interests aren't authored here: the seed derives them from each
 * persona's real Group joins and Event RSVPs (see `convex/seed/cityProfiles.ts`).
 */
export type CityProfileSeed = {
  username: string;
  budget: FactValue<"budget">;
  /** Move-in month, counted from seed time. */
  moveInMonthsFromNow: number;
  /**
   * Already moved in this many days ago (the move-in date is set, and the month
   * comes from it instead of `moveInMonthsFromNow`). Journeys (#32) run for the
   * first 90 days after it.
   */
  moveInDaysAgo?: number;
  neighborhoods: NeighborhoodSlug[];
  transport: TransportMode[];
  schedule: FactValue<"schedule">;
  /** Use the persona's current job from their Facebook profile as the employer fact. */
  employerFromWork?: boolean;
  interests: InterestId[];
  goals: GoalId[];
  /** When they filled the brief. */
  briefDaysAgo: number;
};

export const cityProfileSeeds: CityProfileSeed[] = [
  {
    // Mission climber without a car.
    username: "maya.chen",
    budget: { min: 1800, max: 2400 },
    moveInMonthsFromNow: 0,
    moveInDaysAgo: 16,
    neighborhoods: ["mission", "bernal-heights"],
    transport: ["walk", "bike", "muni", "bart"],
    schedule: { workHours: "day", workplace: "hybrid", weekendsFree: true },
    employerFromWork: true,
    interests: ["climbing", "coffee", "live_music", "making_art", "hiking"],
    goals: ["find_place", "meet_people", "furnish_place"],
    briefDaysAgo: 6,
  },
  {
    // SoMa tech worker on Caltrain: commutes down the Peninsula, just landed in the Mission.
    username: "marcus.bell",
    budget: { min: 3000, max: 3800 },
    moveInMonthsFromNow: 0,
    neighborhoods: ["south-of-market", "mission"],
    transport: ["walk", "caltrain", "bart", "muni"],
    schedule: { workHours: "day", workplace: "office", weekendsFree: true },
    employerFromWork: true,
    interests: ["tech_meetups", "hackathons", "video_games", "restaurants", "watching_sports"],
    goals: ["furnish_place", "meet_people"],
    briefDaysAgo: 12,
  },
  {
    // Sunset surfer.
    username: "leo.novak",
    budget: { min: 1500, max: 2200 },
    moveInMonthsFromNow: 1,
    neighborhoods: ["sunset-parkside", "inner-sunset"],
    transport: ["bike", "muni"],
    schedule: { workHours: "day", workplace: "hybrid", weekendsFree: true },
    employerFromWork: true,
    interests: ["surfing", "beach_days", "coffee", "hiking", "volunteering"],
    goals: ["find_place", "meet_people", "explore_city"],
    briefDaysAgo: 3,
  },
  {
    // Not a persona: an engineer whose lease ends the month Maya moves, looking
    // for a roommate in the Mission, so her roommate candidates (#22) show a
    // friend of friends with the same plans.
    username: "luis.hernandez",
    budget: { min: 2000, max: 2600 },
    moveInMonthsFromNow: 0,
    moveInDaysAgo: 16,
    neighborhoods: ["mission", "noe-valley"],
    transport: ["bike", "bart"],
    schedule: { workHours: "day", workplace: "office", weekendsFree: true },
    interests: ["cycling", "cooking", "board_games", "hiking", "coffee"],
    goals: ["find_roommates", "find_place"],
    briefDaysAgo: 4,
  },
  {
    // Night-shift nurse at SF General who climbs and keeps a car for the commute home.
    username: "sofia.alvarez",
    budget: { min: 2200, max: 2900 },
    moveInMonthsFromNow: 2,
    neighborhoods: ["potrero-hill", "bernal-heights"],
    transport: ["car", "muni"],
    schedule: { workHours: "night", workplace: "office", weekendsFree: false },
    employerFromWork: true,
    interests: ["climbing", "yoga", "hiking", "camping", "cooking"],
    goals: ["find_roommates", "build_routine"],
    briefDaysAgo: 20,
  },
  {
    // Hayes Valley runner and board-gamer who already knows everyone.
    username: "tasha.okafor",
    budget: { min: 1600, max: 2100 },
    moveInMonthsFromNow: 2,
    neighborhoods: ["hayes-valley", "western-addition"],
    transport: ["walk", "bike", "muni"],
    schedule: { workHours: "day", workplace: "office", weekendsFree: true },
    interests: ["running", "board_games", "coffee", "trivia", "live_music"],
    goals: ["meet_people", "build_routine"],
    briefDaysAgo: 9,
  },
  // Three Cal students moving to SF after graduation, the same month as Maya, so
  // her Move-in Crew (#30) has people in it.
  {
    // Design student and film photographer.
    username: "zoe.nguyen",
    budget: { min: 1500, max: 2100 },
    moveInMonthsFromNow: 0,
    moveInDaysAgo: 16,
    neighborhoods: ["mission", "inner-sunset"],
    transport: ["walk", "muni", "bart"],
    schedule: { workHours: "day", workplace: "hybrid", weekendsFree: true },
    interests: ["photography", "making_art", "coffee", "climbing", "live_music"],
    goals: ["meet_people", "find_place"],
    briefDaysAgo: 5,
  },
  {
    // Mechanical engineer who runs the fire trails at 6am.
    username: "daniel.reyes",
    budget: { min: 1700, max: 2300 },
    moveInMonthsFromNow: 0,
    moveInDaysAgo: 16,
    neighborhoods: ["bernal-heights", "noe-valley"],
    transport: ["bike", "bart"],
    schedule: { workHours: "day", workplace: "office", weekendsFree: true },
    interests: ["running", "hiking", "climbing", "camping", "board_games"],
    goals: ["meet_people", "explore_city"],
    briefDaysAgo: 8,
  },
  {
    // CS new grad starting at Salesforce.
    username: "ethan.park",
    budget: { min: 1800, max: 2600 },
    moveInMonthsFromNow: 0,
    moveInDaysAgo: 16,
    neighborhoods: ["south-of-market", "mission"],
    transport: ["walk", "muni", "bart"],
    schedule: { workHours: "day", workplace: "office", weekendsFree: true },
    employerFromWork: true,
    interests: ["tech_meetups", "board_games", "coffee", "video_games", "hackathons"],
    goals: ["meet_people", "find_roommates"],
    briefDaysAgo: 2,
  },
];

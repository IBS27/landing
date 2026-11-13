import type { TimeSpec } from "../lib/time";
import { daysAgo, hoursAgo } from "../lib/time";
import type { Username } from "./people";

/** Maya's 38 friends. Her friendships are exactly this list (circles never add to it). */
export const mayaFriends = [
  // Cal
  "ethan.park",
  "ana.torres",
  "hannah.lee",
  "noah.williams",
  "zoe.nguyen",
  "olivia.brooks",
  "isaiah.thompson",
  "amara.diallo",
  "ryan.oconnor",
  "mei.tanaka",
  "daniel.reyes",
  "fatima.hassan",
  "tyler.jensen",
  "chloe.wright",
  "samir.khan",
  "theo.grant",
  "rohan.iyer",
  "priya.raman",
  "jordan.kim",
  // hometown & family
  "jessica.huang",
  "kevin.tran",
  "emily.chen",
  // Google internship
  "rachel.goldberg",
  "chris.adeyemi",
  "nina.petrova",
  // climbing
  "sofia.alvarez",
  "kai.nakamura",
  "grace.liu",
  "arjun.mehta",
  "lena.fischer",
  // the Mission & around
  "tasha.okafor",
  "jasmine.ortiz",
  "harper.quinn",
  "malik.johnson",
  "diego.morales",
  "sophie.dubois",
  "owen.murphy",
  "maddie.collins",
] as const satisfies readonly Username[];

/** Friends Maya made recently (drives "accepted your friend request" notifications). */
export const mayaRecentFriends = {
  "maddie.collins": daysAgo(4, "18:12"),
  "owen.murphy": daysAgo(9, "10:40"),
} as const satisfies Partial<Record<Username, TimeSpec>>;

/**
 * Social circles. Pairs inside a circle become friends with probability
 * `density` (seeded). Pairs involving Maya are skipped: see `mayaFriends`.
 * A circle's `seed` (or its `name` when it has none) seeds that RNG, so changing it reshuffles
 * that circle's friendships. `seed` keeps an older name's RNG input, so a renamed circle keeps
 * the same friend graph. Check the graph (and persona friend counts) when you change either.
 */
export const circles = [
  {
    name: "cal",
    seed: "uw",
    density: 0.42,
    members: [
      "ethan.park",
      "ana.torres",
      "hannah.lee",
      "noah.williams",
      "zoe.nguyen",
      "olivia.brooks",
      "isaiah.thompson",
      "amara.diallo",
      "ryan.oconnor",
      "mei.tanaka",
      "daniel.reyes",
      "fatima.hassan",
      "tyler.jensen",
      "chloe.wright",
      "samir.khan",
      "theo.grant",
      "rohan.iyer",
      "priya.raman",
      "lily.anderson",
      "jiho.choi",
      "jordan.kim",
    ],
  },
  {
    name: "capstone",
    density: 1,
    members: ["ethan.park", "noah.williams", "zoe.nguyen", "samir.khan"],
  },
  { name: "dorm", density: 1, members: ["ana.torres", "hannah.lee", "priya.raman"] },
  { name: "hometown", density: 1, members: ["jessica.huang", "kevin.tran", "emily.chen"] },
  {
    name: "google",
    density: 0.85,
    members: ["rachel.goldberg", "chris.adeyemi", "nina.petrova", "grace.liu", "marcus.bell"],
  },
  {
    name: "salesforce",
    seed: "amazon",
    density: 0.6,
    members: [
      "ryan.oconnor",
      "arjun.mehta",
      "kevin.tran",
      "rohan.iyer",
      "tara.singh",
      "noah.williams",
    ],
  },
  {
    name: "climbing",
    density: 0.75,
    members: [
      "sofia.alvarez",
      "kai.nakamura",
      "grace.liu",
      "arjun.mehta",
      "lena.fischer",
      "ben.carter",
      "andre.silva",
      "tara.singh",
    ],
  },
  {
    name: "nurses",
    density: 0.8,
    members: ["sofia.alvarez", "aisha.rahman", "andre.silva", "yuki.sato", "lily.anderson"],
  },
  {
    name: "mission",
    seed: "caphill",
    density: 0.6,
    members: [
      "jasmine.ortiz",
      "malik.johnson",
      "harper.quinn",
      "diego.morales",
      "marco.rossi",
      "camila.santos",
      "sam.rivera",
      "tasha.okafor",
      "ana.torres",
    ],
  },
  {
    name: "boardgames",
    density: 0.55,
    members: [
      "tasha.okafor",
      "tyler.jensen",
      "jiho.choi",
      "leo.novak",
      "nora.kowalski",
      "owen.murphy",
      "theo.grant",
      "sam.rivera",
    ],
  },
  {
    name: "startup",
    density: 0.9,
    members: ["owen.murphy", "nora.kowalski", "leo.novak", "rohan.iyer"],
  },
  {
    name: "runners",
    density: 0.6,
    members: [
      "daniel.reyes",
      "lily.anderson",
      "theo.grant",
      "maddie.collins",
      "luis.hernandez",
      "tasha.okafor",
    ],
  },
  {
    name: "oracle-park",
    density: 0.6,
    members: ["isaiah.thompson", "jamal.wilson", "luis.hernandez", "ryan.oconnor", "kevin.tran"],
  },
  {
    name: "clement-street",
    density: 0.8,
    members: [
      "derek.holloway",
      "will.foster",
      "erin.mcallister",
      "marco.rossi",
      "ben.carter",
      "maddie.collins",
    ],
  },
  {
    name: "grad",
    density: 0.7,
    members: ["jordan.kim", "samir.khan", "fatima.hassan", "sophie.dubois"],
  },
] as const satisfies readonly {
  name: string;
  seed?: string;
  density: number;
  members: readonly Username[];
}[];

/** Friendships that don't fall out of a circle. */
export const extraFriendships = [
  ["derek.holloway", "jordan.kim"],
  ["marcus.bell", "leo.novak"],
  ["marcus.bell", "camila.santos"],
  ["priya.raman", "sophie.dubois"],
  ["emily.chen", "lily.anderson"],
  ["emily.chen", "yuki.sato"],
  ["sofia.alvarez", "tasha.okafor"],
  ["jordan.kim", "harper.quinn"],
  ["jessica.huang", "chloe.wright"],
  ["malik.johnson", "zoe.nguyen"],
  ["luis.hernandez", "jamal.wilson"],
  ["tara.singh", "maddie.collins"],
] as const satisfies readonly (readonly [Username, Username])[];

/** Pending friend requests. Six incoming to Maya, two outgoing, a few between others. */
export const friendRequests = [
  { from: "leo.novak", to: "maya.chen", at: hoursAgo(5) },
  { from: "jiho.choi", to: "maya.chen", at: daysAgo(1, "21:40") },
  { from: "lily.anderson", to: "maya.chen", at: daysAgo(2, "09:15") },
  { from: "andre.silva", to: "maya.chen", at: daysAgo(4, "23:05") },
  { from: "camila.santos", to: "maya.chen", at: daysAgo(6, "16:30") },
  { from: "ben.carter", to: "maya.chen", at: daysAgo(11, "12:00") },
  { from: "maya.chen", to: "sam.rivera", at: daysAgo(3, "19:20") },
  { from: "maya.chen", to: "aisha.rahman", at: daysAgo(8, "13:45") },
  { from: "leo.novak", to: "tasha.okafor", at: daysAgo(1, "22:10") },
  { from: "leo.novak", to: "jiho.choi", at: daysAgo(2, "20:00") },
  { from: "marcus.bell", to: "malik.johnson", at: daysAgo(3, "11:30") },
  { from: "yuki.sato", to: "priya.raman", at: daysAgo(5, "15:00") },
  { from: "erin.mcallister", to: "sofia.alvarez", at: daysAgo(2, "08:45") },
  { from: "nora.kowalski", to: "jordan.kim", at: daysAgo(7, "10:10") },
] as const satisfies readonly { from: Username; to: Username; at: TimeSpec }[];

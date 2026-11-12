import { daysAgo, hoursAgo } from "../lib/time";
import type { GroupSlug, TimeSpec, Username } from "../types";

/** Items Maya saved, by natural key. */
export const mayaSaved = {
  posts: [
    { key: "ledger-rent-report", collection: "Apartment hunt", at: daysAgo(2, "22:14") },
    { key: "jordan-scam-warning", collection: "Apartment hunt", at: daysAgo(6, "09:30") },
    { key: "fatima-sublet-post", collection: "Apartment hunt", at: daysAgo(3, "12:05") },
    { key: "kai-climbing-meetup", at: daysAgo(4, "17:40") },
    { key: "cascade-new-set", at: daysAgo(1, "19:02") },
    { key: "moonrise-holiday-menu", at: daysAgo(5, "08:11") },
    { key: "sofia-leavenworth", at: daysAgo(8, "21:47") },
    { key: "tasha-game-night-post", at: daysAgo(2, "13:20") },
  ],
  listings: [
    { key: "derek-caphill-1br", collection: "Apartment hunt", at: daysAgo(3, "23:10") },
    { key: "derek-fremont-2br", collection: "Apartment hunt", at: daysAgo(5, "22:41") },
    { key: "priya-wallingford-room", collection: "Apartment hunt", at: daysAgo(9, "16:16") },
    { key: "will-armchair", at: daysAgo(2, "10:00") },
    { key: "kai-crashpad", at: daysAgo(7, "18:30") },
    { key: "marco-camera", at: daysAgo(1, "20:25") },
  ],
  events: [
    { key: "low-tide-radio-show", at: daysAgo(4, "14:00") },
    { key: "caphill-art-walk", at: daysAgo(6, "11:45") },
    { key: "paper-lantern-author-night", at: daysAgo(10, "20:30") },
  ],
} as const satisfies Record<
  "posts" | "listings" | "events",
  readonly { key: string; collection?: string; at: TimeSpec }[]
>;

/** Group invites (the rest of the notification feed is derived from the world). */
export const groupInvites = [
  { from: "daniel.reyes", to: "maya.chen", group: "seattle-run-club", at: daysAgo(3, "07:55") },
  { from: "chloe.wright", to: "maya.chen", group: "seattle-foodies", at: daysAgo(9, "19:30") },
  { from: "marcus.bell", to: "leo.novak", group: "free-stuff-seattle", at: hoursAgo(20) },
  {
    from: "jordan.kim",
    to: "derek.holloway",
    group: "capitol-hill-neighbors",
    at: daysAgo(12, "09:00"),
  },
  { from: "grace.liu", to: "marcus.bell", group: "seattle-climbers", at: daysAgo(6, "12:30") },
] as const satisfies readonly { from: Username; to: Username; group: GroupSlug; at: TimeSpec }[];

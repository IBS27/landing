import { daysAgo, hoursAgo } from "../lib/time";
import type { StorySeed } from "../types";

/** Active stories (last 24h) from Maya's friends, newest first. */
export const stories: readonly StorySeed[] = [
  { by: "zoe.nguyen", photo: "gaming setup", text: "finals szn 😵", at: hoursAgo(0.5) },
  { by: "ethan.park", photo: "birthday cake", text: "22 🎂", at: hoursAgo(1.2) },
  { by: "jasmine.ortiz", photo: "latte art", text: "swan attempt #47", at: hoursAgo(2) },
  {
    by: "sofia.alvarez",
    photo: "bouldering gym",
    text: "the purple v5 finally",
    at: hoursAgo(3.5),
  },
  {
    by: "ana.torres",
    photo: "rainy street",
    text: "the 49 was 20 min late again",
    at: hoursAgo(4),
  },
  { by: "grace.liu", photo: "mount rainier", text: "the mountain is OUT", at: hoursAgo(5.5) },
  { by: "diego.morales", photo: "ramen", text: "staff meal hits different", at: hoursAgo(6) },
  { by: "jasmine.ortiz", photo: "coffee shop", at: hoursAgo(7.5) },
  {
    by: "kai.nakamura",
    photo: "climbing holds",
    text: "new set mon. no spoilers",
    at: hoursAgo(9),
  },
  { by: "hannah.lee", photo: "cat", text: "she has claimed my bed", at: hoursAgo(10) },
  { by: "zoe.nguyen", photo: "film camera", at: hoursAgo(12) },
  { by: "malik.johnson", photo: "band rehearsal", text: "friday at the owl 🦉", at: hoursAgo(14) },
  { by: "emily.chen", photo: "library", text: "midterm #3 survived", at: hoursAgo(16) },
  { by: "ethan.park", photo: "bubble tea", at: hoursAgo(19) },
  { by: "olivia.brooks", photo: "dog park", text: "met a corgi named waffles", at: hoursAgo(22) },

  // Maya's Story archive (expired stories, visible only to her).
  {
    by: "maya.chen",
    photo: "ramen",
    text: "midterm fuel",
    at: daysAgo(3, "21:10"),
    archived: true,
  },
  { by: "maya.chen", photo: "mount rainier", at: daysAgo(9, "08:40"), archived: true },
  {
    by: "maya.chen",
    photo: "latte art",
    text: "ana finally nailed the heart",
    at: daysAgo(16, "10:15"),
    archived: true,
  },
  {
    by: "maya.chen",
    photo: "rainy street",
    text: "november in seattle",
    at: daysAgo(24, "17:30"),
    archived: true,
  },
  {
    by: "maya.chen",
    photo: "library",
    text: "suzzallo szn",
    at: daysAgo(38, "14:05"),
    archived: true,
  },
  { by: "maya.chen", photo: "film camera", at: daysAgo(52, "12:00"), archived: true },
];

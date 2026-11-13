import type { LifestyleAnswers } from "../../lib/lifestyle";
import type { Username } from "./people";

export type RoommateLifestyleSeed = {
  readonly username: Username;
  readonly answers: LifestyleAnswers;
  /** Opted in to roommate matching. */
  readonly shared: boolean;
  readonly answeredDaysAgo: number;
};

/**
 * Roommate lifestyle answers (#21), keyed by username. Chosen so
 * candidates (#22) and the compatibility score (#23) show every outcome, seen
 * as Maya (her compatibility scores, #23: Luis 85, Tasha 73, Sofia 67, Camila
 * 60, Leo capped at 40):
 * - Tasha (her friend): same sleep and quiet hours, close on tidiness, and a cat.
 * - Leo (a friend of friends): his dog hits Maya's "Dogs" dealbreaker, and his
 *   smoking outside hits Tasha's "Any smoking or vaping".
 * - Sofia (her friend): sleeps during the day after night shifts and skipped
 *   the overnight guests and pets questions, so Maya's "Dogs" dealbreaker
 *   can't be checked against her.
 * - Camila (a friend of friends): Tasha vouches she lived with her, so she's
 *   "vouched for" and ranks above other friends of friends. A night owl with
 *   no set quiet hours, so she and Maya differ the most without a dealbreaker.
 * - Luis (a friend of friends): moves the same month as Maya, also wants the
 *   Mission, and their budgets overlap.
 * - Marcus has answers but keeps them private, so he never appears.
 * - Priya has none, so the questionnaire can be demoed from the start.
 */
export const roommateLifestyles: readonly RoommateLifestyleSeed[] = [
  {
    username: "maya.chen",
    shared: true,
    answeredDaysAgo: 6,
    answers: {
      sleep: "regular",
      quietHours: "10pm",
      cleanliness: "tidy",
      noise: "some",
      groceries: "basics",
      guests: "monthly",
      overnightGuests: "rarely",
      smoking: "no",
      pets: [],
      dealbreakers: ["smoking_inside", "dogs"],
    },
  },
  {
    username: "tasha.okafor",
    shared: true,
    answeredDaysAgo: 9,
    answers: {
      sleep: "regular",
      quietHours: "10pm",
      cleanliness: "very_tidy",
      noise: "quiet",
      groceries: "basics",
      guests: "weekly",
      overnightGuests: "sometimes",
      smoking: "no",
      pets: ["cat"],
      dealbreakers: ["smoking_any"],
    },
  },
  {
    username: "leo.novak",
    shared: true,
    answeredDaysAgo: 3,
    answers: {
      sleep: "early",
      quietHours: "9pm",
      cleanliness: "relaxed",
      noise: "some",
      groceries: "together",
      guests: "weekly",
      overnightGuests: "sometimes",
      smoking: "outside",
      pets: ["dog"],
      dealbreakers: [],
    },
  },
  {
    username: "sofia.alvarez",
    shared: true,
    answeredDaysAgo: 12,
    answers: {
      sleep: "days",
      quietHours: "11pm",
      cleanliness: "very_tidy",
      noise: "quiet",
      groceries: "separate",
      guests: "rarely",
      smoking: "no",
      dealbreakers: ["frequent_guests", "no_quiet_hours"],
    },
  },
  {
    username: "marcus.bell",
    shared: false,
    answeredDaysAgo: 20,
    answers: {
      sleep: "late",
      quietHours: "midnight",
      cleanliness: "tidy",
      noise: "lively",
      guests: "often",
      overnightGuests: "sometimes",
      smoking: "no",
      pets: [],
      dealbreakers: [],
    },
  },
  {
    username: "camila.santos",
    shared: true,
    answeredDaysAgo: 5,
    answers: {
      sleep: "late",
      quietHours: "none",
      cleanliness: "tidy",
      noise: "lively",
      groceries: "separate",
      guests: "weekly",
      overnightGuests: "sometimes",
      smoking: "no",
      pets: ["cat"],
      dealbreakers: ["smoking_inside"],
    },
  },
  {
    username: "luis.hernandez",
    shared: true,
    answeredDaysAgo: 2,
    answers: {
      sleep: "regular",
      quietHours: "11pm",
      cleanliness: "very_tidy",
      noise: "quiet",
      groceries: "basics",
      guests: "monthly",
      overnightGuests: "rarely",
      smoking: "no",
      pets: [],
      dealbreakers: ["smoking_any"],
    },
  },
];

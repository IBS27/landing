import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Weekend Routes (#18): rebuild every neighborhood's route on Thursday morning
 * in San Francisco, so it picks up the coming weekend's Events, and check daily
 * for neighborhoods with no route or a burst of new threads.
 */
crons.weekly(
  "rebuild weekend routes",
  { dayOfWeek: "thursday", hourUTC: 17, minuteUTC: 0 },
  internal.weekendRoutes.refreshAll,
  { force: true },
);
crons.daily(
  "refresh weekend routes with new threads",
  { hourUTC: 13, minuteUTC: 0 },
  internal.weekendRoutes.refreshAll,
  { force: false },
);

export default crons;

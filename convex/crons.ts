import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Neighborhood scores (#17) count Events in the next 30 days and Groups active in the last 30,
// so they're recomputed every day (early morning in San Francisco).
crons.daily(
  "neighborhood scores",
  { hourUTC: 11, minuteUTC: 0 },
  internal.neighborhoodScores.recompute,
  {},
);

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

/**
 * Journeys (#32): every morning in San Francisco, an hour after the Weekend
 * Route check, rebuild each person's Journey for the coming weekend so new
 * Events, RSVPs and routes show up. Builds are plain code, no model calls.
 */
crons.daily("rebuild journeys", { hourUTC: 14, minuteUTC: 0 }, internal.journeys.refreshAll, {
  force: true,
});

/**
 * Chat plans (#34): every hour, draft the Event for chat polls that closed and
 * the day-of reminder for today's Events. Both wait in Landing Inbox for the
 * owner's OK. Plain code, no model calls.
 */
crons.hourly("chat plans", { minuteUTC: 5 }, internal.chatPlans.tick, {});

/**
 * Day-of Event reminders (#134): every hour, notify people going to Events
 * whose reminder time has come (8am in San Francisco, or 2 hours before an
 * earlier start). Each person hears once per Event. Plain code, no model calls.
 */
crons.hourly("event day-of reminders", { minuteUTC: 0 }, internal.reminders.tick, {});

export default crons;

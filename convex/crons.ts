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

export default crons;

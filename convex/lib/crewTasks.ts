import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { defineTask } from "../ai/agent";
import type { Source } from "../validators";
import { blockedSet } from "./blocks";
import { getProfile } from "./cityProfile";
import { moveInLabel, type NeighborhoodSlug, neighborhoodLabel } from "./cityProfileFacts";
import { crewFor } from "./crewMembers";
import {
  getInterest,
  type InterestId,
  interestsForEvent,
  interestsForGroup,
  interestsInText,
} from "./interests";
import { pacificDate, pacificDateStart } from "./weekendRoute";

/**
 * Crew Group, intros and first meetup (#31). Muse writes the crew's Group
 * (name and intro, with a first meetup idea from a real public Event or Group)
 * and later the meetup itself. Both become #6 proposals the person approves;
 * nothing here writes. With AI off, the templates below answer.
 *
 * Privacy: the input names, for each member, only the interests and anchors
 * they share with the owner (what the owner's Crew page already shows), never
 * an employer, and nothing else from anyone's City Profile.
 */

/** People invited to a crew Group: the best matches. */
export const CREW_GROUP_INVITES = 5;
/** How far ahead a first meetup can be. */
const MEETUP_WINDOW_MS = 42 * 24 * 60 * 60 * 1000;
/** Not so soon nobody can make it. */
const MEETUP_LEAD_MS = 2 * 60 * 60 * 1000;
const MEETUP_OPTIONS = 6;

export type MeetupOption = {
  /** The citation key (`event:<id>`, `group:<id>`). */
  source: string;
  kind: "event" | "group";
  title: string;
  /** "Wed, Nov 18, 6:30 PM" in San Francisco; null for a Group. */
  when: string | null;
  venue: string | null;
  /** Interests it fits that the crew shares with the owner. */
  fits: string[];
  /** How many invited members share one of those interests with the owner. */
  sharedBy: number;
};

/** The model's input for `muse.crewGroup` (and the template's). */
export type CrewGroupInput = {
  /** `moving` is the move-in month ("February 2027"); `moved` once it has passed. */
  owner: { firstName: string; moving: string | null; moved: boolean };
  /** The owner's move-in month when most of the crew shares it ("February 2027"), else null. */
  commonMonth: string | null;
  /** The neighborhood most of the crew shares with the owner, if any ("Mission"). */
  commonPlace: string | null;
  members: {
    firstName: string;
    /** Interests they share with the owner. */
    sharedInterests: string[];
    /** "same move-in month (February 2027)", "both looking in the Mission". */
    together: string[];
  }[];
  meetupOptions: MeetupOption[];
};

export type CrewContext = {
  input: CrewGroupInput;
  /** The invited members, in the same order as `input.members`. */
  inviteIds: Id<"users">[];
  /** Every option's source, for `runAgent` and citations. */
  sources: Source[];
  /** Event options' times and venues, by source key, so the model can't invent them. */
  events: Record<string, { eventId: Id<"events">; startAt: number; venue: string | null }>;
  /** When the owner arrives, if that's still ahead: meetups are only looked for from then on. */
  arrivesAt: number | null;
};

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Everything a crew proposal needs, or null when the owner hasn't opted in or
 * has no crew. `eventsOnly` limits meetup options to Events (the meetup needs
 * a time); otherwise public Groups are used when no Event fits.
 */
export async function crewContext(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  opts: { eventsOnly: boolean; now?: number },
): Promise<CrewContext | null> {
  const now = opts.now ?? Date.now();
  const crew = await crewFor(ctx, ownerId);
  if (!crew || crew.matches.length === 0) return null;
  const [owner, profile, blocked] = await Promise.all([
    ctx.db.get(ownerId),
    getProfile(ctx, ownerId),
    blockedSet(ctx, ownerId),
  ]);
  if (!owner) return null;

  const matches = crew.matches.slice(0, CREW_GROUP_INVITES);
  const users = await Promise.all(matches.map((m) => ctx.db.get(m.userId as Id<"users">)));
  const members: CrewGroupInput["members"] = [];
  const inviteIds: Id<"users">[] = [];
  const memberInterests: InterestId[][] = [];
  const places = new Map<NeighborhoodSlug, number>();
  let sameMonth = 0;
  matches.forEach((m, i) => {
    const u = users[i];
    if (!u) return;
    const together: string[] = [];
    for (const a of m.anchors) {
      if (a.kind === "month") {
        together.push(`same move-in month (${moveInLabel({ month: a.month })})`);
        sameMonth++;
      }
      if (a.kind === "neighborhood") {
        together.push(`both looking in ${a.slugs.map(neighborhoodLabel).join(", ")}`);
        for (const s of a.slugs) places.set(s, (places.get(s) ?? 0) + 1);
      }
      // Employers are never named in an intro.
    }
    // Only interests both people stated: an intro never claims an inference.
    const shared = m.stated as InterestId[];
    members.push({
      firstName: u.firstName,
      sharedInterests: shared.map((id) => getInterest(id).label),
      together,
    });
    inviteIds.push(u._id);
    memberInterests.push(shared);
  });
  if (members.length === 0) return null;

  // A first meetup is in San Francisco, so not before the owner gets there.
  const moveIn = profile.moveIn?.source === "stated" ? profile.moveIn.value : null;
  const arrival = moveIn ? pacificDateStart(moveIn.date ?? `${moveIn.month}-01`) : null;
  const from = Math.max(now + MEETUP_LEAD_MS, arrival ?? 0);

  // Meetup options: upcoming public Events the crew's shared interests fit.
  const crewInterests = new Set(memberInterests.flat());
  const sharedByOf = (fits: InterestId[]) =>
    memberInterests.filter((ids) => ids.some((id) => fits.includes(id))).length;
  const upcoming = await ctx.db
    .query("events")
    .withIndex("by_start", (q) => q.gt("startAt", from).lt("startAt", from + MEETUP_WINDOW_MS))
    .take(300);
  const publicEvents = [];
  // In the city they're moving to, public, in person, with a host they can see.
  for (const e of upcoming)
    if (
      e.privacy === "public" &&
      !e.online &&
      !blocked.has(e.hostId) &&
      /san francisco/i.test(e.city) &&
      (await ctx.db.get(e.hostId))
    )
      publicEvents.push(e);
  // An Event whose title names the activity ("climbing night") beats one that
  // only fits through its broad category ("Fitness").
  const ranked = publicEvents
    .map((e) => {
      const fits = interestsForEvent(e).filter((id) => crewInterests.has(id));
      const named = interestsInText(e.title).some((id) => crewInterests.has(id));
      return { e, fits, sharedBy: sharedByOf(fits), named };
    })
    .sort(
      (a, b) =>
        b.sharedBy - a.sharedBy || Number(b.named) - Number(a.named) || a.e.startAt - b.e.startAt,
    );
  // Only Events something the crew shares fits: never a stand-in that fits nobody.
  const chosen = ranked.filter((r) => r.sharedBy > 0).slice(0, MEETUP_OPTIONS);

  const meetupOptions: MeetupOption[] = [];
  const sources: Source[] = [];
  const events: CrewContext["events"] = {};
  for (const { e, fits, sharedBy } of chosen) {
    const key = `event:${e._id}`;
    meetupOptions.push({
      source: key,
      kind: "event",
      title: e.title,
      when: WHEN.format(e.startAt),
      venue: e.venue ?? null,
      fits: fits.map((id) => getInterest(id).label),
      sharedBy,
    });
    sources.push({ kind: "event", eventId: e._id });
    events[key] = { eventId: e._id, startAt: e.startAt, venue: e.venue ?? null };
  }

  // No Event fits: public Groups about what the crew shares (a Group meetup idea needs no time).
  if (!opts.eventsOnly && chosen.length === 0) {
    const groups = await ctx.db.query("groups").withIndex("by_activity").order("desc").take(100);
    const fitting = groups
      .filter((g) => g.privacy === "public" && g.visible)
      .map((g) => {
        const fits = interestsForGroup(g).filter((id) => crewInterests.has(id));
        return { g, fits, sharedBy: sharedByOf(fits) };
      })
      .filter((r) => r.sharedBy > 0)
      .sort((a, b) => b.sharedBy - a.sharedBy)
      .slice(0, 4);
    for (const { g, fits, sharedBy } of fitting) {
      meetupOptions.unshift({
        source: `group:${g._id}`,
        kind: "group",
        title: g.name,
        when: null,
        venue: null,
        fits: fits.map((id) => getInterest(id).label),
        sharedBy,
      });
      sources.unshift({ kind: "group", groupId: g._id });
    }
  }

  const today = pacificDate(now);
  const moved = moveIn
    ? moveIn.date
      ? moveIn.date <= today
      : moveIn.month < today.slice(0, 7)
    : false;
  const moving = moveIn ? moveInLabel({ month: moveIn.month }) : null;
  const [place, count] = [...places.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return {
    input: {
      owner: { firstName: owner.firstName, moving, moved },
      members,
      meetupOptions,
      // The Group is named for a month only when it's most of the crew's, not just the owner's.
      commonMonth: moving && sameMonth * 2 >= members.length ? moving : null,
      commonPlace: place && count * 2 >= members.length ? neighborhoodLabel(place) : null,
    },
    inviteIds,
    sources,
    events,
    arrivesAt: arrival !== null && arrival > now ? arrival : null,
  };
}

/* ---------------- Templates (AI off) ---------------- */

function list(names: string[]) {
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
}

/**
 * "February Move-in Crew · Mission" from the crew's common month ("February
 * 2027") and place, or "SF Move-in Crew" without them: at most 75 characters.
 */
export function crewGroupName(commonMonth: string | null, commonPlace: string | null): string {
  const month = commonMonth?.split(" ")[0];
  const base = month ? `${month} Move-in Crew` : "SF Move-in Crew";
  const name = commonPlace ? `${base} · ${commonPlace}` : base;
  return name.slice(0, 75);
}

/**
 * The template intro: who's moving when, and the interests each named member
 * shares with the owner ("Zoe, Daniel and I are all into climbing").
 */
export function crewIntro(input: CrewGroupInput): string {
  const byInterest = new Map<string, string[]>();
  for (const m of input.members)
    for (const label of m.sharedInterests)
      byInterest.set(label, [...(byInterest.get(label) ?? []), m.firstName]);
  const top = [...byInterest.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  // Interests shared by the same people read as one line: "Ethan and I are both into hackathons and tech".
  const byPeople = new Map<string, { names: string[]; labels: string[] }>();
  for (const [label, names] of top) {
    const key = names.join("|");
    const row = byPeople.get(key) ?? { names, labels: [] };
    row.labels.push(label.toLowerCase());
    byPeople.set(key, row);
  }
  const lines = [...byPeople.values()]
    .slice(0, 2)
    .map(({ names, labels }) =>
      names.length > 1
        ? `${list([...names, "I"])} are all into ${list(labels)}`
        : `${names[0]} and I are both into ${list(labels)}`,
    );
  const moving = !input.owner.moving
    ? ""
    : input.owner.moved
      ? `. I moved to SF in ${input.owner.moving}`
      : `, moving to SF in ${input.owner.moving}`;
  const why = lines.length ? `: ${lines.join(", and ")}` : "";
  return `Hi! I'm ${input.owner.firstName}${moving}. Muse matched us as a Move-in Crew${why}. Say hi, and let's plan a first meetup!`;
}

/** The option most of the crew fits, soonest first (options arrive ranked). */
export function pickMeetup(options: MeetupOption[]): MeetupOption | null {
  return [...options].sort((a, b) => b.sharedBy - a.sharedBy)[0] ?? null;
}

export function meetupIdea(o: MeetupOption): string {
  if (o.kind === "group") return `Pick something from ${o.title} to do together.`;
  const where = o.venue && !o.title.includes(o.venue) ? ` at ${o.venue}` : "";
  return `${o.title}${where}, ${o.when}.`;
}

/** One line on why these people: what each shares with the owner, nothing more. */
export function crewRationale(input: CrewGroupInput): string {
  const names = input.members.map((m) => m.firstName);
  const sameMonth = input.members
    .filter((m) => m.together.some((t) => t.startsWith("same move-in month")))
    .map((m) => m.firstName);
  const interests = [...new Set(input.members.flatMap((m) => m.sharedInterests))].slice(0, 3);
  const parts = [`Your Move-in Crew: ${list(names)}`];
  if (sameMonth.length && input.owner.moving)
    parts.push(
      `${list(sameMonth)} ${sameMonth.length > 1 ? "share" : "shares"} your move-in month`,
    );
  if (interests.length) parts.push(`you share ${list(interests.map((i) => i.toLowerCase()))}`);
  return `${parts.join("; ")}.`.slice(0, 200);
}

/** Why this Event for the first meetup: the shared interests it fits, and how many share them. */
export function meetupRationale(groupName: string, o: MeetupOption): string {
  const who =
    o.sharedBy === 1 ? "1 person in your crew shares" : `${o.sharedBy} people in your crew share`;
  return `The first meetup for ${groupName}: ${o.title} fits ${list(o.fits.map((f) => f.toLowerCase()))}, which ${who} with you.`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ---------------- Muse tasks ---------------- */

const groupOutput = v.object({
  name: v.string(),
  intro: v.string(),
  meetupSource: v.string(),
  meetupIdea: v.string(),
  rationale: v.string(),
});

const GROUP_INSTRUCTIONS = `Draft a private Facebook Group for a Move-in Crew: people arriving in San Francisco around the same time who opted in to meet each other. The owner ("owner" in <input>) will post it after reviewing your draft. <input> has the owner, the members (each with only the interests and anchors they share with the owner) and meetupOptions, which are also the <sources>.

Return:
- name: the Group's name, at most 75 characters, e.g. "February Move-in Crew · Mission". Name a month only if it's commonMonth's (most of the crew arrives then), and a neighborhood only if it's commonPlace; otherwise "SF Move-in Crew".
- intro: the Group's description in the owner's voice (first person, at most 600 characters). Say hi, say when they're moving (or, if owner.moved, when they moved), and say what people have in common, naming members only with interests listed for them ("Zoe, Daniel and I all climb"). Warm, plain, no hashtags.
- meetupSource: the source key of the one meetup option that fits the most people.
- meetupIdea: one line naming that option as a first meetup, with its day and time when it has one.
- rationale: one sentence for the owner on why these people (at most 200 characters).

Only use what <input> says. Never mention where anyone works, and never describe who someone is (age, gender, culture, religion, family or health).`;

/** `muse.crewGroup`: the crew Group's name and intro, and a first meetup idea from a cited option. */
export const crewGroupTask = defineTask({
  agent: "muse",
  name: "muse.crewGroup",
  instructions: GROUP_INSTRUCTIONS,
  output: groupOutput,
  cites: (o) => [o.meetupSource],
  check: (o, input: CrewGroupInput) => {
    const problems: string[] = [];
    const name = o.name.trim();
    if (name.length < 3 || name.length > 75) problems.push("name: 3–75 characters");
    const month = input.commonMonth?.split(" ")[0];
    const named = MONTHS.filter((m) => new RegExp(`\\b${m}\\b`, "i").test(name));
    if (named.some((m) => m !== month))
      problems.push(
        month
          ? `name: the only month to name is ${month}, most of the crew's`
          : "name: don't name a month; the crew arrives in different months",
      );
    if (o.intro.trim().length < 20 || o.intro.length > 600)
      problems.push("intro: 20–600 characters");
    if (!input.members.some((m) => o.intro.includes(m.firstName)))
      problems.push("intro: name at least one member");
    if (!input.meetupOptions.some((m) => m.source === o.meetupSource))
      problems.push(`meetupSource "${o.meetupSource}" isn't one of the meetupOptions`);
    if (!o.meetupIdea.trim() || o.meetupIdea.length > 200)
      problems.push("meetupIdea: 1–200 characters");
    if (!o.rationale.trim() || o.rationale.length > 200)
      problems.push("rationale: 1–200 characters");
    return problems;
  },
  fallback: (input) => {
    const pick = pickMeetup(input.meetupOptions);
    return {
      name: crewGroupName(input.commonMonth, input.commonPlace),
      intro: crewIntro(input),
      meetupSource: pick?.source ?? "",
      meetupIdea: pick ? meetupIdea(pick) : "",
      rationale: crewRationale(input),
    };
  },
  effort: "low",
  maxAttempts: 2,
});

/** The model's input for `muse.crewMeetup`. */
export type CrewMeetupInput = {
  groupName: string;
  members: string[];
  options: MeetupOption[];
};

const meetupOutput = v.object({
  eventSource: v.string(),
  title: v.string(),
  description: v.string(),
});

const MEETUP_INSTRUCTIONS = `Plan the first meetup for a Move-in Crew's Group (<input>.groupName). Pick the one option in <input>.options (also the <sources>, all real upcoming public Events) that most of the crew would enjoy, and write the crew Event for going together.

Return:
- eventSource: the chosen option's source key.
- title: at most 80 characters, e.g. "Crew night at Bay Area Climbers Meetup".
- description: at most 400 characters, in the owner's voice: what it is, where to meet, and that newcomers are welcome. Don't change the time or place: they come from the option.`;

/** `muse.crewMeetup`: the crew's first meetup, at a cited public Event. */
export const crewMeetupTask = defineTask({
  agent: "muse",
  name: "muse.crewMeetup",
  instructions: MEETUP_INSTRUCTIONS,
  output: meetupOutput,
  cites: (o) => [o.eventSource],
  check: (o, input: CrewMeetupInput) => {
    const problems: string[] = [];
    if (!input.options.some((x) => x.kind === "event" && x.source === o.eventSource))
      problems.push(`eventSource "${o.eventSource}" isn't one of the options`);
    if (!o.title.trim() || o.title.length > 80) problems.push("title: 1–80 characters");
    if (!o.description.trim() || o.description.length > 400)
      problems.push("description: 1–400 characters");
    return problems;
  },
  fallback: (input) => {
    const pick = pickMeetup(input.options.filter((x) => x.kind === "event"));
    return {
      eventSource: pick?.source ?? "",
      title: pick ? `Crew meetup: ${pick.title}`.slice(0, 80) : "Crew meetup",
      description: pick
        ? `Our first crew meetup! Let's go to ${pick.title}${pick.venue && !pick.title.includes(pick.venue) ? ` at ${pick.venue}` : ""} together. New to the city? Perfect, so are we.`
        : "First crew meetup.",
    };
  },
  effort: "low",
  maxAttempts: 2,
});

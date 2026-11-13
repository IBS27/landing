import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { defineTask } from "../ai/agent";
import { NEIGHBORHOOD_PLACES } from "../seed/world/neighborhoods/places";
import type { Source } from "../validators";
import { blockedSet } from "./blocks";
import {
  getInterest,
  type InterestId,
  type InterestSection,
  interestsForEvent,
  interestsForGroup,
  interestsInText,
  normalize,
} from "./interests";
import { placesMentioned } from "./places";
import { inConversation } from "./proposals";
import { getSummaries } from "./users";
import { pacificDateStart, weekendOf } from "./weekendRoute";

/**
 * Turn crew chat into real plans (#34). Plain code spots plan talk in group
 * chats ("we should hike sometime"); Muse (`muse.chatPlan`) suggests a place,
 * route and times from cited sources and code-made options; the poll, the
 * Event and the day-of reminder each go through the approval queue (#6).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const CHAT_PLAN_TASK = "muse.chatPlan";
export const CHAT_PLAN_EVENT_TASK = "muse.chatPlanEvent";
export const CHAT_PLAN_REMINDER_TASK = "muse.chatPlanReminder";

/* ---------- Spotting plan talk (plain code) ---------- */

/** How far back talk counts, and how much of each chat is read. */
export const TALK_WINDOW_MS = 21 * DAY;
export const CHATS_SCANNED = 12;
export const MESSAGES_SCANNED = 40;
/** Replies this soon after the talk count as chiming in. */
const CHIME_WINDOW_MS = 2 * DAY;

/** "we should…", "let's…", "anyone down to…", "…sometime". */
const CUE =
  /\b(we|u|you guys|y'?all|yall) (should|gotta|need to|have to|could)\b|\blet'?s\b|\b(anyone|any1|who'?s|whos) (down|up|in|wanna|want)\b|\bshould (we|all)\b|\b(wanna|want to) (go|get|grab|try|do)\b|\b(some ?time|one of these (days|weekends|saturdays|sundays|nights)|at some point)\b/i;
/** "we should have…", "we went…": talk about the past isn't a plan. */
const PAST = /\bshould(n'?t)?\s*(have|'ve|of)\b|\bwe (did|went)\b/i;
/** "yes!!", "i'm in", "down", "count me in", 🙋. */
const YES =
  /^\s*(yes+|ye+a+h*|yep|yup|ok+|okay|sure|same|me+( too)?|down|in|deal|bet|absolutely|totally|definitely|for sure|100|omg yes)\b|\b(i'?m in|im in|count me in|i'?m down|im down|so down|let'?s do it|lets do it|i'?d be down|i'?d love (that|to)|sign me up)\b|🙋|🙌|\+1/i;

/** The activity a message floats as a plan, or null when it isn't plan talk. */
export function planTalkActivity(text: string): InterestId | null {
  if (!CUE.test(text) || PAST.test(text)) return null;
  return interestsInText(text)[0] ?? null;
}

export type ChatLine = { _id: string; senderId: string; text: string; createdAt: number };
export type Talk = {
  messageId: string;
  senderId: string;
  text: string;
  createdAt: number;
  activity: InterestId;
  /** Other people who said yes or brought up the same thing soon after. */
  chimedIn: string[];
};

/**
 * Plan talk in one chat (lines oldest first), newest first: for each activity,
 * the first message in the window that floated it and who chimed in.
 */
export function spotTalk(lines: readonly ChatLine[], now: number): Talk[] {
  const first = new Map<InterestId, number>();
  lines.forEach((l, i) => {
    if (l.createdAt < now - TALK_WINDOW_MS) return;
    const activity = planTalkActivity(l.text);
    if (activity && !first.has(activity)) first.set(activity, i);
  });
  const out: Talk[] = [];
  for (const [activity, i] of first) {
    const l = lines[i];
    if (!l) continue;
    const chimed = new Set<string>();
    for (const r of lines.slice(i + 1)) {
      if (r.createdAt > l.createdAt + CHIME_WINDOW_MS) break;
      if (r.senderId === l.senderId) continue;
      if (YES.test(r.text) || interestsInText(r.text).includes(activity)) chimed.add(r.senderId);
    }
    out.push({
      messageId: l._id,
      senderId: l.senderId,
      text: l.text,
      createdAt: l.createdAt,
      activity,
      chimedIn: [...chimed],
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Messages people wrote and sent (not Muse's drafts, unsent ones or bare stickers). */
export function chatLines(rows: readonly Doc<"messages">[], blocked?: ReadonlySet<string>) {
  return rows
    .filter(
      (m) =>
        m.status === "sent" &&
        !m.unsent &&
        m.author.kind === "human" &&
        !!m.text?.trim() &&
        !blocked?.has(m.senderId),
    )
    .map(
      (m): ChatLine => ({
        _id: m._id,
        senderId: m.senderId,
        text: m.text ?? "",
        createdAt: m.createdAt,
      }),
    );
}

/** A group chat's name: its title, else its members' first names. */
export function chatTitle(conv: Doc<"conversations">, firstNames: readonly string[]): string {
  return conv.title?.trim() || nameList(firstNames) || "Group chat";
}

/* ---------- Times (plain code) ---------- */

const TZ = "America/Los_Angeles";
const CLOCK_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  hour: "numeric",
  minute: "numeric",
});
const DATE_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

/** "2026-11-21": the San Francisco date at `t`. */
export function sfDate(t: number): string {
  return DATE_KEY.format(t);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/** UTC ms of a wall-clock time on a San Francisco date, right on DST days too. */
export function sfTime(date: string, hour: number, minute = 0): number {
  const want = hour * 60 + minute;
  const t = pacificDateStart(date) + want * 60_000;
  const p = Object.fromEntries(CLOCK_PARTS.formatToParts(t).map((x) => [x.type, x.value]));
  const got = Number(p.hour) * 60 + Number(p.minute);
  return t + (want - got) * 60_000;
}

/** "10 AM", "8:30 PM". */
export function clockLabel(t: number): string {
  return TIME_LABEL.format(t).replace(":00", "").replace(/ /g, " ");
}

/** "Sat, Nov 21 · 10 AM". */
export function slotLabel(t: number): string {
  return `${DAY_LABEL.format(t)} · ${clockLabel(t)}`;
}

/** [days from Saturday, hour, minute]: -1 is Friday, 1 is Sunday. */
type SlotTime = readonly [number, number, number];
const SLOTS_BY_SECTION: Record<InterestSection, readonly SlotTime[]> = {
  active: [
    [0, 10, 0],
    [1, 10, 0],
    [0, 15, 0],
    [1, 15, 0],
  ],
  outdoors: [
    [0, 10, 0],
    [1, 10, 0],
    [0, 14, 0],
    [1, 14, 0],
  ],
  food: [
    [0, 11, 0],
    [1, 11, 0],
    [-1, 19, 0],
    [0, 19, 0],
  ],
  culture: [
    [0, 14, 0],
    [1, 14, 0],
    [0, 11, 0],
    [1, 11, 0],
  ],
  nights: [
    [-1, 20, 0],
    [0, 20, 0],
    [-2, 20, 0],
  ],
  play: [
    [-1, 19, 0],
    [0, 15, 0],
    [1, 15, 0],
  ],
  community: [
    [0, 11, 0],
    [1, 11, 0],
    [0, 14, 0],
  ],
};
const SLOTS_BY_INTEREST: Partial<Record<InterestId, readonly SlotTime[]>> = {
  farmers_markets: [
    [0, 9, 30],
    [1, 9, 30],
    [0, 11, 0],
  ],
  coffee: [
    [0, 10, 0],
    [1, 10, 0],
    [0, 14, 0],
  ],
  restaurants: [
    [-1, 19, 0],
    [0, 19, 0],
    [1, 11, 0],
  ],
  bars: [
    [-1, 19, 30],
    [0, 19, 30],
    [-2, 19, 0],
  ],
  climbing: [
    [-2, 18, 30],
    [0, 11, 0],
    [1, 11, 0],
  ],
};

/** Options start at least this far out, so the poll has time to run. */
export const SLOT_LEAD_MS = 36 * HOUR;
/** An Event's own time can be an option from this far out. */
const EVENT_TIME_LEAD_MS = 24 * HOUR;
const MAX_SLOTS = 5;

export type TimeSlot = { id: string; label: string; startAt: number };

/** Up to five times on the coming weekends, at hours that suit the activity (San Francisco time). */
export function timeSlots(activity: InterestId, now: number): TimeSlot[] {
  const pattern = SLOTS_BY_INTEREST[activity] ?? SLOTS_BY_SECTION[getInterest(activity).section];
  const saturday = weekendOf(now).saturday;
  const starts = new Set<number>();
  for (const week of [0, 7, 14])
    for (const [d, h, m] of pattern) {
      const t = sfTime(addDays(saturday, week + d), h, m);
      if (t >= now + SLOT_LEAD_MS) starts.add(t);
    }
  return [...starts]
    .sort((a, b) => a - b)
    .slice(0, MAX_SLOTS)
    .map((startAt, i) => ({ id: `t${i + 1}`, label: slotLabel(startAt), startAt }));
}

/**
 * A poll closes at 6pm in San Francisco the evening before its first option,
 * and stays open at least 2 hours.
 */
export function pollClosesAt(options: readonly { startAt?: number }[], now: number): number {
  const first = Math.min(...options.map((o) => o.startAt ?? Infinity));
  if (!Number.isFinite(first)) return now + 2 * DAY;
  return Math.max(now + 2 * HOUR, sfTime(addDays(sfDate(first), -1), 18, 0));
}

/** The day-of reminder goes out by 8am in San Francisco, or 2 hours ahead for an early start. */
export function remindAt(startAt: number): number {
  return Math.min(sfTime(sfDate(startAt), 8, 0), startAt - 2 * HOUR);
}

/* ---------- Places Muse may suggest (cited sources) ---------- */

export type PlaceOption = {
  /** The source key Muse cites ("event:…", "post:…"). */
  source: string;
  kind: "event" | "post";
  title: string;
  venue: string | null;
  when: string | null;
  /** The Group it's from. */
  from: string | null;
  text: string;
  /** An Event's own time, as an id in `times`, when it's far enough out to poll on. */
  timeId: string | null;
};

const EVENT_OPTIONS = 3;
const POST_OPTIONS = 4;
const EXCERPT = 500;

const excerpt = (s: string, n = EXCERPT) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A long post cut around its first line about the activity, so that line is always in it. */
export function excerptAbout(text: string, activity: InterestId, n = EXCERPT): string {
  if (text.length <= n) return text;
  let at = 0;
  for (const line of text.split("\n")) {
    if (interestsInText(line).includes(activity)) break;
    at += line.length + 1;
  }
  if (at >= text.length) return excerpt(text, n);
  const start = Math.max(0, Math.min(at - 150, text.length - (n - 1)));
  // Room for "…" on each side that's cut.
  const end = text.length - start <= n - 1 ? text.length : start + n - 2;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * What Muse may build the plan around: upcoming public, in-person San Francisco
 * Events about the activity, and posts in public Groups about it (most liked
 * first). Only what the owner can see; blocked people's posts and Events are out.
 */
export async function placeOptions(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  activity: InterestId,
  now: number,
): Promise<{ options: PlaceOption[]; sources: Source[]; eventStarts: Map<string, number> }> {
  const blocked = await blockedSet(ctx, ownerId);
  const options: PlaceOption[] = [];
  const sources: Source[] = [];
  const eventStarts = new Map<string, number>();

  const upcoming = await ctx.db
    .query("events")
    .withIndex("by_start", (q) => q.gt("startAt", now + 2 * HOUR).lt("startAt", now + 28 * DAY))
    .take(300);
  const events = upcoming
    .filter(
      (e) =>
        e.privacy === "public" &&
        !e.online &&
        /san francisco/i.test(e.city) &&
        !blocked.has(e.hostId),
    )
    .map((e) => ({ e, named: interestsInText(e.title).includes(activity) }))
    .filter((x) => x.named || interestsForEvent(x.e).includes(activity))
    .sort((a, b) => Number(b.named) - Number(a.named) || a.e.startAt - b.e.startAt);
  for (const { e } of events) {
    if (options.length >= EVENT_OPTIONS) break;
    if (!(await ctx.db.get(e.hostId))) continue;
    const group = e.groupId ? await ctx.db.get(e.groupId) : null;
    options.push({
      source: `event:${e._id}`,
      kind: "event",
      title: e.title,
      venue: e.venue ?? null,
      when: slotLabel(e.startAt),
      from: group?.name ?? null,
      text: excerpt(e.description),
      timeId: null,
    });
    sources.push({ kind: "event", eventId: e._id });
    eventStarts.set(`event:${e._id}`, e.startAt);
  }

  // Posts in Groups about the activity, or anywhere that names it.
  const groups = (
    await ctx.db.query("groups").withIndex("by_activity").order("desc").take(80)
  ).filter((g) => g.privacy === "public" && g.visible);
  const posts: { p: Doc<"posts">; g: Doc<"groups">; named: boolean }[] = [];
  for (const g of groups) {
    const about = interestsForGroup(g).includes(activity);
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id).gt("createdAt", now - 120 * DAY))
      .order("desc")
      .take(25);
    for (const p of rows) {
      if (!p.text?.trim() || blocked.has(p.authorId)) continue;
      const named = interestsInText(p.text).includes(activity);
      if (named || about) posts.push({ p, g, named });
    }
  }
  posts.sort((a, b) => Number(b.named) - Number(a.named) || b.p.reactionCount - a.p.reactionCount);
  for (const { p, g } of posts.slice(0, POST_OPTIONS)) {
    options.push({
      source: `post:${p._id}`,
      kind: "post",
      title: `A post in ${g.name}`,
      venue: null,
      when: null,
      from: g.name,
      text: excerptAbout(p.text ?? "", activity),
      timeId: null,
    });
    sources.push({ kind: "post", postId: p._id });
  }
  return { options, sources, eventStarts };
}

/* ---------- Muse's plan (`muse.chatPlan`) ---------- */

export type ChatPlanInput = {
  owner: string;
  chat: { title: string; members: string[] };
  talk: { by: string; text: string; chimedIn: string[] };
  /** The chat's latest messages, oldest first, for what suits people ("weekends only"). */
  recent: { by: string; text: string }[];
  activity: { id: InterestId; label: string; emoji: string };
  places: PlaceOption[];
  times: { id: string; label: string }[];
};

const planOutput = v.object({
  title: v.string(),
  placeSource: v.string(),
  place: v.string(),
  route: v.array(v.string()),
  timeIds: v.array(v.string()),
  question: v.string(),
  text: v.string(),
  rationale: v.string(),
});
export type ChatPlanOutput = {
  title: string;
  placeSource: string;
  place: string;
  route: string[];
  timeIds: string[];
  question: string;
  text: string;
  rationale: string;
};

const PLAN_INSTRUCTIONS = `Someone in a group chat floated a plan ("we should hike sometime"). Turn it into a concrete plan the owner can send to the chat with a poll on when. The owner ("owner" in <input>) reviews it before anything is sent. <input> has the chat (its title and the other members' first names), the talk that floated the plan and who chimed in, the chat's recent messages, the activity, places (each one is also a source in <sources>) and times.

Return:
- title: a short name for the plan, at most 60 characters, e.g. "Lands End hike".
- placeSource: the key of the one place that suits the chat best. Prefer somewhere in San Francisco that fits what people said.
- place: where to meet or go, named exactly as that source names it (e.g. "Lands End Lookout"), at most 80 characters.
- route: 0 to 3 short steps in order (where to meet, the main stop, what's after), each at most 100 characters, using only places and directions the source gives. Empty when the source gives no route.
- timeIds: the ids of the 2 or 3 times that best fit what people said ("weekends only", "not before 9"). Only ids from times. A time marked with an Event ("with Bay Area Hikers") is that Event's own time, for going along with it; consider it when you pick that Event.
- question: the poll question, at most 140 characters, e.g. "When works for the Lands End hike?".
- text: the message that goes with the poll, in the owner's voice, at most 400 characters: the plan, the place and the route, warm and short. Don't state a time; the poll asks that.
- rationale: one sentence for the owner on why this plan (who floated it, who's in, why this place), at most 200 characters.`;

/** A clock time ("10am", "8:30"), which the poll text shouldn't state. */
const CLOCK = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d{1,2}:\d{2}\b/i;

const padded = (s: string) => ` ${normalize(s)} `;
const bare = (s: string) => normalize(s).replace(/^the /, "");

/** Whether the option's own words name `place`. */
export function namesPlace(o: PlaceOption, place: string): boolean {
  const b = bare(place);
  return !!b && padded(`${o.title} ${o.venue ?? ""} ${o.text}`).includes(` ${b} `);
}

export function planProblems(o: ChatPlanOutput, input: ChatPlanInput): string[] {
  const problems: string[] = [];
  const opt = input.places.find((p) => p.source === o.placeSource);
  if (!opt) problems.push(`placeSource "${o.placeSource}" isn't one of the places`);
  const title = o.title.trim();
  if (title.length < 3 || title.length > 60) problems.push("title: 3–60 characters");
  const place = o.place.trim();
  if (!place || place.length > 80) problems.push("place: 1–80 characters");
  else if (opt && !namesPlace(opt, place))
    problems.push(`place: "${place}" isn't named in ${o.placeSource}; use the name it gives`);
  if (o.route.length > 3) problems.push("route: at most 3 steps");
  if (o.route.some((s) => !s.trim() || s.length > 100))
    problems.push("route: each step 1–100 characters");
  const ids = new Set(o.timeIds);
  if (ids.size !== o.timeIds.length || ids.size < 2 || ids.size > 3)
    problems.push("timeIds: 2 or 3 different ids");
  for (const id of ids)
    if (!input.times.some((t) => t.id === id))
      problems.push(`timeIds: "${id}" isn't one of the times`);
  const q = o.question.trim();
  if (q.length < 5 || q.length > 140) problems.push("question: 5–140 characters");
  const text = o.text.trim();
  if (text.length < 10 || text.length > 400) problems.push("text: 10–400 characters");
  if (CLOCK.test(text)) problems.push("text: don't state a time; the poll asks that");
  if (/https?:\/\//i.test(text)) problems.push("text: no links");
  if (!o.rationale.trim() || o.rationale.length > 200) problems.push("rationale: 1–200 characters");
  return problems;
}

export const chatPlanTask = defineTask({
  agent: "muse",
  name: CHAT_PLAN_TASK,
  instructions: PLAN_INSTRUCTIONS,
  output: planOutput,
  cites: (o) => [o.placeSource],
  check: (o, input: ChatPlanInput) => planProblems(o, input),
  fallback: (input) => planTemplate(input),
  effort: "low",
  maxAttempts: 2,
});

/* ---------- Templates (AI off, and the Event and reminder) ---------- */

export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function cutWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[.,;:!?\s]+$/, "")}…`;
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clock times and "at 8:00" go: the poll sets the time. */
function withoutTimes(s: string): string {
  return s
    .replace(/\s*\b(at|by|around|from|until|til)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, "")
    .replace(/\s*\b\d{1,2}(:\d{2})\s*(am|pm)?\b/gi, "")
    .replace(/\s*\b\d{1,2}\s*(am|pm)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const ROUTE_WORDS =
  /\b(meet|meets|meeting|start|starts|then|through|loop|over to|up to|down to|finish|ends? at|after|head)\b/i;

/** Up to three route steps from an Event's description ("Meet at…", "then up through…", "Coffee after…"). */
export function routeSteps(description: string): string[] {
  const steps: string[] = [];
  const sentences = description.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    if (!ROUTE_WORDS.test(s)) continue;
    for (const part of s.split(/,?\s+then\s+/i)) {
      const clean = withoutTimes(part)
        .replace(/[.!]+$/, "")
        .trim();
      if (clean.length >= 8 && !CLOCK.test(clean)) steps.push(cutWords(capFirst(clean), 100));
      if (steps.length >= 3) return steps;
    }
  }
  return steps;
}

/** "Saturday Urban Hike: Dolores Park to Bernal Hill" → "Urban Hike: Dolores Park to Bernal Hill". */
export function planTitle(activityLabel: string, o: PlaceOption | undefined, place = ""): string {
  if (o?.kind !== "event") {
    if (!place) return `${activityLabel} plan`;
    // "Neon Duet Karaoke", or "Coffee at Moonrise Coffee"-style when the name doesn't say it.
    return cutWords(
      padded(place).includes(` ${normalize(activityLabel)} `)
        ? place
        : `${activityLabel} at ${place}`,
      60,
    );
  }
  const t = o.title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(
      /^(this |next )?(mon|tues|wednes|thurs|fri|satur|sun)day('s)?\s+(morning |afternoon |evening |night )?/i,
      "",
    )
    .trim();
  return cutWords(capFirst(t || o.title), 60);
}

/** #15's place list, to name a place a post mentions. */
const KNOWN_PLACES = NEIGHBORHOOD_PLACES.map((p) => ({ name: p.name, aliases: p.aliases ?? [] }));

/**
 * Where an option says to go: an Event's venue, or a known place a post names
 * in the same line as the activity ("9:00 … Neon Duet Karaoke"). Nothing when
 * no line ties a place to it: a post's other stops aren't the plan.
 */
function placeFor(o: PlaceOption | undefined, activity: InterestId): string {
  if (!o) return "";
  if (o.kind === "event") return o.venue ?? "";
  for (const line of o.text.split(/\n+|(?<=[.!?])\s+/)) {
    const places = placesMentioned(line, KNOWN_PLACES);
    if (!places.length) continue;
    const named = places.find((p) => interestsInText(p.name).includes(activity));
    if (named) return named.name;
    if (interestsInText(line).includes(activity)) return places[0]?.name ?? "";
  }
  return "";
}

/** The talk from its plan cue to the end of that sentence: "we should hike sometime". */
export function talkQuote(text: string): string {
  const t = text.trim();
  const at = t.search(CUE);
  const from = at > 0 ? t.slice(at) : t;
  const sentence = from.split(/(?<=[.!?])\s/)[0] ?? from;
  return cutWords(sentence.replace(/[.!?]+$/, ""), 70);
}

/** The plan without a model: the best-fitting Event (else post), its own time and the first slots. */
export function planTemplate(input: ChatPlanInput): ChatPlanOutput {
  const o = input.places.find((p) => p.kind === "event") ?? input.places[0];
  const place = placeFor(o, input.activity.id);
  const title = planTitle(input.activity.label, o, place);
  const route = o?.kind === "event" ? routeSteps(o.text) : [];
  const quote = talkQuote(input.talk.text);
  const plan = route.length
    ? `${route.join(" → ")}.`
    : place && !title.includes(place)
      ? `At ${place}.`
      : "";
  let text = `${input.activity.emoji} Turning “${quote}” into a plan: ${title}. ${plan} Pick the times that work 👇`;
  if (text.length > 400) text = `${input.activity.emoji} ${title}. ${plan}`.slice(0, 400);
  const self = input.talk.by === input.owner;
  const chimed = input.talk.chimedIn;
  const who = `${self ? "You" : input.talk.by} floated it${
    chimed.length ? ` and ${nameList(chimed)} ${chimed.length === 1 ? "is" : "are"} in` : ""
  }.`;
  const why =
    o?.kind === "event"
      ? ` The place and route come from an upcoming Event${o.from ? ` in ${o.from}` : ""}.`
      : o?.from
        ? ` Locals in ${o.from} recommend it.`
        : "";
  return {
    title,
    placeSource: o?.source ?? "",
    place,
    route,
    timeIds: [
      ...new Set([o?.timeId, ...input.times.filter((t) => t.id.startsWith("t")).map((t) => t.id)]),
    ]
      .filter((id): id is string => !!id)
      .slice(0, 3),
    question: cutWords(`When works for ${title}?`, 140),
    text: text.replace(/\s{2,}/g, " ").trim(),
    rationale: cutWords(`${who}${why}`, 200),
  };
}

/** The Event's description: the route, and where it was planned. */
export function eventDescription(
  plan: { route: readonly string[]; place?: string },
  chat: string,
  picked: number,
): string {
  const lines: string[] = [];
  if (plan.route.length) lines.push(`${plan.route.join(" → ")}.`);
  else if (plan.place) lines.push(`At ${plan.place}.`);
  lines.push(
    `Planned in ${chat}: ${picked} ${picked === 1 ? "person" : "people"} picked this time in the poll.`,
  );
  return lines.join("\n\n");
}

/** "Today! 🥾 Lands End hike at 10 AM. Meet at the Lands End Lookout. 4 of us are going. See you there!" */
export function reminderText(p: {
  emoji: string;
  title: string;
  startAt: number;
  place?: string;
  route: readonly string[];
  going: number;
}): string {
  const where = p.route[0] ? ` ${p.route[0]}.` : p.place ? ` We're meeting at ${p.place}.` : "";
  const who = p.going > 1 ? ` ${p.going} of us are going.` : "";
  return `Today! ${p.emoji} ${p.title} at ${clockLabel(p.startAt)}.${where}${who} See you there!`;
}

/* ---------- Where a plan is (read from its proposals) ---------- */

export type PlanStage =
  | "pollDraft"
  | "polling"
  | "eventDraft"
  | "scheduled"
  | "reminderDraft"
  | "reminded"
  | "done"
  | "dropped";

type Step = Pick<Doc<"proposals">, "status" | "expiresAt"> | null;

function stepState(p: Step, now: number): "none" | "pending" | "done" | "dropped" {
  if (!p) return "none";
  if (p.status === "approved" || p.status === "edited") return "done";
  if (p.status === "rejected" || p.status === "expired") return "dropped";
  return p.expiresAt !== undefined && p.expiresAt <= now ? "dropped" : "pending";
}

/**
 * A discarded poll drops the plan. A discarded Event goes back to the poll, so
 * the owner can try again. Once the Event has started, the plan is done.
 */
export function planStage(
  s: { poll: Step; event: Step; reminder: Step; eventStartAt: number | null },
  now: number,
): PlanStage {
  const poll = stepState(s.poll, now);
  if (poll === "none" || poll === "dropped") return "dropped";
  if (poll === "pending") return "pollDraft";
  const event = stepState(s.event, now);
  if (event === "none" || event === "dropped") return "polling";
  if (event === "pending") return "eventDraft";
  if (s.eventStartAt === null || s.eventStartAt <= now) return "done";
  const reminder = stepState(s.reminder, now);
  if (reminder === "pending") return "reminderDraft";
  if (reminder === "done") return "reminded";
  return "scheduled";
}

/* ---------- Context for one plan ---------- */

export type PlanContext = {
  input: ChatPlanInput;
  sources: Source[];
  slots: TimeSlot[];
  activity: InterestId;
};

/**
 * Everything `muse.chatPlan` reads for plan talk in a chat the owner is in.
 * Throws when the message isn't plan talk, already has a plan, or nothing in
 * San Francisco fits it.
 */
export async function planContext(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  conversationId: Id<"conversations">,
  messageId: Id<"messages">,
  now: number,
): Promise<PlanContext> {
  const [conv, msg] = await Promise.all([ctx.db.get(conversationId), ctx.db.get(messageId)]);
  if (
    conv?.kind !== "group" ||
    !msg ||
    msg.conversationId !== conversationId ||
    !(await inConversation(ctx, conversationId, ownerId))
  )
    throw new ConvexError("Chat not found");
  const blocked = await blockedSet(ctx, ownerId);
  const after = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId).gte("createdAt", msg.createdAt),
    )
    .take(MESSAGES_SCANNED);
  const talk = spotTalk(chatLines(after, blocked), now).find((t) => t.messageId === messageId);
  if (!talk) throw new ConvexError("Muse doesn't see a plan in that message");
  if (await planExists(ctx, ownerId, conversationId, talk))
    throw new ConvexError("There's already a plan for this");

  const recentRows = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .order("desc")
    .take(MESSAGES_SCANNED);
  const recent = chatLines(recentRows, blocked).reverse().slice(-25);
  const memberRows = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  const people = await getSummaries(ctx, [
    ...new Set([
      ...memberRows.map((r) => r.userId),
      ...recent.map((l) => l.senderId as Id<"users">),
    ]),
  ]);
  const first = (id: string) => people.get(id as Id<"users">)?.firstName ?? "Someone";
  const others = memberRows.filter((r) => r.userId !== ownerId).map((r) => first(r.userId));

  const { options, sources, eventStarts } = await placeOptions(ctx, ownerId, talk.activity, now);
  const interest = getInterest(talk.activity);
  if (options.length === 0)
    throw new ConvexError(
      `Muse couldn't find anywhere in San Francisco for ${interest.label.toLowerCase()} yet`,
    );
  // An Event's own time is an option too, so the chat can go along with it.
  const slots = timeSlots(talk.activity, now);
  for (const o of options) {
    const t = eventStarts.get(o.source);
    if (t === undefined || t < now + EVENT_TIME_LEAD_MS) continue;
    o.timeId = `e${slots.length + 1}`;
    const label = `${slotLabel(t)} (${o.from && o.from.length <= 24 ? `with ${o.from}` : "the Event"})`;
    slots.push({ id: o.timeId, label, startAt: t });
  }
  return {
    input: {
      owner: first(ownerId),
      chat: { title: chatTitle(conv, others), members: others },
      talk: {
        by: first(talk.senderId),
        text: talk.text,
        chimedIn: talk.chimedIn.filter((id) => id !== ownerId).map(first),
      },
      recent: recent.map((l) => ({ by: first(l.senderId), text: excerpt(l.text, 300) })),
      activity: { id: talk.activity, label: interest.label, emoji: interest.emoji },
      places: options,
      times: slots.map((s) => ({ id: s.id, label: s.label })),
    },
    sources,
    slots,
    activity: talk.activity,
  };
}

/**
 * Whether this talk already has a plan: the owner planned or dismissed this
 * message, or someone in the chat has an open plan for the same activity.
 */
export async function planExists(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  conversationId: Id<"conversations">,
  talk: Pick<Talk, "messageId" | "activity" | "createdAt">,
): Promise<boolean> {
  const rows = await ctx.db
    .query("chatPlans")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId).gte("createdAt", talk.createdAt),
    )
    .take(50);
  return rows.some(
    (r) =>
      (r.ownerId === ownerId && r.messageId === talk.messageId) ||
      (!r.dismissed && r.open && r.activity === talk.activity),
  );
}

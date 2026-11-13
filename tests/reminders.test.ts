import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { MutationCtx } from "../convex/_generated/server";
import { remindAt } from "../convex/lib/chatPlans";
import { DRAFTS_DEBOUNCE_MS, propose } from "../convex/lib/proposals";
import {
  checkInText,
  dayOfReminderAt,
  dayOfText,
  draftsText,
  dueWindowEnd,
  endOfSfDay,
} from "../convex/lib/reminders";
import { list as listNotifications } from "../convex/notifications";
import { approve } from "../convex/proposals";
import * as reminders from "../convex/reminders";
import { askToConnect } from "../convex/roommates";
import { fakeCtx, type Row } from "./fakeDb";

const MINUTE = 60_000;
/** A time in San Francisco in November 2026 (PST, UTC-8). */
const sf = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour + 8, minute);
/** A time in San Francisco in July 2026 (PDT, UTC-7). */
const sfJuly = (day: number, hour: number, minute = 0) => Date.UTC(2026, 6, day, hour + 7, minute);

type Handler = (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
const call = (fn: unknown, ctx: MutationCtx, args: Record<string, unknown> = {}) =>
  (fn as { _handler: Handler })._handler(ctx, args);
const as = (viewer: string) => ({ viewerId: `users:${viewer}` });

afterEach(() => setSystemTime());

/* ---------------- Timing and wording ---------------- */

describe("timing in San Francisco time", () => {
  test("8am the day of, or 2 hours before an earlier start", () => {
    expect(dayOfReminderAt(sf(14, 10))).toBe(sf(14, 8));
    expect(dayOfReminderAt(sf(14, 19, 30))).toBe(sf(14, 8));
    expect(dayOfReminderAt(sf(14, 7))).toBe(sf(14, 5));
    expect(dayOfReminderAt(sf(15, 0, 30))).toBe(sf(14, 22, 30));
    // Summer time: 8am PDT is 15:00 UTC.
    expect(dayOfReminderAt(sfJuly(4, 10))).toBe(Date.UTC(2026, 6, 4, 15));
    expect(dayOfReminderAt).toBe(remindAt); // the chat-plan reminder's timing
  });

  test("the day ends at San Francisco midnight, including on the 25-hour DST day", () => {
    expect(endOfSfDay(sf(14, 9))).toBe(sf(15, 0));
    expect(endOfSfDay(sf(14, 23, 59))).toBe(sf(15, 0));
    // Nov 1 2026 falls back: midnight Nov 2 PST is 08:00 UTC.
    expect(endOfSfDay(Date.UTC(2026, 10, 1, 10))).toBe(Date.UTC(2026, 10, 2, 8));
    expect(endOfSfDay(sfJuly(4, 9))).toBe(Date.UTC(2026, 6, 5, 7));
    // Late at night the window reaches 2 hours ahead, into tomorrow.
    expect(dueWindowEnd(sf(14, 23))).toBe(sf(15, 1));
    expect(dueWindowEnd(sf(14, 9))).toBe(sf(15, 0));
  });

  test("day-of text has the time and place", () => {
    const e = { title: "Run Club", startAt: sf(14, 8), online: false };
    expect(dayOfText({ ...e, venue: "Golden Gate Park" }, sf(14, 6))).toBe(
      "Reminder: Run Club is today at 8 AM at Golden Gate Park.",
    );
    expect(dayOfText({ ...e, address: "501 Stanyan St" }, sf(14, 6))).toBe(
      "Reminder: Run Club is today at 8 AM at 501 Stanyan St.",
    );
    expect(dayOfText({ ...e, online: true }, sf(14, 6))).toBe(
      "Reminder: Run Club is today at 8 AM, online.",
    );
    expect(dayOfText({ ...e, startAt: sf(15, 0, 30) }, sf(14, 23))).toBe(
      "Reminder: Run Club is tomorrow at 12:30 AM.",
    );
  });

  test("check-in text counts only what happened, never a shortfall", () => {
    expect(checkInText(21, { events: 2, groups: 1, friends: 2 })).toBe(
      "3 weeks in: 2 events, 1 Group and 2 new friends. Your check-in is ready.",
    );
    expect(checkInText(8, { events: 0, groups: 0, friends: 1 })).toBe(
      "1 week in: 1 new friend. Your check-in is ready.",
    );
    expect(checkInText(15, { events: 0, groups: 0, friends: 0 })).toBe(
      "2 weeks in: your check-in is ready.",
    );
    expect(checkInText(3, { events: 0, groups: 0, friends: 0 })).toBe(
      "Your first check-in is ready.",
    );
    for (const text of [checkInText(15, { events: 0, groups: 0, friends: 0 })])
      expect(text).not.toMatch(/\b0\b|only|no |didn't|missed/i);
  });

  test("drafts text", () => {
    expect(draftsText(1)).toBe("Muse has a draft for you to review.");
    expect(draftsText(2)).toBe("Muse has 2 drafts for you to review.");
  });
});

/* ---------------- A small world ---------------- */

const user = (id: string, firstName: string): Row => ({
  _id: `users:${id}`,
  name: `${firstName} Test`,
  firstName,
  username: id,
  avatar: `/seed/${id}.jpg`,
  verified: false,
  city: "San Francisco, CA",
  lastActiveAt: 0,
  notificationsSeenAt: 0,
});

const event = (id: string, startAt: number, over: Partial<Row> = {}): Row => ({
  _id: `events:${id}`,
  hostId: "users:host",
  title: id === "run" ? "Run Club" : `Event ${id}`,
  cover: `/seed/${id}.jpg`,
  description: "",
  category: "Fitness",
  startAt,
  online: false,
  venue: "Golden Gate Park",
  city: "San Francisco, CA",
  privacy: "public",
  externalGoingCount: 0,
  externalInterestedCount: 0,
  createdAt: 0,
  ...over,
});

let n = 0;
const rsvp = (eventId: string, userId: string, status = "going", createdAt = sf(10, 9)): Row => ({
  _id: `eventResponses:${++n}`,
  eventId: `events:${eventId}`,
  userId: `users:${userId}`,
  status,
  createdAt,
});

function world(setup?: (t: Record<string, Row[]>) => void) {
  const tables: Record<string, Row[]> = {
    users: [
      user("maya", "Maya"),
      user("zoe", "Zoe"),
      user("dan", "Daniel"),
      user("host", "Tara"),
      user("blk", "Blake"),
      user("late", "Lee"),
    ],
    events: [
      event("run", sf(14, 10)),
      event("early", sf(14, 7, 30)),
      event("tomorrow", sf(15, 10)),
      event("past", sf(13, 18)),
      // Planned in Maya's group chat (#34): reminded in the chat instead.
      event("chat", sf(14, 18), { hostId: "users:maya", privacy: "private" }),
    ],
    eventResponses: [
      rsvp("run", "maya"),
      rsvp("run", "zoe"),
      rsvp("run", "dan", "interested"),
      rsvp("run", "blk"),
      rsvp("run", "late", "going", sf(14, 9)),
      rsvp("early", "maya"),
      rsvp("tomorrow", "maya"),
      rsvp("past", "maya"),
      rsvp("chat", "maya"),
      rsvp("chat", "zoe"),
    ],
    chatPlans: [
      {
        _id: "chatPlans:1",
        ownerId: "users:maya",
        conversationId: "conversations:crew",
        eventProposalId: "proposals:chatEvent",
        open: true,
        updatedAt: sf(12, 9),
      },
    ],
    proposals: [
      {
        _id: "proposals:chatEvent",
        ownerId: "users:maya",
        status: "approved",
        payload: { kind: "event" },
        origin: { agent: "muse" },
        result: { kind: "event", eventId: "events:chat" },
        createdAt: sf(11, 9),
      },
    ],
    blocks: [{ _id: "blocks:1", userId: "users:host", blockedId: "users:blk", createdAt: 0 }],
    userSettings: [],
    notifications: [],
    reminders: [],
    friendships: [],
    groupMembers: [],
    conversations: [],
    conversationMembers: [],
    messages: [],
    proposalEvents: [],
    posts: [],
    groups: [],
    listings: [],
  };
  setup?.(tables);
  const ctx = fakeCtx(tables);
  const queue: { fn: string; args: Record<string, unknown>; delay: number }[] = [];
  const schedule = async (
    delay: number,
    ref: FunctionReference<"mutation">,
    args: Record<string, unknown>,
  ) => {
    queue.push({ fn: getFunctionName(ref), args, delay });
  };
  Object.assign(ctx, { scheduler: { runAfter: schedule, runAt: schedule } });
  /** Runs the hourly job at `now` and every page it schedules. */
  const runTick = async (now: number) => {
    await call(reminders.tick, ctx, { now });
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (job.fn === "reminders:tick") await call(reminders.tick, ctx, job.args);
      else if (job.fn === "reminders:remindEvent") await call(reminders.remindEvent, ctx, job.args);
    }
  };
  const notes = (userId: string) =>
    (tables.notifications ?? []).filter((x) => x.userId === `users:${userId}`);
  return { ctx, tables, queue, runTick, notes };
}

/* ---------------- Day-of Event reminders ---------------- */

describe("day-of Event reminders", () => {
  test("nothing before the reminder time; then the morning of, with time and place", async () => {
    const w = world();
    await w.runTick(sf(14, 7));
    // Only the 7:30am Event's reminder (due 5:30am) is out at 7am.
    expect(w.notes("maya").map((x) => x.text)).toEqual([
      "Reminder: Event early is today at 7:30 AM at Golden Gate Park.",
    ]);
    expect(w.notes("zoe")).toEqual([]);

    await w.runTick(sf(14, 8));
    const run = w.notes("maya").find((x) => x.eventId === "events:run");
    expect(run).toMatchObject({
      kind: "event_reminder",
      text: "Reminder: Run Club is today at 10 AM at Golden Gate Park.",
      read: false,
    });
    expect(run?.actorId).toBeUndefined();
    expect(w.notes("zoe").map((x) => x.eventId)).toEqual(["events:run"]);
    // Interested isn't going; tomorrow's Event waits for tomorrow.
    expect(w.notes("dan")).toEqual([]);
    expect(w.notes("maya").some((x) => x.eventId === "events:tomorrow")).toBe(false);
  });

  test("links to the Event", async () => {
    const w = world();
    await w.runTick(sf(14, 8));
    const out = (await call(listNotifications, w.ctx, as("maya"))) as {
      items: { text: string; target: unknown; image: string | null; emphasis: string[] }[];
    };
    const run = out.items.find((x) => x.text.includes("Run Club"));
    expect(run?.target).toEqual({ kind: "event", eventId: "events:run" });
    expect(run?.image).toBe("/seed/run.jpg");
    expect(run?.emphasis).toEqual(["Run Club"]);
  });

  test("no duplicates: later hours, overlapping runs and retried pages", async () => {
    const w = world();
    await w.runTick(sf(14, 8));
    await w.runTick(sf(14, 8)); // the same run again
    await w.runTick(sf(14, 9));
    await call(reminders.remindEvent, w.ctx, {
      eventId: "events:run",
      now: sf(14, 9, 30),
      cursor: null,
    });
    expect(w.notes("maya").filter((x) => x.eventId === "events:run")).toHaveLength(1);
    expect(w.notes("zoe")).toHaveLength(1);
    expect(w.tables.reminders?.filter((r) => r.key === "event:events:run")).toHaveLength(2);
  });

  test("blocks with the host and RSVPs made after the reminder time are skipped", async () => {
    const w = world();
    await w.runTick(sf(14, 8));
    await w.runTick(sf(14, 9));
    expect(w.notes("blk")).toEqual([]);
    expect(w.notes("late")).toEqual([]);
  });

  test("respects the Events notification setting", async () => {
    const w = world((t) => {
      t.userSettings?.push({
        _id: "userSettings:1",
        userId: "users:zoe",
        notificationsOff: ["events"],
        updatedAt: 0,
      });
    });
    await w.runTick(sf(14, 8));
    expect(w.notes("zoe")).toEqual([]);
    expect(w.tables.reminders?.some((r) => r.userId === "users:zoe")).toBe(false);
  });

  test("chat-plan Events are reminded in their chat, not again here", async () => {
    const w = world();
    await w.runTick(sf(14, 16));
    expect(w.notes("maya").some((x) => x.eventId === "events:chat")).toBe(false);
    expect(w.notes("zoe").some((x) => x.eventId === "events:chat")).toBe(false);
  });

  test("an Event just after midnight is reminded the night before", async () => {
    const w = world((t) => {
      t.events?.push(event("midnight", sf(15, 0, 30), { venue: "The Chapel" }));
      t.eventResponses?.push(rsvp("midnight", "zoe"));
    });
    await w.runTick(sf(14, 22));
    expect(w.notes("zoe").some((x) => x.eventId === "events:midnight")).toBe(false);
    await w.runTick(sf(14, 23));
    expect(w.notes("zoe").find((x) => x.eventId === "events:midnight")?.text).toBe(
      "Reminder: Event midnight is tomorrow at 12:30 AM at The Chapel.",
    );
  });

  test("pages through Events and RSVPs in bounded batches", async () => {
    const w = world((t) => {
      for (let i = 0; i < 60; i++) t.events?.push(event(`e${i}`, sf(14, 12)));
      for (let i = 0; i < 250; i++) {
        t.users?.push(user(`p${i}`, `P${i}`));
        t.eventResponses?.push(rsvp("e0", `p${i}`));
      }
    });
    const pages: string[] = [];
    const tick = reminders.tick;
    await call(tick, w.ctx, { now: sf(14, 8) });
    for (let job = w.queue.shift(); job; job = w.queue.shift()) {
      pages.push(job.fn);
      if (job.fn === "reminders:tick") await call(reminders.tick, w.ctx, job.args);
      else await call(reminders.remindEvent, w.ctx, job.args);
    }
    expect(pages.filter((f) => f === "reminders:tick")).toHaveLength(1); // a second page of Events
    // e0's 250 RSVPs take three pages.
    expect(pages.filter((f) => f === "reminders:remindEvent").length).toBe(60 + 2 + 2);
    const got = new Set(
      (w.tables.notifications ?? []).filter((x) => x.eventId === "events:e0").map((x) => x.userId),
    );
    expect(got.size).toBe(250);
  });

  test("works with AI off: no model calls, nothing scheduled but its own pages", async () => {
    const w = world();
    await call(reminders.tick, w.ctx, { now: sf(14, 8) });
    expect(new Set(w.queue.map((j) => j.fn))).toEqual(new Set(["reminders:remindEvent"]));
  });
});

describe("upcoming reminders (for the Home timeline)", () => {
  test("Events the viewer is going to in the next week, with reminder time and status", async () => {
    setSystemTime(new Date(sf(14, 9)));
    const w = world();
    await w.runTick(sf(14, 9));
    const got = (await call(reminders.upcoming, w.ctx, as("maya"))) as reminders.UpcomingReminder[];
    expect(got.map((r) => [r.event._id, r.via, r.sentAt !== null, r.remindAt])).toEqual([
      ["events:run", "notification", true, sf(14, 8)],
      ["events:chat", "chat", false, sf(14, 8)],
      ["events:tomorrow", "notification", false, sf(15, 8)],
    ]);
    // Blocked either way: not shown.
    const blk = (await call(reminders.upcoming, w.ctx, as("blk"))) as unknown[];
    expect(blk).toEqual([]);
  });
});

/* ---------------- Muse drafts in Landing Inbox ---------------- */

function inboxWorld(setup?: (t: Record<string, Row[]>) => void) {
  return world((t) => {
    t.conversations = ["zoe", "dan"].map((u) => ({
      _id: `conversations:${u}`,
      kind: "dm",
      memberIds: ["users:maya", `users:${u}`],
      createdAt: 0,
      lastMessageAt: 0,
    }));
    t.conversationMembers = ["zoe", "dan"].flatMap((u) =>
      ["maya", u].map((m) => ({
        _id: `conversationMembers:${u}-${m}`,
        conversationId: `conversations:${u}`,
        userId: `users:${m}`,
        lastReadAt: 0,
        lastMessageAt: 0,
      })),
    );
    setup?.(t);
  });
}

const draft = (ctx: MutationCtx, to: "zoe" | "dan", text: string, byOwner?: boolean) =>
  propose(ctx, {
    ownerId: "users:maya" as never,
    payload: { kind: "message", conversationId: `conversations:${to}` as never, text },
    rationale: "You made plans earlier this week.",
    origin: { agent: "spark", task: "spark.reminder", via: "fallback" },
    byOwner,
  });

describe("Inbox draft notifications", () => {
  const T0 = sf(14, 9);
  const at = (minutes: number) => setSystemTime(new Date(T0 + minutes * MINUTE));
  const ready = (ctx: MutationCtx, minutes: number) =>
    call(reminders.draftsReady, ctx, { ownerId: "users:maya", now: T0 + minutes * MINUTE });

  test("each Muse draft schedules a debounced check", async () => {
    const w = inboxWorld();
    at(0);
    await draft(w.ctx, "zoe", "Still on for Saturday?");
    expect(w.queue.filter((j) => j.fn === "reminders:draftsReady")).toEqual([
      { fn: "reminders:draftsReady", args: { ownerId: "users:maya" }, delay: DRAFTS_DEBOUNCE_MS },
    ]);
  });

  test("batched: one notification once drafts stop arriving, linking to Landing Inbox", async () => {
    const w = inboxWorld();
    at(0);
    await draft(w.ctx, "zoe", "Still on for Saturday?");
    at(4);
    await draft(w.ctx, "dan", "Want to split a Costco run?");
    expect(await ready(w.ctx, 10)).toBe(false); // the second draft is only 6 minutes old
    expect(w.notes("maya")).toEqual([]);
    expect(await ready(w.ctx, 14)).toBe(true);
    expect(w.notes("maya")).toMatchObject([
      { kind: "landing_drafts", text: "Muse has 2 drafts for you to review." },
    ]);
    // Retries and later checks don't repeat it.
    expect(await ready(w.ctx, 14)).toBe(false);
    expect(await ready(w.ctx, 60)).toBe(false);
    expect(w.notes("maya")).toHaveLength(1);

    setSystemTime(new Date(T0 + 20 * MINUTE));
    const out = (await call(listNotifications, w.ctx, as("maya"))) as {
      items: { target: unknown; image: string | null }[];
    };
    expect(out.items[0]?.target).toEqual({ kind: "landing", to: "/landing/inbox" });
    expect(out.items[0]?.image).toBe("/seed/maya.jpg");
  });

  test("a new draft replaces the unread notification instead of adding one", async () => {
    const w = inboxWorld();
    at(0);
    await draft(w.ctx, "zoe", "Still on for Saturday?");
    await ready(w.ctx, 10);
    at(30);
    await draft(w.ctx, "dan", "Want to split a Costco run?");
    await ready(w.ctx, 40);
    expect(w.notes("maya").map((x) => x.text)).toEqual(["Muse has 2 drafts for you to review."]);
  });

  test("a read notification stays; the next batch is a new one", async () => {
    const w = inboxWorld();
    at(0);
    await draft(w.ctx, "zoe", "Still on for Saturday?");
    await ready(w.ctx, 10);
    for (const x of w.notes("maya")) x.read = true;
    at(30);
    await draft(w.ctx, "dan", "Want to split a Costco run?");
    await ready(w.ctx, 40);
    expect(w.notes("maya").map((x) => x.text)).toEqual([
      "Muse has a draft for you to review.",
      "Muse has 2 drafts for you to review.",
    ]);
  });

  test("never for drafts the owner asked for", async () => {
    const w = inboxWorld();
    at(0);
    await draft(w.ctx, "zoe", "Hi Zoe! Want to find a place together?", true);
    expect(w.queue.some((j) => j.fn === "reminders:draftsReady")).toBe(false);
    expect(await ready(w.ctx, 30)).toBe(false);
    expect(w.notes("maya")).toEqual([]);
    // And they aren't counted with Muse's.
    at(40);
    await draft(w.ctx, "dan", "Want to split a Costco run?");
    await ready(w.ctx, 50);
    expect(w.notes("maya").map((x) => x.text)).toEqual(["Muse has a draft for you to review."]);
  });

  test("a steady stream still notifies within the hour", async () => {
    const w = inboxWorld();
    let sentAt: number | null = null;
    for (let m = 0; m <= 90 && sentAt === null; m += 5) {
      at(m);
      await draft(w.ctx, m % 10 ? "zoe" : "dan", `Draft ${m}`);
      if (await ready(w.ctx, m)) sentAt = m;
    }
    expect(sentAt).not.toBeNull();
    expect(sentAt ?? 999).toBeLessThanOrEqual(60);
  });

  test("handled, expired or unreachable drafts don't count", async () => {
    const w = inboxWorld();
    at(0);
    const a = await draft(w.ctx, "zoe", "One");
    await draft(w.ctx, "dan", "Two");
    const row = w.tables.proposals?.find((p) => p._id === a);
    if (row) row.status = "rejected";
    await ready(w.ctx, 15);
    expect(w.notes("maya").map((x) => x.text)).toEqual(["Muse has a draft for you to review."]);
  });

  test("off when Landing notifications are off, and not sent later for the same drafts", async () => {
    const w = inboxWorld((t) => {
      t.userSettings?.push({
        _id: "userSettings:1",
        userId: "users:maya",
        notificationsOff: ["landing"],
        updatedAt: 0,
      });
    });
    at(0);
    await draft(w.ctx, "zoe", "Still on for Saturday?");
    await ready(w.ctx, 10);
    expect(w.notes("maya")).toEqual([]);
    w.tables.userSettings = [];
    expect(await ready(w.ctx, 20)).toBe(false);
    expect(w.notes("maya")).toEqual([]);
  });
});

/* ---------------- Roommate first message ---------------- */

function roommateWorld() {
  const w = world((t) => {
    t.friendships = [
      { _id: "friendships:1", userId: "users:maya", friendId: "users:zoe", createdAt: 1 },
      { _id: "friendships:2", userId: "users:zoe", friendId: "users:maya", createdAt: 1 },
    ];
    t.vouches = [];
    t.roommateLifestyles = ["maya", "zoe", "dan"].map((u) => ({
      _id: `roommateLifestyles:${u}`,
      userId: `users:${u}`,
      answers: { sleep: "early", quietHours: "10pm" },
      shared: true,
      sharedAt: 1,
      updatedAt: 1,
    }));
    t.cityProfiles = [];
    t.cityProfileFacts = [];
  });
  return w;
}

describe("roommate Ask to connect", () => {
  const text = "Hi Zoe! I saw you on Landing's roommate matching. Want to chat?";

  test("saves a message proposal in Landing Inbox; nothing is sent before approval", async () => {
    setSystemTime(new Date(sf(14, 9)));
    const w = roommateWorld();
    const id = (await call(askToConnect, w.ctx, {
      ...as("maya"),
      userId: "users:zoe",
      text,
    })) as string;
    const p = w.tables.proposals?.find((x) => x._id === id);
    expect(p).toMatchObject({
      ownerId: "users:maya",
      status: "pending",
      byOwner: true,
      payload: { kind: "message", text },
      origin: { agent: "muse", task: "roommates.askToConnect", via: "fallback" },
    });
    // Only a pending draft exists: no sent message, no thread bump, no notification.
    expect(w.tables.messages?.map((m) => m.status)).toEqual(["pending_approval"]);
    const conv = w.tables.conversations?.find(
      (c) => c._id === (p?.payload as Row | undefined)?.conversationId,
    );
    expect(conv?.memberIds).toEqual(["users:maya", "users:zoe"]);
    expect(conv?.lastMessageId).toBeUndefined();
    expect(w.tables.notifications).toEqual([]);
    // Owner-asked drafts aren't announced.
    expect(w.queue.some((j) => j.fn === "reminders:draftsReady")).toBe(false);

    await call(approve, w.ctx, { ...as("maya"), proposalId: id });
    expect(w.tables.messages?.map((m) => [m.status, m.text])).toEqual([["sent", text]]);
  });

  test("asking again while it waits updates the same draft", async () => {
    setSystemTime(new Date(sf(14, 9)));
    const w = roommateWorld();
    const a = await call(askToConnect, w.ctx, { ...as("maya"), userId: "users:zoe", text });
    const b = await call(askToConnect, w.ctx, {
      ...as("maya"),
      userId: "users:zoe",
      text: "Hey Zoe, want to look at places together?",
    });
    expect(b).toBe(a);
    expect(w.tables.proposals?.filter((p) => p.status === "pending")).toHaveLength(1);
    expect(w.tables.messages?.map((m) => m.text)).toEqual([
      "Hey Zoe, want to look at places together?",
    ]);
  });

  test("only to a current candidate", async () => {
    setSystemTime(new Date(sf(14, 9)));
    const w = roommateWorld();
    // Dan shares answers but isn't in Maya's network.
    await expect(
      call(askToConnect, w.ctx, { ...as("maya"), userId: "users:dan", text }),
    ).rejects.toThrow("isn't one of your roommate matches");
    expect(w.tables.proposals?.filter((p) => p.status === "pending")).toEqual([]);
    expect(w.tables.conversations).toEqual([]);
  });

  test("an empty message isn't saved", async () => {
    setSystemTime(new Date(sf(14, 9)));
    const w = roommateWorld();
    await expect(
      call(askToConnect, w.ctx, { ...as("maya"), userId: "users:zoe", text: "   " }),
    ).rejects.toThrow("empty");
  });
});

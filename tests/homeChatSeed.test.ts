import { expect, test } from "bun:test";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/_generated/api";
import type { QueryCtx } from "../convex/_generated/server";
import { demoChat } from "../convex/homeChat";
import { stats } from "../convex/seed";
import { buildPlan } from "../convex/seed/plan";
import { readSessions, storedMessage } from "../src/landing/home/useChatLog";
import { fakeCtx, type Row } from "./fakeDb";

test("Jordan's demo chat survives browser storage with live rental IDs and cited distances", async () => {
  const plan = buildPlan(Date.now());
  const tables: Record<string, Row[]> = {
    users: [{ _id: "jordan", username: "jordan.kim", isPersona: true }],
    listings: plan.listings.map((l) => ({ ...l.row, _id: l.key, sellerId: l.seller })),
    events: plan.events.map((e) => ({ ...e.row, _id: e.key, hostId: e.host })),
  };
  const handler = (
    demoChat as unknown as {
      _handler: (
        ctx: QueryCtx,
        args: { viewerId: string },
      ) => Promise<FunctionReturnType<typeof api.homeChat.demoChat>>;
    }
  )._handler;
  const session = await handler(fakeCtx(tables), { viewerId: "jordan" });
  expect(session).not.toBeNull();
  if (!session) throw new Error("Missing demo chat");
  const saved = readSessions(
    JSON.stringify([{ ...session, messages: session.messages.map(storedMessage) }]),
  );
  expect(saved).toEqual([session]);
  const reply = saved[0].messages[1];
  expect(reply.rentals).toHaveLength(3);
  expect(reply.rentals?.[0]).toMatchObject({
    id: "derek-mission-1br",
    price: 1300,
    title: "Private bedroom · 1454 South Van Ness Avenue #1",
  });
  expect(
    reply.rentals?.filter((r) => r.reasons.some((reason) => reason.text.startsWith("Best fit:"))),
  ).toHaveLength(1);
  for (const card of reply.rentals ?? []) {
    expect(tables.listings.some((l) => l._id === card.id && l.rentalMedia)).toBe(true);
    expect(card.reasons.every((r) => r.sources.length > 0)).toBe(true);
    expect(card.reasons[1].text).toMatch(/\d+\.\d km straight-line/);
    expect(card.reasons[1].sources[1].href).toMatch(/^\/events\/activity-mission-1/);
  }
  expect(await handler(fakeCtx(tables), { viewerId: "jordan" })).toEqual(session);
  tables.users[0].username = "jordan.kim.later";
  expect(await handler(fakeCtx(tables), { viewerId: "jordan" })).toBeNull();
});

test("seed stats compares conversation previews with sent messages, retaining draft validation", async () => {
  const tables: Record<string, Row[]> = {
    users: [{ _id: "user" }],
    conversations: [{ _id: "chat", memberIds: ["user"], lastMessageId: "sent", lastMessageAt: 1 }],
    conversationMembers: [
      { _id: "member", userId: "user", conversationId: "chat", lastMessageAt: 1 },
    ],
    messages: [
      {
        _id: "sent",
        conversationId: "chat",
        senderId: "user",
        status: "sent",
        createdAt: 1,
        attachments: [],
      },
      {
        _id: "draft",
        conversationId: "chat",
        senderId: "user",
        status: "pending_approval",
        createdAt: 2,
        attachments: [],
      },
    ],
  };
  const handler = (
    stats as unknown as {
      _handler: (ctx: QueryCtx, args: Record<string, never>) => Promise<{ problems: string[] }>;
    }
  )._handler;
  expect((await handler(fakeCtx(tables), {})).problems).toEqual([]);
  tables.messages[1].status = "sent";
  expect((await handler(fakeCtx(tables), {})).problems).toContain(
    "conversation chat lastMessage mismatch",
  );
  tables.messages[1].status = "pending_approval";
  tables.messages[1].senderId = "missing";
  expect((await handler(fakeCtx(tables), {})).problems.length).toBeGreaterThan(0);
});

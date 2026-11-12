import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ActionCtx } from "../convex/_generated/server";
import { review, runAgent } from "../convex/ai/agent";
import { MODEL } from "../convex/ai/model";
import { agentSources } from "../convex/ai/sources";
import { factSlot } from "../convex/lib/cityProfileFacts";
import {
  EXCLUDED_CATEGORIES,
  interestsForCategory,
  interestsForEvent,
  interestsForGroup,
} from "../convex/lib/interests";
import { type ProfileTextInput, profileFromText } from "../convex/lib/profileFromText";
import { extractFacts } from "../convex/lib/profileText";
import { fakeCtx, type Row } from "./fakeDb";

const NOW = Date.UTC(2026, 10, 12);
const TODAY = "2026-11-12";

/* ---------- Interests: one list, lookups, protected-trait exclusions ---------- */

describe("interests", () => {
  test("Group tags name specific interests before the category does", () => {
    expect(interestsForGroup({ category: "Sports", tags: ["Climbing", "Bouldering"] })).toEqual([
      "climbing",
    ]);
    expect(interestsForGroup({ category: "Fitness", tags: ["Social"] })).toEqual(
      interestsForCategory("Fitness"),
    );
  });

  test("Event titles narrow a broad category", () => {
    expect(interestsForEvent({ category: "Fitness", title: "Saturday Run Club loop" })).toEqual([
      "running",
    ]);
  });

  test("excluded categories and unknown tags map to nothing", () => {
    for (const c of EXCLUDED_CATEGORIES) {
      expect(interestsForCategory(c)).toEqual([]);
      expect(interestsForEvent({ category: c, title: "Sunday hike" })).toEqual([]);
    }
    expect(interestsForGroup({ category: "Community", tags: ["Women Who Climb"] })).toEqual([
      "climbing",
    ]);
    expect(interestsForGroup({ category: "Unknown", tags: ["Anything"] })).toEqual([]);
  });
});

/* ---------- The rules-based extractor (the no-AI path) ---------- */

describe("extractFacts", () => {
  const facts = (text: string) => extractFacts(text, NOW);
  const find = (text: string, slot: string) => facts(text).find((p) => factSlot(p.entry) === slot);

  test("budget, move-in, transport and neighborhoods, each with its quote", () => {
    const text =
      "Moving in March for a job at Figma. No car, I bike and take BART. Budget is $1,800-2,400 a month. Thinking the Mission.";
    expect(find(text, "budget")?.entry.value).toEqual({ min: 1800, max: 2400 });
    expect(find(text, "moveIn")?.entry.value).toEqual({ month: "2027-03" });
    const transport = find(text, "transport");
    expect(transport?.entry.value).toEqual({ modes: ["bike", "bart"] });
    expect(transport?.carFree).toBe(true);
    expect(find(text, "neighborhood:mission")?.quote).toBe("Thinking the Mission.");
    expect(find(text, "employer")?.entry.value).toEqual({ name: "Figma" });
  });

  test("$2.5k is a budget, not a 5k run", () => {
    const text = "Rent under $2.5k.";
    expect(find(text, "budget")?.entry.value).toEqual({ max: 2500 });
    expect(find(text, "interest:running")).toBeUndefined();
  });

  test("board game nights aren't night shifts", () => {
    expect(find("I love board game nights.", "schedule")).toBeUndefined();
    expect(find("I love board game nights.", "interest:board_games")).toBeDefined();
    expect(find("Night shift nurse, I work some weekends.", "schedule")?.entry.value).toEqual({
      workHours: "night",
      weekendsFree: false,
    });
  });

  test("not mentioning a car isn't the same as having none", () => {
    expect(find("I take the N Judah.", "transport")?.carFree).toBe(false);
  });
});

/* ---------- Muse's task: review rules ---------- */

const input: ProfileTextInput = {
  text: "Moving to SF in March for a job at Figma. No car, I bike and take BART. Budget is $1,800–2,400 a month. I boulder 3x a week. Thinking the Mission.",
  today: TODAY,
};
const goodAnswer = {
  facts: [
    {
      entry: { key: "budget", value: { min: 1800, max: 2400 } },
      quote: "Budget is $1,800–2,400 a month",
    },
    { entry: { key: "moveIn", value: { month: "2027-03" } }, quote: "Moving to SF in March" },
    { entry: { key: "employer", value: { name: "Figma" } }, quote: "a job at Figma" },
    {
      entry: { key: "transport", value: { modes: ["bike", "bart"] } },
      quote: "No car, I bike and take BART",
      carFree: true,
    },
    { entry: { key: "interest", value: { id: "climbing" } }, quote: "I boulder 3x a week" },
    { entry: { key: "neighborhood", value: { slug: "mission" } }, quote: "the Mission" },
  ],
};
const grounding = { ids: new Set<string>(), sources: new Map(), wrongTable: async () => [] };
const check = (answer: unknown) =>
  review(profileFromText, [JSON.stringify(answer)], input, grounding, "stop");

describe("muse.profileFromText review", () => {
  test("accepts grounded facts", async () => {
    const r = await check(goodAnswer);
    expect(r.ok).toBe(true);
  });

  test("rejects invented quotes, unnamed employers, bad values and duplicates", async () => {
    const r = await check({
      facts: [
        { entry: { key: "interest", value: { id: "climbing" } }, quote: "I love rock climbing" },
        { entry: { key: "employer", value: { name: "Google" } }, quote: "a job at Figma" },
        { entry: { key: "budget", value: { max: 24 } }, quote: "Budget is $1,800–2,400 a month" },
        { entry: { key: "moveIn", value: { month: "2026-03" } }, quote: "Moving to SF in March" },
        { entry: { key: "interest", value: { id: "climbing" } }, quote: "I boulder 3x a week" },
        { entry: { key: "goal", value: { id: "meet_people" } }, quote: "I boulder", carFree: true },
      ],
    });
    expect(r.ok).toBe(false);
    const problems = r.ok ? [] : r.problems.join("\n");
    expect(problems).toContain("isn't copied exactly from the text");
    expect(problems).toContain('employer "Google" isn\'t named in the text');
    expect(problems).toContain("budget max should be monthly rent");
    expect(problems).toContain("move-in month is before today");
    expect(problems).toContain("more than one fact for interest:climbing");
    expect(problems).toContain("carFree only goes on the transport fact");
  });

  test("ids outside the profile's vocabularies fail the schema", async () => {
    const r = await check({
      facts: [{ entry: { key: "interest", value: { id: "church" } }, quote: "I boulder" }],
    });
    expect(r.ok).toBe(false);
  });
});

/* ---------- Muse's task end to end, on a stubbed Meta Model API ---------- */

const replies: string[] = [];
const requests: { messages: { role: string; content: string }[]; response_format?: unknown }[] = [];

function completion(text: string) {
  const sse = [
    { model: MODEL, choices: [{ index: 0, delta: { content: text } }] },
    { model: MODEL, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
    { model: MODEL, choices: [], usage: { prompt_tokens: 10, completion_tokens: 10 } },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .concat("data: [DONE]\n\n")
    .join("");
  return new Response(sse, { headers: { "content-type": "text/event-stream" } });
}

const realFetch = globalThis.fetch;
const stubFetch = (async (_url: string, init?: RequestInit) => {
  requests.push(JSON.parse(String(init?.body)));
  return completion(replies.shift() ?? "not json");
}) as unknown as typeof fetch;

type Ref = FunctionReference<"query" | "mutation", "internal">;

function actionCtx() {
  const db = fakeCtx({ users: [{ _id: "V", name: "V", username: "v" }], userSettings: [] });
  const runs: Row[] = [];
  const ctx = {
    runQuery: async (ref: Ref, args: Record<string, never>) => {
      switch (getFunctionName(ref)) {
        case "ai/sources:resolve":
          return agentSources(db, args.sources, args.shownTo);
        case "ai/runs:cached":
          return null;
        case "ai/runs:wrongTableIds":
          return [];
      }
      throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    },
    runMutation: async (_ref: Ref, args: Record<string, unknown>) => {
      runs.push(args);
      return `run${runs.length}`;
    },
  };
  return { ctx: ctx as unknown as ActionCtx, runs };
}

const env = { ...process.env };
beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  process.env.MODEL_API_KEY = "test";
  delete process.env.AI_ENABLED;
  globalThis.fetch = stubFetch;
});
afterEach(() => {
  process.env = { ...env };
  globalThis.fetch = realFetch;
});

const run = (ctx: ActionCtx) =>
  runAgent(ctx, profileFromText, { input, sources: [], shownTo: "V" as never });

describe("muse.profileFromText on runAgent", () => {
  test("Muse's grounded answer comes back as the proposals", async () => {
    const { ctx, runs } = actionCtx();
    replies.push(JSON.stringify(goodAnswer));
    const result = await run(ctx);
    expect(result.via).toBe("model");
    expect(result.output).toEqual(goodAnswer as never);
    expect(requests[0]?.response_format).toBeDefined();
    expect(runs[0]?.task).toBe("muse.profileFromText");
  });

  test("an ungrounded answer is sent back with the problems, then accepted", async () => {
    const { ctx } = actionCtx();
    const invented = {
      facts: [{ entry: { key: "employer", value: { name: "Google" } }, quote: "a job at Figma" }],
    };
    replies.push(JSON.stringify(invented), JSON.stringify(goodAnswer));
    const result = await run(ctx);
    expect(result.via).toBe("model");
    expect(JSON.stringify(requests[1]?.messages)).toContain("isn't named in the text");
  });

  test("two bad answers fall back to the rules", async () => {
    const { ctx } = actionCtx();
    replies.push("not json", "still not json");
    const result = await run(ctx);
    expect(result.via).toBe("fallback");
    expect(result.fallbackReason).toBe("invalid_output");
    expect(result.output.facts.map((f) => factSlot(f.entry))).toContain("budget");
  });

  test("with AI off, the rules answer and Muse isn't called", async () => {
    const { ctx } = actionCtx();
    process.env.AI_ENABLED = "false";
    const result = await run(ctx);
    expect(result.via).toBe("fallback");
    expect(result.fallbackReason).toBe("disabled");
    expect(requests).toHaveLength(0);
  });
});

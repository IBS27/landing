import { describe, expect, test } from "bun:test";
import type { CityProfile } from "../convex/lib/cityProfile";
import {
  type CrewProfile,
  crewAnchors,
  crewProfile,
  DEFAULT_MATCH_BY,
  employerKey,
  type MatchBy,
  matchCrew,
  sharedInterests,
  usableAnchors,
} from "../convex/lib/crews";
import type { InterestId } from "../convex/lib/interests";

const ALL: MatchBy = { month: true, neighborhood: true, employer: true };

function person(
  userId: string,
  over: Partial<Omit<CrewProfile, "interests">> & { interests?: Record<string, number> } = {},
): CrewProfile {
  const { interests = {}, ...rest } = over;
  return {
    userId,
    month: "2027-02",
    neighborhoods: ["mission"],
    employer: null,
    matchBy: DEFAULT_MATCH_BY,
    ...rest,
    interests: new Map(Object.entries(interests) as [InterestId, number][]),
  };
}

describe("crewAnchors", () => {
  test("month, shared neighborhoods and employer, when both turned them on", () => {
    const a = person("a", {
      neighborhoods: ["mission", "bernal-heights"],
      employer: { key: "google", name: "Google" },
      matchBy: ALL,
    });
    const b = person("b", {
      neighborhoods: ["bernal-heights", "noe-valley"],
      employer: { key: "google", name: "Google LLC" },
      matchBy: ALL,
    });
    expect(crewAnchors(a, b)).toEqual([
      { kind: "month", month: "2027-02" },
      { kind: "neighborhood", slugs: ["bernal-heights"] },
      { kind: "employer", name: "Google" },
    ]);
  });

  test("an anchor only one person turned on doesn't count", () => {
    const a = person("a", { employer: { key: "google", name: "Google" }, matchBy: ALL });
    const b = person("b", {
      employer: { key: "google", name: "Google" },
      matchBy: { month: false, neighborhood: true, employer: false },
    });
    expect(crewAnchors(a, b).map((x) => x.kind)).toEqual(["neighborhood"]);
  });

  test("different months and no shared neighborhood means no anchor", () => {
    expect(
      crewAnchors(person("a"), person("b", { month: "2027-03", neighborhoods: ["marina"] })),
    ).toEqual([]);
  });
});

describe("matchCrew", () => {
  const viewer = person("v", { interests: { climbing: 1, coffee: 1, hiking: 0.5 } });

  test("needs an anchor and a shared interest, and ranks by what's shared", () => {
    const crew = matchCrew(viewer, [
      person("climber", { interests: { climbing: 1, hiking: 1 } }),
      person("coffee", { interests: { coffee: 1 } }),
      person("noInterest", { interests: { surfing: 1 } }),
      person("noAnchor", {
        month: "2027-05",
        neighborhoods: ["marina"],
        interests: { climbing: 1 },
      }),
    ]);
    expect(crew.map((m) => m.userId)).toEqual(["climber", "coffee"]);
    expect(crew[0]).toMatchObject({ shared: ["climbing", "hiking"], score: 1 + 0.5 + 0.75 * 2 });
  });

  test("is symmetric", () => {
    const a = person("a", { interests: { climbing: 1 } });
    const b = person("b", {
      neighborhoods: ["mission", "noe-valley"],
      interests: { climbing: 0.6 },
    });
    expect(matchCrew(a, [b]).map((m) => m.userId)).toEqual(["b"]);
    expect(matchCrew(b, [a]).map((m) => m.userId)).toEqual(["a"]);
    expect(sharedInterests(a, b)).toEqual(sharedInterests(b, a));
  });

  test("never includes the viewer, caps the crew and breaks ties by id", () => {
    const others = ["f", "e", "d", "c", "b", "a", "g"].map((id) =>
      person(id, { interests: { coffee: 1 } }),
    );
    const crew = matchCrew(person("v", { interests: { coffee: 1 } }), [...others, person("v")], 6);
    expect(crew.map((m) => m.userId)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("crewProfile", () => {
  const fact = <V>(
    key: string,
    value: V,
    source: "stated" | "inferred" = "stated",
    confidence = 1,
  ) => ({
    _id: `${key}${JSON.stringify(value)}` as never,
    key,
    value,
    source,
    evidence: { kind: "brief" as const, summary: "" },
    confidence,
    updatedAt: 0,
  });
  const profile = {
    userId: "u" as never,
    briefCompletedAt: 1,
    budget: null,
    moveIn: fact("moveIn", { month: "2027-02" }),
    transport: null,
    schedule: null,
    employer: fact("employer", { name: "Google, Inc." }),
    neighborhoods: [
      fact("neighborhood", { slug: "mission" }),
      fact("neighborhood", { slug: "marina" }, "inferred", 0.6),
    ],
    interests: [
      fact("interest", { id: "climbing" }),
      fact("interest", { id: "coffee" }, "inferred", 0.5),
    ],
    goals: [],
    facts: [],
  } as unknown as CityProfile;

  test("anchors come only from stated facts; interests weigh by confidence", () => {
    const p = crewProfile(profile, DEFAULT_MATCH_BY);
    expect(p.month).toBe("2027-02");
    expect(p.neighborhoods).toEqual(["mission"]);
    expect(p.employer).toEqual({ key: "google", name: "Google, Inc." });
    expect([...p.interests]).toEqual([
      ["climbing", 1],
      ["coffee", 0.5],
    ]);
    expect(usableAnchors(p)).toEqual({ month: true, neighborhood: true, employer: true });
  });

  test("holds only City Profile anchors and interests, nothing about who someone is", () => {
    expect(Object.keys(crewProfile(profile, DEFAULT_MATCH_BY)).sort()).toEqual(
      ["employer", "interests", "matchBy", "month", "neighborhoods", "userId"].sort(),
    );
  });

  test("employer names normalize", () => {
    expect(employerKey("Google LLC")).toBe(employerKey("google"));
    expect(employerKey("Salesforce, Inc.")).toBe("salesforce");
  });
});

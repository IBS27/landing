import { describe, expect, test } from "bun:test";
import { pickOne, toggleMany } from "../src/landing/roommates/Choices";

const ORDER = ["cat", "dog", "other"] as const;
type Pet = (typeof ORDER)[number];

describe("questionnaire choice updates", () => {
  test("pickOne picks, and picking the same option again skips the question", () => {
    expect(pickOne("10pm")(undefined)).toBe("10pm");
    expect(pickOne("10pm")("9pm")).toBe("10pm");
    expect(pickOne("10pm")("10pm")).toBeUndefined();
  });

  test("toggleMany keeps vocabulary order; 'none' is an empty list, distinct from skipped", () => {
    const t = (id: Pet | null) => toggleMany<Pet>([...ORDER], id);
    expect(t("dog")(undefined)).toEqual(["dog"]);
    expect(t("cat")(["dog"])).toEqual(["cat", "dog"]);
    expect(t("dog")(["dog"])).toBeUndefined();
    expect(t(null)(["cat"])).toEqual([]);
    expect(t(null)([])).toBeUndefined();
    expect(t("cat")([])).toEqual(["cat"]);
  });

  test("updates compose, so two quick taps both land", () => {
    const a = toggleMany<Pet>([...ORDER], "cat");
    const b = toggleMany<Pet>([...ORDER], "dog");
    expect(b(a(undefined))).toEqual(["cat", "dog"]);
  });
});

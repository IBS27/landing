import { afterEach, describe, expect, test } from "bun:test";
import {
  dismissalKey,
  dismissalToken,
  dismissBuild,
  dismissedBuild,
} from "../src/landing/apartment/dismissal";

// The Apartment tab's build line stays closed per unit and per build (#153).
const real = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  if (real) Object.defineProperty(globalThis, "localStorage", real);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
const store = (value: unknown) =>
  Object.defineProperty(globalThis, "localStorage", { value, configurable: true });

describe("dismissing the build line", () => {
  test("the token changes with each build result, not with anything else", () => {
    const partial = dismissalToken({ state: "partial", buildRevision: 4 });
    expect(dismissalToken({ state: "partial", buildRevision: 4 })).toBe(partial);
    expect(dismissalToken({ state: "partial", buildRevision: 6 })).not.toBe(partial);
    expect(dismissalToken({ state: "failed", buildRevision: 4 })).not.toBe(partial);
    expect(dismissalToken({ state: "partial", buildRevision: null })).toBe("partial:none");
  });
  test("one key per unit holds the last build closed", () => {
    const saved = new Map<string, string>();
    store({
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
    });
    expect(dismissedBuild("unit-a")).toBeNull();
    dismissBuild("unit-a", "partial:4");
    dismissBuild("unit-a", "partial:6");
    dismissBuild("unit-b", "failed:1");
    expect(dismissedBuild("unit-a")).toBe("partial:6");
    expect(dismissedBuild("unit-b")).toBe("failed:1");
    expect([...saved.keys()]).toEqual([dismissalKey("unit-a"), dismissalKey("unit-b")]);
  });
  test("storage that is missing or throws is ignored", () => {
    store(undefined);
    expect(dismissedBuild("unit-a")).toBeNull();
    expect(() => dismissBuild("unit-a", "partial:4")).not.toThrow();
    const broken = () => {
      throw new Error("denied");
    };
    store({ getItem: broken, setItem: broken });
    expect(dismissedBuild("unit-a")).toBeNull();
    expect(() => dismissBuild("unit-a", "partial:4")).not.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import { errorText } from "../src/landing/errorText";

describe("errorText", () => {
  test("shows only the server's ConvexError message, never the request id or stack", () => {
    // What the Convex client throws: the full server message, with `data` set.
    const e = new ConvexError("Your crew already has a Group");
    e.message =
      "[CONVEX A(crews:proposeGroup)] [Request ID: 1a2b3c] Server Error\nUncaught ConvexError: Your crew already has a Group\n    at assertCanStartGroup (../convex/crews.ts:322:9)";
    expect(errorText(e)).toBe("Your crew already has a Group");
  });

  test("anything else reads as a plain failure", () => {
    expect(errorText(new Error("[CONVEX M(x)] Server Error\nUncaught Error: boom"))).toBe(
      "Something went wrong",
    );
    expect(errorText(new ConvexError({ code: 1 }))).toBe("Something went wrong");
    expect(errorText("nope", "Couldn't save")).toBe("Couldn't save");
  });
});

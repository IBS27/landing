import type { GenericValidator } from "convex/values";

/** JSON-serializable data: what agents read and write. */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  // Undefined fields are allowed (and dropped) so docs with optional fields fit.
  | { [key: string]: Json | undefined };

type JsonSchema = { [key: string]: Json | JsonSchema | JsonSchema[] };

/**
 * The JSON Schema for a Convex validator, in the subset structured outputs
 * accept. Throws for validators the model can't produce (records, bytes,
 * int64, any), so a bad task fails when it's defined, not when it runs.
 */
export function toJsonSchema(validator: GenericValidator): JsonSchema {
  switch (validator.kind) {
    case "string":
      return { type: "string" };
    case "id":
      return {
        type: "string",
        description: `ID of a "${validator.tableName}" record, copied exactly from the input`,
      };
    case "float64":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "literal":
      return { const: literalValue(validator.value) };
    case "array":
      return { type: "array", items: toJsonSchema(validator.element) };
    case "object": {
      const entries = Object.entries(validator.fields);
      return {
        type: "object",
        properties: Object.fromEntries(entries.map(([k, f]) => [k, toJsonSchema(f)])),
        required: entries.filter(([, f]) => f.isOptional === "required").map(([k]) => k),
        additionalProperties: false,
      };
    }
    case "union": {
      const members = validator.members;
      if (members.every((m) => m.kind === "literal"))
        return { enum: members.map((m) => literalValue(m.value)) };
      return { anyOf: members.map(toJsonSchema) };
    }
    default:
      throw new Error(`Agent output can't use v.${validator.kind}()`);
  }
}

function literalValue(value: unknown): Json {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  throw new Error("Agent output literals must be strings, numbers or booleans");
}

/**
 * Checks a parsed model output against its validator. Returns readable errors
 * (sent back to the model on retry) and every value found in a `v.id()`
 * position, so the caller can confirm the model didn't invent record IDs.
 */
export function checkValue(validator: GenericValidator, value: unknown) {
  const errors: string[] = [];
  const ids: { path: string; id: string; table: string }[] = [];

  const walk = (val: GenericValidator, x: unknown, path: string): boolean => {
    const fail = (expected: string) => {
      errors.push(`${path}: expected ${expected}, got ${JSON.stringify(x) ?? "nothing"}`);
      return false;
    };
    switch (val.kind) {
      case "string":
        return typeof x === "string" || fail("a string");
      case "id":
        if (typeof x !== "string") return fail(`a ${val.tableName} ID`);
        ids.push({ path, id: x, table: val.tableName });
        return true;
      case "float64":
        return (typeof x === "number" && Number.isFinite(x)) || fail("a number");
      case "boolean":
        return typeof x === "boolean" || fail("true or false");
      case "null":
        return x === null || fail("null");
      case "literal":
        return x === val.value || fail(JSON.stringify(val.value));
      case "array": {
        if (!Array.isArray(x)) return fail("an array");
        let ok = true;
        x.forEach((item, i) => {
          ok = walk(val.element, item, `${path}[${i}]`) && ok;
        });
        return ok;
      }
      case "object": {
        if (typeof x !== "object" || x === null || Array.isArray(x)) return fail("an object");
        const obj = x as Record<string, unknown>;
        let ok = true;
        for (const [k, field] of Object.entries(val.fields)) {
          if (obj[k] === undefined) {
            if (field.isOptional === "required") {
              errors.push(`${path}.${k}: missing`);
              ok = false;
            }
          } else ok = walk(field, obj[k], `${path}.${k}`) && ok;
        }
        for (const k of Object.keys(obj)) {
          if (!(k in val.fields)) {
            errors.push(`${path}.${k}: unexpected field`);
            ok = false;
          }
        }
        return ok;
      }
      case "union": {
        if (val.members.every((m) => m.kind === "literal")) {
          const allowed = val.members.map((m) => (m.kind === "literal" ? m.value : null));
          return allowed.includes(x) || fail(`one of ${JSON.stringify(allowed)}`);
        }
        // Check each member in isolation. Keep the match's IDs, or report the
        // closest member's errors so the model knows what to fix.
        const tries = val.members.map((member) => checkValue(member, x));
        const rebase = (p: string) => path + p.slice(1);
        const match = tries.find((t) => t.errors.length === 0);
        if (match) {
          ids.push(...match.ids.map((i) => ({ ...i, path: rebase(i.path) })));
          return true;
        }
        const closest = tries.reduce((a, b) => (b.errors.length < a.errors.length ? b : a));
        errors.push(...closest.errors.map((e) => rebase(e)));
        return false;
      }
      default:
        return fail(`a value the schema supports (v.${val.kind})`);
    }
  };

  walk(validator, value, "$");
  return { errors, ids };
}

/** Every string anywhere in a JSON value: the IDs an output may reference. */
export function collectStrings(value: Json, into = new Set<string>()): Set<string> {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, into);
  else if (value !== null && typeof value === "object")
    for (const item of Object.values(value)) if (item !== undefined) collectStrings(item, into);
  return into;
}

/** JSON with object keys sorted, so equal values hash equally. */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter((e): e is [string, Json] => e[1] !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, item]) => `${JSON.stringify(k)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

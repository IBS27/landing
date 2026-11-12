import type { MutationCtx } from "../convex/_generated/server";
import schema from "../convex/schema";

/**
 * A tiny in-memory stand-in for `ctx.db`: get, indexed equality queries, and
 * insert / patch / delete. Rows come back in index order (the index's fields
 * from `convex/schema.ts`, then insertion order), reversed by `order("desc")`.
 * Ranges other than `eq` are not supported. Writes go to `tables`, so tests can
 * inspect them.
 */

export type Row = { _id: string } & Record<string, unknown>;

export function fakeCtx(tables: Record<string, Row[]>): MutationCtx {
  const byId = new Map<string, { table: string; row: Row }>();
  for (const [table, rows] of Object.entries(tables))
    for (const row of rows) byId.set(row._id, { table, row });
  let next = 0;
  const db = {
    get: async (id: string) => byId.get(id)?.row ?? null,
    query: (table: string) => {
      let rows = tables[table] ?? [];
      let fields: string[] = [];
      let desc = false;
      const sorted = () => {
        const out = rows
          .map((row, i) => ({ row, i }))
          .sort((a, b) => {
            for (const f of fields) {
              const c = compare(a.row[f], b.row[f]);
              if (c) return c;
            }
            return a.i - b.i;
          })
          .map((x) => x.row);
        return desc ? out.reverse() : out;
      };
      const chain = {
        withIndex: (index: string, range?: (q: unknown) => unknown) => {
          fields = indexFields(table, index);
          const conds: [string, unknown][] = [];
          const q = {
            eq: (field: string, value: unknown) => {
              conds.push([field, value]);
              return q;
            },
          };
          range?.(q);
          rows = rows.filter((r) => conds.every(([f, val]) => r[f] === val));
          return chain;
        },
        order: (dir: "asc" | "desc") => {
          desc = dir === "desc";
          return chain;
        },
        collect: async () => sorted(),
        first: async () => sorted()[0] ?? null,
        unique: async () => {
          if (rows.length > 1) throw new Error(`unique: ${rows.length} rows in ${table}`);
          return rows[0] ?? null;
        },
        take: async (n: number) => sorted().slice(0, n),
      };
      return chain;
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      const row = { ...doc, _id: `${table}:${++next}` };
      tables[table] = [...(tables[table] ?? []), row];
      byId.set(row._id, { table, row });
      return row._id;
    },
    patch: async (id: string, fields: Record<string, unknown>) => {
      const hit = byId.get(id);
      if (!hit) throw new Error(`patch: no ${id}`);
      for (const [k, val] of Object.entries(fields)) {
        if (val === undefined) delete hit.row[k];
        else hit.row[k] = val;
      }
    },
    delete: async (id: string) => {
      const hit = byId.get(id);
      if (!hit) throw new Error(`delete: no ${id}`);
      tables[hit.table] = (tables[hit.table] ?? []).filter((r) => r._id !== id);
      byId.delete(id);
    },
  };
  return { db } as unknown as MutationCtx;
}

function indexFields(table: string, index: string): string[] {
  const def = schema.tables[table as keyof typeof schema.tables];
  const found = def?.[" indexes"]().find((i) => i.indexDescriptor === index);
  if (!found) throw new Error(`No index ${table}.${index}`);
  return found.fields;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

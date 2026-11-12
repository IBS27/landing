import type { MutationCtx } from "../convex/_generated/server";

/**
 * A tiny in-memory stand-in for `ctx.db`: get, indexed equality queries, and
 * insert / patch / delete. Index order and ranges other than `eq` are ignored.
 * Writes go to `tables`, so tests can inspect them.
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
      const chain = {
        withIndex: (_index: string, range?: (q: unknown) => unknown) => {
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
        order: () => chain,
        collect: async () => rows,
        first: async () => rows[0] ?? null,
        unique: async () => rows[0] ?? null,
        take: async (n: number) => rows.slice(0, n),
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

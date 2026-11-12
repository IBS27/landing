import type { QueryCtx } from "../convex/_generated/server";

/** A tiny in-memory stand-in for `ctx.db`: `get` and indexed equality queries. */
export type Row = { _id: string } & Record<string, unknown>;

export function fakeCtx(tables: Record<string, Row[]>): QueryCtx {
  const byId = new Map<string, Row>();
  for (const rows of Object.values(tables)) for (const r of rows) byId.set(r._id, r);
  const db = {
    get: async (id: string) => byId.get(id) ?? null,
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
  };
  return { db } as unknown as QueryCtx;
}

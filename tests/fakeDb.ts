import type { MutationCtx } from "../convex/_generated/server";
import schema from "../convex/schema";

/**
 * A tiny in-memory stand-in for `ctx.db`: get, indexed equality queries, and
 * insert / patch / delete. Rows come back in index order (the index's fields
 * from `convex/schema.ts`, then insertion order), reversed by `order("desc")`.
 * Ranges support `eq`, `lt`, `lte`, `gt` and `gte`. Queries are also async iterable and paginate. Writes go to `tables`, so tests can
 * inspect them.
 */

export type Row = { _id: string } & Record<string, unknown>;

/** Pass one to `fakeCtx` to count documents read and index ranges queried. */
export type ReadStats = { docs: number; ranges: number };

export function fakeCtx(tables: Record<string, Row[]>, stats?: ReadStats): MutationCtx {
  const read = <T>(rows: T[]) => {
    if (stats) stats.docs += rows.length;
    return rows;
  };
  const byId = new Map<string, { table: string; row: Row }>();
  for (const [table, rows] of Object.entries(tables))
    for (const row of rows) byId.set(row._id, { table, row });
  let next = 0;
  const db = {
    get: async (id: string) => {
      const row = byId.get(id)?.row ?? null;
      if (row && stats) stats.docs++;
      return row;
    },
    query: (table: string) => {
      if (stats) stats.ranges++;
      let rows = tables[table] ?? [];
      let fields: string[] = [];
      let desc = false;
      const sorted = () => {
        const out = rows
          .map((row, i) => ({ row, i }))
          .sort((a, b) => {
            for (const f of fields) {
              const c = compare(at(a.row, f), at(b.row, f));
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
          const conds: ((r: Row) => boolean)[] = [];
          const op = (test: (c: number) => boolean) => (field: string, value: unknown) => {
            conds.push((r) => at(r, field) !== undefined && test(compare(at(r, field), value)));
            return q;
          };
          const q = {
            eq: (field: string, value: unknown) => {
              conds.push((r) => at(r, field) === value);
              return q;
            },
            lt: op((c) => c < 0),
            lte: op((c) => c <= 0),
            gt: op((c) => c > 0),
            gte: op((c) => c >= 0),
          };
          range?.(q);
          rows = rows.filter((r) => conds.every((c) => c(r)));
          return chain;
        },
        order: (dir: "asc" | "desc") => {
          desc = dir === "desc";
          return chain;
        },
        filter: (predicate: (q: unknown) => (row: Row) => boolean) => {
          type Expr = unknown | ((row: Row) => unknown);
          const value = (expr: Expr, row: Row) => (typeof expr === "function" ? expr(row) : expr);
          const q = {
            field: (name: string) => (row: Row) => at(row, name),
            eq: (a: Expr, b: Expr) => (row: Row) => value(a, row) === value(b, row),
            and:
              (...terms: ((row: Row) => boolean)[]) =>
              (row: Row) =>
                terms.every((term) => term(row)),
            or:
              (...terms: ((row: Row) => boolean)[]) =>
              (row: Row) =>
                terms.some((term) => term(row)),
          };
          rows = rows.filter(predicate(q));
          return chain;
        },
        collect: async () => read(sorted()),
        first: async () => read(sorted().slice(0, 1))[0] ?? null,
        unique: async () => {
          if (rows.length > 1) throw new Error(`unique: ${rows.length} rows in ${table}`);
          return read(rows.slice(0, 1))[0] ?? null;
        },
        take: async (n: number) => read(sorted().slice(0, n)),
        /** The cursor is an offset into the range. */
        paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          const all = sorted();
          const start = cursor ? Number(cursor) : 0;
          const end = start + numItems;
          return {
            page: read(all.slice(start, end)),
            isDone: end >= all.length,
            continueCursor: String(end),
          };
        },
        [Symbol.asyncIterator]: async function* () {
          for (const row of sorted()) {
            if (stats) stats.docs++;
            yield row;
          }
        },
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

/** A field by path, as Convex indexes read nested fields ("source.listingId"). */
function at(row: Row, path: string): unknown {
  let v: unknown = row;
  for (const key of path.split(".")) v = (v as Record<string, unknown> | undefined)?.[key];
  return v;
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

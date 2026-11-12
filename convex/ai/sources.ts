/**
 * What an agent may cite. This is the seam to the shared `source` type from
 * #7: once it lands, `AgentSource` becomes that type and `sourceKey` its
 * stable key helper (`post:<id>`, `url:<url>`...). Nothing else in
 * `convex/ai/` depends on the shape.
 */
export type AgentSource = {
  /** Stable, unique key the model cites, e.g. `post:<id>`. */
  key: string;
  /** What the source is: "post", "comment", "event", "listing", "url"... */
  kind: string;
  /** The text the model reads. Never a free-text claim; always from the record. */
  snippet: string;
  /** When the source was written or fetched (ms since epoch). */
  at?: number;
};

export function sourceKey(source: AgentSource): string {
  return source.key;
}

/** How a source is shown to the model. */
export function describeSource(source: AgentSource) {
  return {
    key: sourceKey(source),
    kind: source.kind,
    ...(source.at === undefined ? {} : { date: new Date(source.at).toISOString().slice(0, 10) }),
    text: source.snippet,
  };
}

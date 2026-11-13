import type { GenericValidator } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Json } from "../ai/outputSchema";
import type { ChatCard, ChatRentalCard, ChatSource } from "./homeChatRules";
import { redactProtected } from "./protectedText";

/**
 * What Muse's tools in Landing Home's chat find (#154), in one shape. A tool
 * (convex/homeChatFind.ts, convex/homeChatMine.ts) reads Landing for the
 * viewer and returns `Found` things: the facts Muse reads about each, and the
 * card and links the chat may show for it. Muse only ever names a thing by its
 * `key`; code builds everything the person sees.
 *
 * Rules every tool follows:
 * - Read only what the viewer can see (blocks, privacy, membership), with
 *   bounded reads.
 * - `facts` carry no protected traits, no contact details, no addresses and no
 *   links. Text other people wrote goes through `said()`.
 * - Links are in-app paths built here by code, never taken from data.
 */

export const FOUND_KINDS = [
  "listing",
  "event",
  "group",
  "place",
  "neighborhood",
  "person",
  "draft",
  "negotiation",
  "post",
] as const;
export type FoundKind = (typeof FOUND_KINDS)[number];

/** `<kind>:<id>`: a Convex id, a place's key or a neighborhood's slug. */
export const foundKey = (kind: FoundKind, id: string) => `${kind}:${id}`;

/** The kind and id in a key, or null when it isn't one. */
export function parseKey(key: string): { kind: FoundKind; id: string } | null {
  const colon = key.indexOf(":");
  if (colon <= 0 || colon === key.length - 1) return null;
  const kind = key.slice(0, colon);
  return (FOUND_KINDS as readonly string[]).includes(kind)
    ? { kind: kind as FoundKind, id: key.slice(colon + 1) }
    : null;
}

/** More to read about a thing, beyond the fields the chat's checks rely on. */
type More = { [key: string]: Json | undefined };

/**
 * A rental's lister, as the viewer may know them. Roommate compatibility is
 * the score Landing computes from the lifestyle answers both people share
 * (convex/lib/compatibility.ts); null when either hasn't shared them.
 */
export type ListerFacts = {
  /** First name only. */
  name: string;
  /** "friend", "friend of a friend", "vouched for by …", or null for a stranger. */
  connection: string | null;
  mutualFriends: number;
  compatibility: {
    /** 0–100, or null when too little was answered to compare. */
    score: number | null;
    label: string;
    /** What they have in common and where they differ, as Landing words it. */
    shared: string[];
    different: string[];
    dealbreakers: string[];
  } | null;
};

/** A Group as Muse reads it: on its own, or as the Group that hosts an Event or holds a post. */
export type GroupFacts = {
  kind: "group";
  key: string;
  id: string;
  name: string;
  privacy: "public" | "private";
  joined: boolean;
  neighborhood: string | null;
} & More;

/** What Muse reads about a thing. The named fields are the ones the chat's checks use. */
export type Facts =
  | ({
      kind: "listing";
      key: string;
      id: string;
      /** A place to rent, or something for sale on Marketplace. */
      type: "rental" | "item";
      title: string;
      /** Whole dollars: monthly rent for a rental. */
      price: number;
      /** Slug, when known. */
      neighborhood: string | null;
      saved: boolean;
    } & More)
  | ({
      kind: "event";
      key: string;
      id: string;
      title: string;
      /** ISO time. */
      startsAt: string;
      neighborhood: string | null;
      yourResponse: "going" | "interested" | null;
    } & More)
  | GroupFacts
  | ({
      kind: "place";
      key: string;
      name: string;
      /** "park", "cafe", "viewpoint", "landmark"… */
      type: string;
      neighborhood: string;
    } & More)
  | ({ kind: "neighborhood"; key: string; slug: string; name: string } & More)
  | ({
      kind: "person";
      key: string;
      id: string;
      /** First name only. */
      name: string;
      /** One of the viewer's roommate matches, so Muse may draft an intro to them. */
      roommateMatch: boolean;
    } & More)
  | ({
      kind: "draft";
      key: string;
      id: string;
      /** What approving it does. */
      type: "message" | "offer" | "event" | "group";
      /** One line: "Offer of $120 on Walnut desk". */
      summary: string;
      /**
       * Whether the chat can approve it: only a plain message or an offer whose
       * whole text the chat shows. Anything else is read and approved in the Inbox.
       */
      approvable: boolean;
    } & More)
  | ({
      kind: "negotiation";
      key: string;
      id: string;
      /** The item's title. */
      title: string;
      status: "active" | "paused" | "stopped";
      /** The most the person said they'd pay, whole dollars. */
      maxPrice: number;
    } & More)
  | ({
      kind: "post";
      key: string;
      id: string;
      /** The Group it was posted in. A post is an informal plan or note, never an Event. */
      group: GroupFacts;
      /** First name only. */
      author: string;
      /** ISO time. */
      postedAt: string;
      /** The start of its text, cleaned with `said()`. */
      excerpt: string;
      comments: number;
    } & More);

export type FactsOf<K extends FoundKind> = Extract<Facts, { kind: K }>;

/** One thing a tool found. */
export type Found = {
  key: string;
  facts: Facts;
  /** The link a reply shows when it cites this, built by code. Null when there's nowhere to open. */
  link: ChatSource | null;
  /** More behind it, shown with it: a score's sources, the threads that mention a place. At most 3. */
  sources?: ChatSource[];
  /** The card when the reply shows it: a rental's own card, or a `ChatCard`. */
  rental?: ChatRentalCard;
  card?: ChatCard;
  /**
   * Other things its facts name, so a reply may cite and show them too: the
   * Group hosting an Event, a Group's upcoming Events and recent posts.
   * `withRelated` lays them out flat before they leave the query.
   */
  related?: Found[];
};

/** Things with everything they name, flat and once each, without `related`. */
export function withRelated(found: readonly Found[]): Found[] {
  const out = new Map<string, Found>();
  const add = (f: Found) => {
    const { related, ...thing } = f;
    if (!out.has(f.key)) out.set(f.key, thing);
    for (const r of related ?? []) add(r);
  };
  for (const f of found) add(f);
  return [...out.values()];
}

/** What a tool returns: `result` is all Muse reads; `found` is what the reply may then cite or show. */
export type ToolOutput = { result: Json; found: Found[] };

/** The viewer a tool reads for. */
export type ToolViewer = Doc<"users">;

/**
 * One of Muse's tools. `args` is a `v.object()`: it becomes the JSON schema
 * Muse fills, and a call's arguments are checked against it before `run`.
 * `run` gets them as parsed JSON of that shape; a `ConvexError` it throws is
 * told to Muse as the tool's error.
 */
export type HomeTool = {
  name: string;
  /** What it's for and when to use it, for Muse. */
  description: string;
  args: GenericValidator;
  run: (ctx: QueryCtx, viewer: ToolViewer, args: Record<string, unknown>) => Promise<ToolOutput>;
};

/** Reads things again by key, for the viewer: null for one that's gone or they can't see. */
export type Recall = (ctx: QueryCtx, viewer: ToolViewer, id: string) => Promise<Found | null>;

/** Most things one tool call returns. */
export const TOOL_RESULTS_MAX = 8;

const CONTACT =
  /https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|net|org|io|ly|co|app|me|info|biz|xyz|us)\b\S*|[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/gi;
/**
 * A street address: a house number, one or two words, a street suffix ("123
 * Valencia St", "742 24th Ave"). Cross streets ("Valencia St & 18th St") have
 * no house number, and "2 bedrooms on Valencia St" isn't one.
 */
const ADDRESS =
  /\b\d{1,5}\s+(?:(?!(?:beds?|bedrooms?|baths?|bathrooms?|br|ba|rooms?|blocks?|mins?|minutes?|miles?|near|on|at|by|from|to|the|of|and|in|off)\b)[a-z0-9.'-]+\s+){1,2}(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|ln|lane|ct|court|pl|place|ter|terrace)\b\.?/gi;

/**
 * Text someone else wrote, as Muse may read it and the chat may show it: cut
 * short, with protected traits, links, email addresses, phone numbers and
 * street addresses removed.
 */
export const said = (text: string, max: number) =>
  redactProtected(text.trim().slice(0, max)).replace(CONTACT, "…").replace(ADDRESS, "…");

/** `result` for a list of things: their facts, with a note when there were more. */
export function listed(found: readonly Found[], more?: { [key: string]: Json | undefined }): Json {
  return { ...more, count: found.length, items: found.map((f) => f.facts as Json) };
}

/** The things in tool output Muse read, by key: what a reply may cite, show and act on. */
export function factsIn(result: Json, into = new Map<string, Facts>()): Map<string, Facts> {
  if (Array.isArray(result)) for (const x of result) factsIn(x, into);
  else if (result && typeof result === "object") {
    const { kind, key } = result;
    if (
      typeof key === "string" &&
      typeof kind === "string" &&
      (FOUND_KINDS as readonly string[]).includes(kind) &&
      parseKey(key)?.kind === kind &&
      // The thing itself comes before the Group a post or Event names: keep the fuller facts.
      !into.has(key)
    )
      into.set(key, result as Facts);
    for (const x of Object.values(result)) if (x !== undefined) factsIn(x, into);
  }
  return into;
}

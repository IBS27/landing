import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { NEIGHBORHOOD_PLACES } from "../seed/world/neighborhoods/places";
import type { Source } from "../validators";
import { type CitedSource, type NonEmpty, resolveSources } from "./citations";
import { type CityProfile, type Fact, getProfile, interestWeights } from "./cityProfile";
import type { Anchor } from "./crews";
import {
  getInterest,
  type InterestId,
  interestsForEvent,
  interestsForGroup,
  interestsInText,
  normalize,
} from "./interests";
import type { LatLng } from "./mapPins";
import { type Audience, canSeeEvent, loadAudience } from "./posts";
import { getSummaries, type UserSummary } from "./users";

/**
 * Neighborhood pages (#16): one neighborhood's Groups, Events, people and the
 * things in it that match the viewer's City Profile, all filtered for the
 * viewer. `neighborhoods.page` and `neighborhoods.directory` call these.
 *
 * Privacy:
 * - Groups: visible ones, plus hidden ones the viewer belongs to.
 * - Events: in person, ongoing or starting within `EVENT_WINDOW_MS`, passing
 *   `canSeeEvent`, from hosts not blocked either way.
 * - People: only what Facebook already shows. Members of public Groups (or
 *   Groups the viewer is in) and people going to Events the viewer can see,
 *   and only the viewer's friends and friends of friends. Move-in Crew members
 *   come from #30's matching as `crew` and appear only when the anchor they
 *   share with the viewer is this neighborhood. Nobody's City Profile is read
 *   here except the viewer's own.
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Upcoming Events: those starting within this window (and any still on). */
export const EVENT_WINDOW_MS = 30 * DAY;
/** Events that started up to this long ago may still be on (multi-day Events). */
const EVENT_LOOKBACK_MS = 2 * DAY;
/** An Event without `endAt` is treated as this long. */
const DEFAULT_EVENT_MS = 3 * HOUR;
export const GROUPS_MAX = 50;
export const EVENTS_MAX = 50;
export const PEOPLE_MAX = 12;
/** Members read per Group, and RSVPs per Event, when looking for people the viewer knows. */
const MEMBER_SCAN = 500;
/** Most people outside the viewer's friends checked for mutual friends. */
const STRANGER_SCAN = 200;
/** Group posts read per Group when looking for posts that name a place. */
const PLACE_POST_SCAN = 80;
/** Sources kept per recommended place. */
const PLACE_SOURCES_MAX = 6;
/** "For you" picks per kind. */
export const FOR_YOU_MAX = { event: 4, group: 3, place: 3 } as const;

/* ───────────── Places ───────────── */

export type Place = (typeof NEIGHBORHOOD_PLACES)[number];

/**
 * What a #15 place offers, by kind. Deny by default: kinds that say nothing
 * about an activity (streets, shops, transit, landmarks) map to nothing and
 * match only through their name ("… Climbing Gym").
 */
const PLACE_KIND_INTERESTS: Readonly<Record<string, readonly InterestId[]>> = {
  bakery: ["coffee"],
  bar: ["bars"],
  beach: ["beach_days"],
  bookstore: ["books"],
  brewery: ["bars"],
  cafe: ["coffee"],
  "climbing-gym": ["climbing"],
  dessert: ["restaurants"],
  grocery: ["cooking"],
  library: ["books"],
  market: ["farmers_markets"],
  museum: ["museums"],
  "music-venue": ["live_music"],
  park: ["parks"],
  plaza: ["parks"],
  restaurant: ["restaurants"],
  stairway: ["hiking"],
  trail: ["hiking"],
  viewpoint: ["hiking", "photography"],
};

/** Shown under a place's name. */
const PLACE_KIND_LABELS: Readonly<Record<string, string>> = {
  bakery: "Bakery",
  bar: "Bar",
  beach: "Beach",
  bookstore: "Bookstore",
  brewery: "Brewery",
  cafe: "Cafe",
  "climbing-gym": "Climbing gym",
  dessert: "Dessert",
  grocery: "Grocery",
  landmark: "Landmark",
  library: "Library",
  market: "Market",
  museum: "Museum",
  "music-venue": "Music venue",
  park: "Park",
  plaza: "Plaza",
  restaurant: "Restaurant",
  shop: "Shop",
  stairway: "Stairway",
  street: "Street",
  trail: "Trail",
  transit: "Transit",
  viewpoint: "Viewpoint",
};

/** A place's interests: its kind's, plus any its name names. */
export function interestsForPlace(p: { kind: string; name: string }): InterestId[] {
  return [...new Set([...(PLACE_KIND_INTERESTS[p.kind] ?? []), ...interestsInText(p.name)])];
}

export function placeKindLabel(kind: string): string {
  return PLACE_KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function placesIn(slug: string): Place[] {
  return NEIGHBORHOOD_PLACES.filter((p) => p.neighborhood === slug);
}

/** True when `text` names the place as whole words ("moonrise coffee"). */
export function mentions(text: string, name: string): boolean {
  const needle = normalize(name);
  return needle.length > 0 && ` ${normalize(text)} `.includes(` ${needle} `);
}

/* ───────────── Matching ───────────── */

/** Why something was picked: the strongest interest it shares, and where that fact came from. */
export type Reason = {
  interest: InterestId;
  /** "Climbing". */
  label: string;
  /** "from your brief", "you RSVP'd to 2 board games Events". */
  because: string;
  /** Other shared interests, strongest first. */
  also: string[];
};

/** Where an interest fact came from, as the end of "Climbing · …". */
export function becauseOf(f: Fact<"interest">): string {
  switch (f.evidence.kind) {
    case "brief":
      return "from your brief";
    case "free_text":
      return "you mentioned it";
    case "edit":
      return "you added it";
    case "activity": {
      const s = f.evidence.summary.trim();
      if (!s || /^from your/i.test(s)) return "from your activity";
      // "Joined …" → "you joined …", but "RSVP'd …" keeps its capitals.
      const lower = /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
      return `you ${lower}`;
    }
  }
}

export type Match = { score: number; reason: Reason };

/**
 * How well `interests` fit the profile: the summed weights of the ones it
 * shares (`interestWeights`: stated 1, inferred their confidence), with the
 * strongest as the reason. Null when nothing is shared.
 */
export function matchInterests(
  interests: readonly InterestId[],
  weights: ReadonlyMap<InterestId, number>,
  facts: ReadonlyMap<InterestId, Fact<"interest">>,
): Match | null {
  const shared = [...new Set(interests)]
    .flatMap((id) => {
      const w = weights.get(id);
      return w ? [{ id, w }] : [];
    })
    .sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
  const top = shared[0];
  const fact = top && facts.get(top.id);
  if (!top || !fact) return null;
  return {
    score: Math.round(shared.reduce((s, x) => s + x.w, 0) * 1000) / 1000,
    reason: {
      interest: top.id,
      label: getInterest(top.id).label,
      because: becauseOf(fact),
      also: shared.slice(1).map((x) => getInterest(x.id).label),
    },
  };
}

/** The profile's strongest fact per interest (facts come ranked from `getProfile`). */
function factsByInterest(profile: CityProfile) {
  const m = new Map<InterestId, Fact<"interest">>();
  for (const f of profile.interests) if (!m.has(f.value.id)) m.set(f.value.id, f);
  return m;
}

/* ───────────── Shapes ───────────── */

export type HoodGroup = {
  _id: Id<"groups">;
  slug: string;
  name: string;
  cover: string;
  privacy: Doc<"groups">["privacy"];
  memberCount: number;
  point: LatLng | null;
  joined: boolean;
  /** The viewer said "Not for me" (#4). */
  skipped: boolean;
  /** Up to 3 friends who are members, when the member list is visible to the viewer. */
  friends: UserSummary[];
  friendCount: number;
};

export type HoodEvent = {
  _id: Id<"events">;
  title: string;
  cover: string;
  startAt: number;
  endAt: number | null;
  /** Venue, else the address. */
  place: string;
  point: LatLng | null;
  goingCount: number;
  interestedCount: number;
  viewerStatus: Doc<"eventResponses">["status"] | null;
  skipped: boolean;
  /** Up to 3 friends going. */
  friendsGoing: UserSummary[];
};

export type HoodPlace = {
  key: string;
  name: string;
  kind: string;
  kindLabel: string;
  /** Cross streets or the real place's name. */
  at: string;
  point: LatLng;
};

export type ForYouItem = { key: string; score: number; reason: Reason } & (
  | { kind: "event"; event: HoodEvent }
  | { kind: "group"; group: HoodGroup }
  | { kind: "place"; place: HoodPlace; sources: NonEmpty<CitedSource> }
);

export type ForYou =
  /** No interests in the City Profile yet: the UI asks for the brief. */
  { state: "no_profile" } | { state: "ready"; items: ForYouItem[] };

/** What links someone to this neighborhood, as Facebook would show it. */
export type PersonVia =
  | { kind: "group"; _id: Id<"groups">; slug: string; name: string }
  | { kind: "event"; _id: Id<"events">; title: string };

export type HoodPerson = {
  user: UserSummary;
  tie: "friend" | "friend_of_friend" | "crew";
  /** In the viewer's Move-in Crew (#30), sharing this neighborhood as an anchor. */
  crew: boolean;
  /** Friends in common (friends of friends), up to 2 named. */
  mutual: UserSummary[];
  mutualCount: number;
  /** Groups they're in and Events they're going to here, up to 3. */
  via: PersonVia[];
};

export type NeighborhoodHeader = {
  _id: Id<"neighborhoods">;
  slug: string;
  name: string;
  label: string;
  park: boolean;
  center: LatLng;
  bbox: Doc<"neighborhoods">["bbox"];
  polygon: Doc<"neighborhoods">["polygon"];
};

export type NeighborhoodPageData = {
  neighborhood: NeighborhoodHeader;
  groups: HoodGroup[];
  events: HoodEvent[];
  forYou: ForYou;
  people: HoodPerson[];
};

/** A Move-in Crew member as `crews.viewerCrew` returns them. */
export type CrewLike = { user: UserSummary; anchors: Anchor[] };

/* ───────────── Loading ───────────── */

function header(n: Doc<"neighborhoods">): NeighborhoodHeader {
  return {
    _id: n._id,
    slug: n.slug,
    name: n.name,
    label: n.shortName ?? n.name,
    park: n.park ?? false,
    center: n.center,
    bbox: n.bbox,
    polygon: n.polygon,
  };
}

/** Visible Groups in the neighborhood, most active first, plus hidden ones the viewer is in. */
async function visibleGroups(ctx: QueryCtx, nid: Id<"neighborhoods">, a: Audience) {
  const rows = await ctx.db
    .query("groups")
    .withIndex("by_neighborhood", (q) => q.eq("neighborhoodId", nid))
    .order("desc")
    .take(GROUPS_MAX * 2);
  return rows.filter((g) => g.visible || a.groups.has(g._id)).slice(0, GROUPS_MAX);
}

/** True while the Event hasn't ended. */
function notOver(e: Doc<"events">, now: number) {
  return (e.endAt ?? e.startAt + DEFAULT_EVENT_MS) > now;
}

/** In-person Events here that the viewer may see, ongoing or starting within the window, soonest first. */
async function visibleEvents(
  ctx: QueryCtx,
  nid: Id<"neighborhoods">,
  a: Audience,
  now: number,
): Promise<Doc<"events">[]> {
  const rows = await ctx.db
    .query("events")
    .withIndex("by_neighborhood", (q) =>
      q
        .eq("neighborhoodId", nid)
        .gt("startAt", now - EVENT_LOOKBACK_MS)
        .lt("startAt", now + EVENT_WINDOW_MS),
    )
    .collect();
  const out: Doc<"events">[] = [];
  for (const e of rows) {
    if (out.length >= EVENTS_MAX) break;
    if (e.online || !notOver(e, now) || a.blocked.has(e.hostId)) continue;
    if (await canSeeEvent(ctx, e, a)) out.push(e);
  }
  return out;
}

/** Whether the viewer has an active "Not for me" on the target (#4). */
async function isSkipped(ctx: QueryCtx, viewerId: Id<"users">, targetId: string) {
  const rows = await ctx.db
    .query("profileSignals")
    .withIndex("by_user_target", (q) =>
      q.eq("userId", viewerId).eq("targetId", targetId).eq("kind", "skip"),
    )
    .collect();
  return rows.some((r) => r.undoneAt === undefined);
}

/** Member lists Facebook shows the viewer: public Groups, and Groups they're in. */
function membersVisible(g: Doc<"groups">, a: Audience) {
  return g.privacy === "public" || a.groups.has(g._id);
}

/** Members and goers the viewer may see, for people and friend counts. */
async function attendance(
  ctx: QueryCtx,
  groups: Doc<"groups">[],
  events: Doc<"events">[],
  a: Audience,
) {
  const members = new Map<Id<"groups">, Id<"users">[]>();
  const going = new Map<Id<"events">, Id<"users">[]>();
  const interested = new Map<Id<"events">, number>();
  await Promise.all([
    ...groups.map(async (g) => {
      if (!membersVisible(g, a)) return;
      const rows = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .take(MEMBER_SCAN);
      members.set(
        g._id,
        rows.map((r) => r.userId),
      );
    }),
    ...events.map(async (e) => {
      const [g, i] = await Promise.all([
        ctx.db
          .query("eventResponses")
          .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "going"))
          .take(MEMBER_SCAN),
        ctx.db
          .query("eventResponses")
          .withIndex("by_event", (q) => q.eq("eventId", e._id).eq("status", "interested"))
          .collect(),
      ]);
      going.set(
        e._id,
        g.map((r) => r.userId),
      );
      interested.set(e._id, i.length);
    }),
  ]);
  return { members, going, interested };
}

/**
 * Posts and comments in the neighborhood's Groups that name each place, as
 * sources the viewer can see. Places nobody mentions are left out.
 */
async function placeSources(
  ctx: QueryCtx,
  groups: Doc<"groups">[],
  places: Place[],
  a: Audience,
): Promise<Map<string, NonEmpty<CitedSource>>> {
  const out = new Map<string, NonEmpty<CitedSource>>();
  if (places.length === 0) return out;
  const texts: { source: Source; text: string; at: number }[] = [];
  for (const g of groups) {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id))
      .order("desc")
      .take(PLACE_POST_SCAN);
    for (const p of posts) {
      if (p.text)
        texts.push({ source: { kind: "post", postId: p._id }, text: p.text, at: p.createdAt });
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect();
      for (const c of comments)
        texts.push({
          source: { kind: "comment", commentId: c._id },
          text: c.text,
          at: c.createdAt,
        });
    }
  }
  texts.sort((x, y) => y.at - x.at);
  for (const place of places) {
    const refs = texts.filter((t) => mentions(t.text, place.name)).map((t) => t.source);
    // Posts first: they carry the thread; comments back them up.
    refs.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "post" ? -1 : 1));
    const [first, ...rest] = (await resolveSources(ctx, refs, a)).slice(0, PLACE_SOURCES_MAX);
    if (first) out.set(place.key, [first, ...rest]);
  }
  return out;
}

const KIND_ORDER = { event: 0, group: 1, place: 2 } as const;

/**
 * The best `n` by score, spread across interests: each interest's best item
 * gets a place before any interest gets a second, so four cafes don't crowd
 * out the one music venue. Returned best first.
 */
export function diverse<T>(
  xs: readonly T[],
  n: number,
  score: (t: T) => number,
  interest: (t: T) => string,
): T[] {
  const sorted = [...xs].sort((a, b) => score(b) - score(a));
  const seen = new Set<string>();
  const firsts: T[] = [];
  const rest: T[] = [];
  for (const x of sorted) {
    if (seen.has(interest(x))) rest.push(x);
    else {
      seen.add(interest(x));
      firsts.push(x);
    }
  }
  return [...firsts, ...rest].slice(0, n).sort((a, b) => score(b) - score(a));
}

/**
 * The "For you" picks: Groups, Events and places sharing the viewer's
 * interests, best first. Groups the viewer is in and Events they're going to
 * are left out (they're not news). Skipped ones stay, flagged, so a card the
 * viewer just skipped can still offer Undo.
 */
async function forYou(
  ctx: QueryCtx,
  profile: CityProfile,
  groupDocs: Doc<"groups">[],
  groups: HoodGroup[],
  eventDocs: Doc<"events">[],
  events: HoodEvent[],
  slug: string,
  a: Audience,
): Promise<ForYou> {
  const weights = interestWeights(profile);
  if (weights.size === 0) return { state: "no_profile" };
  const facts = factsByInterest(profile);
  const pick = (xs: ForYouItem[], n: number) =>
    diverse(
      xs,
      n,
      (x) => x.score,
      (x) => x.reason.interest,
    );

  const eventItems: ForYouItem[] = [];
  eventDocs.forEach((doc, i) => {
    const e = events[i];
    if (e.viewerStatus === "going" || doc.hostId === a.viewerId) return;
    const m = matchInterests(interestsForEvent(doc), weights, facts);
    if (m) eventItems.push({ kind: "event", key: `event:${e._id}`, event: e, ...m });
  });

  const groupItems: ForYouItem[] = [];
  groupDocs.forEach((doc, i) => {
    const g = groups[i];
    if (g.joined) return;
    const m = matchInterests(interestsForGroup(doc), weights, facts);
    if (m) groupItems.push({ kind: "group", key: `group:${g._id}`, group: g, ...m });
  });

  const candidates = placesIn(slug).flatMap((p) => {
    const m = matchInterests(interestsForPlace(p), weights, facts);
    return m ? [{ p, m }] : [];
  });
  // Cite only the strongest few: enough to fill the slots when some have no visible mention.
  candidates.sort((x, y) => x.p.name.localeCompare(y.p.name));
  const shortlist = diverse(
    candidates,
    FOR_YOU_MAX.place * 3,
    (c) => c.m.score,
    (c) => c.m.reason.interest,
  );
  const sources = await placeSources(
    ctx,
    groupDocs,
    shortlist.map((c) => c.p),
    a,
  );
  const placeItems: ForYouItem[] = shortlist.flatMap(({ p, m }) => {
    const cited = sources.get(p.key);
    if (!cited) return [];
    const place: HoodPlace = {
      key: p.key,
      name: p.name,
      kind: p.kind,
      kindLabel: placeKindLabel(p.kind),
      at: p.at,
      point: p.point,
    };
    return [{ kind: "place" as const, key: `place:${p.key}`, place, sources: cited, ...m }];
  });

  const items = [
    ...pick(eventItems, FOR_YOU_MAX.event),
    ...pick(groupItems, FOR_YOU_MAX.group),
    ...pick(placeItems, FOR_YOU_MAX.place),
  ].sort((x, y) => y.score - x.score || KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);
  return { state: "ready", items };
}

/** Friends and friends of friends active here, plus crew members who share it as an anchor. */
async function people(
  ctx: QueryCtx,
  slug: string,
  groups: Doc<"groups">[],
  events: Doc<"events">[],
  seen: Awaited<ReturnType<typeof attendance>>,
  a: Audience,
  crew: readonly CrewLike[] | null,
): Promise<HoodPerson[]> {
  const via = new Map<Id<"users">, PersonVia[]>();
  const add = (u: Id<"users">, v: PersonVia) => {
    if (u === a.viewerId || a.blocked.has(u)) return;
    const list = via.get(u) ?? [];
    if (list.length < 3) list.push(v);
    via.set(u, list);
  };
  for (const g of groups)
    for (const u of seen.members.get(g._id) ?? [])
      add(u, { kind: "group", _id: g._id, slug: g.slug, name: g.name });
  for (const e of events)
    for (const u of seen.going.get(e._id) ?? [])
      add(u, { kind: "event", _id: e._id, title: e.title });

  const crewHere = new Map<Id<"users">, UserSummary>();
  for (const m of crew ?? []) {
    const shares = m.anchors.some(
      (x) => x.kind === "neighborhood" && (x.slugs as readonly string[]).includes(slug),
    );
    if (shares && !a.blocked.has(m.user._id) && m.user._id !== a.viewerId)
      crewHere.set(m.user._id, m.user);
  }

  // Friends of friends: people here who share at least one friend with the viewer.
  const mutualOf = new Map<Id<"users">, Id<"users">[]>();
  const strangers = [...via.keys()]
    .filter((u) => !a.friends.has(u) && !crewHere.has(u))
    .sort((x, y) => (via.get(y)?.length ?? 0) - (via.get(x)?.length ?? 0))
    .slice(0, STRANGER_SCAN);
  await Promise.all(
    strangers.map(async (u) => {
      const rows = await ctx.db
        .query("friendships")
        .withIndex("by_user", (q) => q.eq("userId", u))
        .collect();
      const mutual = rows
        .map((r) => r.friendId)
        .filter((f) => a.friends.has(f) && !a.blocked.has(f));
      if (mutual.length > 0) mutualOf.set(u, mutual);
    }),
  );

  const ids = [
    ...crewHere.keys(),
    ...[...via.keys()].filter((u) => !crewHere.has(u) && (a.friends.has(u) || mutualOf.has(u))),
  ];
  const tieRank = { crew: 0, friend: 1, friend_of_friend: 2 } as const;
  const candidates = ids
    .map((u) => {
      const tie: HoodPerson["tie"] = crewHere.has(u)
        ? "crew"
        : a.friends.has(u)
          ? "friend"
          : "friend_of_friend";
      return { u, tie, mutual: mutualOf.get(u) ?? [], via: via.get(u) ?? [] };
    })
    .sort(
      (x, y) =>
        tieRank[x.tie] - tieRank[y.tie] ||
        y.mutual.length - x.mutual.length ||
        y.via.length - x.via.length ||
        x.u.localeCompare(y.u),
    );

  const users = await getSummaries(ctx, [
    ...candidates.map((c) => c.u),
    ...candidates.flatMap((c) => c.mutual.slice(0, 2)),
  ]);
  const out: HoodPerson[] = [];
  for (const c of candidates) {
    if (out.length >= PEOPLE_MAX) break;
    const user = users.get(c.u) ?? crewHere.get(c.u);
    if (user?.kind !== "person") continue;
    out.push({
      user,
      tie: c.tie,
      crew: crewHere.has(c.u),
      mutual: c.mutual.slice(0, 2).flatMap((m) => users.get(m) ?? []),
      mutualCount: c.mutual.length,
      via: c.via,
    });
  }
  return out;
}

/**
 * Everything on a neighborhood page, for the viewer. `crew` is the viewer's
 * Move-in Crew from `crews.viewerCrew` (null when they haven't opted in).
 */
export async function neighborhoodPage(
  ctx: QueryCtx,
  viewer: Doc<"users">,
  slug: string,
  opts: { crew: readonly CrewLike[] | null; now?: number },
): Promise<NeighborhoodPageData | null> {
  const now = opts.now ?? Date.now();
  const n = await ctx.db
    .query("neighborhoods")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!n) return null;
  const a = await loadAudience(ctx, viewer._id);
  const [groupDocs, eventDocs, profile, myResponses] = await Promise.all([
    visibleGroups(ctx, n._id, a),
    visibleEvents(ctx, n._id, a, now),
    getProfile(ctx, viewer),
    ctx.db
      .query("eventResponses")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect(),
  ]);
  const status = new Map(myResponses.map((r) => [r.eventId, r.status]));
  const seen = await attendance(ctx, groupDocs, eventDocs, a);

  const friendIds = [
    ...[...seen.members.values()].flatMap((ids) => ids.filter((u) => a.friends.has(u)).slice(0, 3)),
    ...[...seen.going.values()].flatMap((ids) => ids.filter((u) => a.friends.has(u)).slice(0, 3)),
  ];
  const summaries = await getSummaries(ctx, friendIds);
  const friendsIn = (ids: Id<"users">[] | undefined) => {
    const fs = (ids ?? []).filter((u) => a.friends.has(u) && !a.blocked.has(u));
    return { list: fs.slice(0, 3).flatMap((u) => summaries.get(u) ?? []), count: fs.length };
  };

  const groups: HoodGroup[] = await Promise.all(
    groupDocs.map(async (g) => {
      const f = friendsIn(seen.members.get(g._id));
      return {
        _id: g._id,
        slug: g.slug,
        name: g.name,
        cover: g.cover,
        privacy: g.privacy,
        memberCount: g.memberCount,
        point: g.point ?? null,
        joined: a.groups.has(g._id),
        skipped: await isSkipped(ctx, viewer._id, g._id),
        friends: f.list,
        friendCount: f.count,
      };
    }),
  );
  const events: HoodEvent[] = await Promise.all(
    eventDocs.map(async (e) => {
      const going = seen.going.get(e._id) ?? [];
      return {
        _id: e._id,
        title: e.title,
        cover: e.cover,
        startAt: e.startAt,
        endAt: e.endAt ?? null,
        place: e.venue ?? e.address ?? e.city,
        point: e.point ?? null,
        goingCount: e.externalGoingCount + going.length,
        interestedCount: e.externalInterestedCount + (seen.interested.get(e._id) ?? 0),
        viewerStatus: status.get(e._id) ?? null,
        skipped: await isSkipped(ctx, viewer._id, e._id),
        friendsGoing: friendsIn(going).list,
      };
    }),
  );

  const [forYouData, peopleData] = await Promise.all([
    forYou(ctx, profile, groupDocs, groups, eventDocs, events, n.slug, a),
    people(ctx, n.slug, groupDocs, eventDocs, seen, a, opts.crew),
  ]);
  return { neighborhood: header(n), groups, events, forYou: forYouData, people: peopleData };
}

/* ───────────── Directory ───────────── */

export type DirectoryEntry = {
  _id: Id<"neighborhoods">;
  slug: string;
  name: string;
  label: string;
  park: boolean;
  center: LatLng;
  polygon: Doc<"neighborhoods">["polygon"];
  groupCount: number;
  eventCount: number;
  /** Groups and Events here that share the viewer's interests (not joined or going). */
  matchCount: number;
  /** In the viewer's City Profile. */
  yours: boolean;
};

/**
 * Every neighborhood with its visible Group and upcoming Event counts and how
 * many of them match the viewer, A–Z, for the index page and its map.
 */
export async function neighborhoodDirectory(
  ctx: QueryCtx,
  viewer: Doc<"users">,
  now = Date.now(),
): Promise<{ neighborhoods: DirectoryEntry[]; hasProfile: boolean }> {
  const a = await loadAudience(ctx, viewer._id);
  const [hoods, groups, events, profile, myResponses] = await Promise.all([
    ctx.db.query("neighborhoods").collect(),
    ctx.db.query("groups").withIndex("by_activity").order("desc").collect(),
    ctx.db
      .query("events")
      .withIndex("by_start", (q) =>
        q.gt("startAt", now - EVENT_LOOKBACK_MS).lt("startAt", now + EVENT_WINDOW_MS),
      )
      .collect(),
    getProfile(ctx, viewer),
    ctx.db
      .query("eventResponses")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect(),
  ]);
  const weights = interestWeights(profile);
  const facts = factsByInterest(profile);
  const going = new Set(myResponses.filter((r) => r.status === "going").map((r) => r.eventId));
  const counts = new Map<string, { groups: number; events: number; matches: number }>();
  const bump = (nid: string, k: "groups" | "events", match: boolean) => {
    const c = counts.get(nid) ?? { groups: 0, events: 0, matches: 0 };
    c[k]++;
    if (match) c.matches++;
    counts.set(nid, c);
  };
  for (const g of groups) {
    if (!g.neighborhoodId || !(g.visible || a.groups.has(g._id))) continue;
    const match =
      !a.groups.has(g._id) && matchInterests(interestsForGroup(g), weights, facts) !== null;
    bump(g.neighborhoodId, "groups", match);
  }
  for (const e of events) {
    if (!e.neighborhoodId || e.online || !notOver(e, now) || a.blocked.has(e.hostId)) continue;
    if (!(await canSeeEvent(ctx, e, a))) continue;
    const match =
      !going.has(e._id) &&
      e.hostId !== viewer._id &&
      matchInterests(interestsForEvent(e), weights, facts) !== null;
    bump(e.neighborhoodId, "events", match);
  }
  const yours = new Set(profile.neighborhoods.map((f) => f.value.slug as string));
  return {
    hasProfile: weights.size > 0,
    neighborhoods: hoods
      .map((n) => {
        const c = counts.get(n._id) ?? { groups: 0, events: 0, matches: 0 };
        return {
          _id: n._id,
          slug: n.slug,
          name: n.name,
          label: n.shortName ?? n.name,
          park: n.park ?? false,
          center: n.center,
          polygon: n.polygon,
          groupCount: c.groups,
          eventCount: c.events,
          matchCount: c.matches,
          yours: yours.has(n.slug),
        };
      })
      .sort((x, y) => x.label.localeCompare(y.label)),
  };
}

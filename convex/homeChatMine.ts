import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { Json } from "./ai/outputSchema";
import { placedItems, stateOf, viewerUnit } from "./apartment";
import { viewActivity } from "./checkIns";
import { type CrewMember, crewGroupState, viewerCrew } from "./crews";
import { RECALL_FIND } from "./homeChatFind";
import { houseView } from "./house";
import { isBlockedEitherWay } from "./lib/blocks";
import { daysSince, doneCount, levelFor } from "./lib/checkIns";
import { resolveCitations } from "./lib/citations";
import { getProfile } from "./lib/cityProfile";
import {
  dollars,
  FACT_KEY_LABELS,
  factLabel,
  moveInLabel,
  neighborhoodLabel,
} from "./lib/cityProfileFacts";
import { scoreLabel } from "./lib/compatibility";
import {
  approveDraftAction,
  dayLabel,
  discardDraftAction,
  setNegotiationAction,
} from "./lib/homeChatActions";
import type { ChatCard, ChatPage } from "./lib/homeChatRules";
import {
  type Found,
  type FoundKind,
  foundKey,
  type HomeTool,
  listed,
  type Recall,
  said,
  TOOL_RESULTS_MAX,
  type ToolOutput,
  type ToolViewer,
} from "./lib/homeChatThings";
import { houseOfGroup } from "./lib/houseAccess";
import { getInterest, isInterestId } from "./lib/interests";
import { isOver, journeyPhase, journeyWeek, moveInStart } from "./lib/journeys";
import { estimate, quotedPrice, type RateCard } from "./lib/moverQuotes";
import { knownFacts } from "./lib/museKnows";
import { placeSublet } from "./lib/myPlace";
import { type Audience, canSeeEvent, loadAudience } from "./lib/posts";
import { waitingProposals } from "./lib/proposals";
import { getOwnLifestyle, type RoommateCandidate, roommateCandidates } from "./lib/roommates";
import { getSummaries, getSummary, type UserSummary } from "./lib/users";
import { liveJob } from "./unitScenes";
import type { WeekendStop } from "./validators";

/**
 * Muse's view of the viewer's own move in Landing Home's chat (#154): one
 * tool, `get_my_move`, that reads one part of it per call, with what the
 * matching Landing page shows them: their place and apartment, house, Move-in
 * Crew, roommate matches, this week's Journey, the drafts waiting for their
 * OK, Muse's negotiations, mover quotes, move-out, City Profile and saves.
 *
 * Reads only, for the viewer alone. Other people appear by first name, and
 * only as the page already shows them (crew, roommate matches, housemates).
 * Text other people wrote goes through `said()`.
 */

const ABOUT = [
  "place",
  "house",
  "crew",
  "roommates",
  "journey",
  "drafts",
  "negotiations",
  "movers",
  "moveout",
  "profile",
  "saved",
] as const;
type About = (typeof ABOUT)[number];

/** Rows read per list: a house's lists, what they own, their saves. */
const LIST_MAX = 30;
/** Memberships, negotiations and saves scanned. */
const SCAN_MAX = 100;
const TEXT_MAX = 400;
const TITLE_MAX = 120;

const title = (s: string) => said(s, TITLE_MAX);
const first = (u: { firstName?: string; name: string }) =>
  said(u.firstName || u.name.split(" ")[0] || u.name, 40);
const profileHref = (u: { username: string }) => `/${u.username}`;
const iso = (ms: number) => new Date(ms).toISOString();

/** A part of the move with nothing in it yet: why, and the Landing page that sets it up. */
const nothing = (why: string, page: ChatPage): ToolOutput => ({
  result: { nothing: why, page },
  found: [],
});

/** A thing read again through the search tools; null when it's gone, hidden or malformed. */
async function again(
  ctx: QueryCtx,
  viewer: ToolViewer,
  kind: keyof typeof RECALL_FIND,
  id: string,
): Promise<Found | null> {
  try {
    return await RECALL_FIND[kind](ctx, viewer, id);
  } catch {
    return null;
  }
}

/* ---------------- Place and apartment ---------------- */

async function myPlace(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const { place, listing, unit } = await viewerUnit(ctx, viewer._id);
  if (!place)
    return nothing(
      "They haven't chosen a place yet. They choose one from a rental's card or its page.",
      "find",
    );
  const [hood, sublet, home, live, placed] = await Promise.all([
    ctx.db.get(place.neighborhoodId),
    placeSublet(ctx, viewer._id, place._id),
    listing ? again(ctx, viewer, "listing", listing._id) : null,
    unit ? liveJob(ctx, unit) : null,
    unit ? placedItems(ctx, viewer._id, unit.placements) : null,
  ]);
  const budget = unit?.furnishing?.budget ?? null;
  return {
    result: {
      place: {
        status: place.status,
        neighborhood: hood?.slug ?? null,
        moveIn: place.moveIn,
        moveOut: place.moveOut ?? null,
        // A place found outside Landing has no listing.
        listing: home
          ? (home.facts as Json)
          : listing
            ? { title: title(listing.title), rent: listing.price }
            : null,
      },
      apartment:
        unit && placed
          ? {
              // starter: the example room; building, failed, partial or ready otherwise.
              model: stateOf(unit, !!live),
              look: unit.furnishing?.vibe ? said(unit.furnishing.vibe, 200) : null,
              furnitureBudget: budget,
              spent: placed.spent,
              itemCount: placed.items.length,
              items: placed.items.slice(0, LIST_MAX).map((i) => ({
                title: title(i.title),
                price: i.price,
                stillListed: i.available,
              })),
            }
          : { model: "none" },
      sublet: sublet
        ? {
            title: title(sublet.title),
            rent: sublet.rent,
            status: sublet.status,
            renterChats: sublet.chats,
          }
        : null,
      pages: ["place", "unit", "moveout"],
    },
    found: home ? [home] : [],
  };
}

/* ---------------- House ---------------- */

/** The house the viewer joined most recently, with its Group. */
async function houseOf(ctx: QueryCtx, viewerId: Id<"users">) {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", viewerId))
    .order("desc")
    .take(SCAN_MAX);
  for (const m of memberships) {
    const house = await houseOfGroup(ctx, m.groupId);
    const group = house && (await ctx.db.get(m.groupId));
    if (house && group) return { house, group };
  }
  return null;
}

/** The house the viewer lives in, for the chat's house actions. */
export async function viewerHouse(
  ctx: QueryCtx,
  viewerId: Id<"users">,
): Promise<{ id: string; name: string } | null> {
  const h = await houseOf(ctx, viewerId);
  return h && { id: h.house._id, name: said(h.group.name, 80) };
}

async function myHouse(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const h = await houseOf(ctx, viewer._id);
  if (!h)
    return nothing(
      "They aren't in a house yet. They start one, or accept an invite, on the house page.",
      "house",
    );
  const view = await houseView(ctx, h.house, h.group);
  const who = (u: UserSummary | null) => (u ? first(u) : null);
  return {
    result: {
      house: { name: said(view.house.name, 80), members: view.members.map(first) },
      chores: view.chores.slice(0, LIST_MAX).map((c) => ({
        title: title(c.title),
        cadence: c.cadence,
        who: who(c.assignee),
        done: c.done !== null,
      })),
      bills: view.bills.open.slice(0, LIST_MAX).map((b) => ({
        title: title(b.title),
        amount: b.amountCents / 100,
        due: b.dueDate,
        cadence: b.cadence,
        overdue: b.overdue,
        paid: false,
      })),
      paidBills: view.bills.paid.slice(0, 5).map((b) => ({
        title: title(b.title),
        amount: b.amountCents / 100,
        paid: true,
      })),
      groceries: view.groceries.slice(0, LIST_MAX).map((g) => ({
        text: title(g.text),
        checked: g.checked !== null,
      })),
      today: view.today,
      page: "house",
    },
    found: [],
  };
}

/* ---------------- People: crew and roommate matches ---------------- */

const CLOSENESS_LABEL = {
  friend: "friend",
  vouched: "vouched for by a friend",
  friend_of_friend: "friend of a friend",
} as const;

/** What a crew member has in common with the viewer, as the Crew page words it. */
function crewLines(m: CrewMember): string[] {
  const lines = m.anchors.map((a) =>
    a.kind === "month"
      ? `Also moving in ${moveInLabel({ month: a.month })}`
      : a.kind === "neighborhood"
        ? `Also looking in ${a.slugs.map(neighborhoodLabel).join(", ")}`
        : `Also at ${said(a.name, 60)}`,
  );
  const interests = m.shared.filter(isInterestId).map((id) => getInterest(id).label);
  if (interests.length) lines.push(`Shared interests: ${interests.slice(0, 4).join(", ")}`);
  return lines;
}

function personFound(
  user: UserSummary,
  more: { roommateMatch: boolean; [key: string]: Json | undefined },
  lines: string[],
): Found {
  const key = foundKey("person", user._id);
  const card: ChatCard = {
    key,
    kind: "person",
    title: user.name,
    lines: lines.slice(0, 3),
    photo: user.avatar,
    href: profileHref(user),
  };
  return {
    key,
    facts: { kind: "person", key, id: user._id, name: first(user), ...more },
    link: { label: user.name, href: profileHref(user) },
    card,
  };
}

function crewPerson(m: CrewMember, roommateMatch: boolean): Found {
  const lines = crewLines(m);
  return personFound(m.user, { roommateMatch, inYourCrew: true, inCommon: lines }, lines);
}

/** A roommate match with exactly what the Roommates page shows about them. */
function roommatePerson(c: RoommateCandidate): Found {
  const { compatibility: k, overlap } = c;
  const plans = [
    ...(overlap.moveInMonth
      ? [`Same move-in month, ${moveInLabel({ month: overlap.moveInMonth })}`]
      : []),
    ...(overlap.neighborhoods.length
      ? [`Both looking in ${overlap.neighborhoods.map(neighborhoodLabel).join(", ")}`]
      : []),
    ...(overlap.budget ? ["Budgets overlap"] : []),
  ];
  const label = scoreLabel(k);
  const connection = [
    CLOSENESS_LABEL[c.closeness],
    ...(c.mutualFriendCount
      ? [`${c.mutualFriendCount} mutual friend${c.mutualFriendCount === 1 ? "" : "s"}`]
      : []),
  ].join(" · ");
  return personFound(
    c.user,
    {
      roommateMatch: true,
      connection: CLOSENESS_LABEL[c.closeness],
      mutualFriends: c.mutualFriendCount,
      vouches: c.vouchCount,
      vouchedBy: c.vouchedBy.map(first),
      plansInCommon: plans,
      compatibility: {
        score: k.score,
        label,
        shared: k.shared.map((t) => t.sentence),
        different: k.differences.map((t) => t.sentence),
        dealbreakers: k.dealbreakers.map(
          (d) => `${d.holder === "a" ? "Your" : "Their"} dealbreaker: ${d.label}`,
        ),
      },
    },
    [
      connection.charAt(0).toUpperCase() + connection.slice(1),
      k.score === null ? label : `${k.score}% · ${label}`,
      ...plans,
    ],
  );
}

async function myCrew(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const crew = await viewerCrew(ctx, viewer);
  if (!crew)
    return nothing(
      "They haven't joined a Move-in Crew. They opt in on the crew page, once their City Profile is set up.",
      "crew",
    );
  const [matches, state] = await Promise.all([
    roommateCandidates(ctx, viewer._id),
    crewGroupState(ctx, viewer._id),
  ]);
  const roommates = new Set(matches?.candidates.map((c) => c.user._id));
  const found = crew.map((m) => crewPerson(m, roommates.has(m.user._id)));
  const group = state.group ? await again(ctx, viewer, "group", state.group._id) : null;
  return {
    result: listed(found, {
      optedIn: true,
      // The crew's own Group and first meetup, each made only once they approve Muse's draft.
      crewGroup: group ? (group.facts as Json) : null,
      groupDraft: state.groupProposal
        ? // While it waits it is one of their drafts (`about: "drafts"`).
          { status: state.groupProposal.status }
        : null,
      meetup: state.meetup
        ? {
            status: state.meetup.status,
            event: state.meetup.event
              ? {
                  title: title(state.meetup.event.title),
                  startsAt: iso(state.meetup.event.startAt),
                }
              : null,
          }
        : null,
      page: "crew",
    }),
    found: group ? [...found, group] : found,
  };
}

async function myRoommates(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const mine = await getOwnLifestyle(ctx, viewer._id);
  const list = mine?.shared ? await roommateCandidates(ctx, viewer._id) : null;
  if (!list)
    return nothing(
      mine?.shared
        ? "They share their roommate answers but haven't answered any question yet."
        : mine
          ? "Their roommate answers aren't shared, so Landing shows them no matches. They turn sharing on on the roommates page."
          : "They haven't answered the roommate questions yet.",
      "roommates",
    );
  const found = list.candidates.slice(0, TOOL_RESULTS_MAX).map(roommatePerson);
  return {
    result: listed(found, {
      sharing: true,
      // Best first: closest in their network, then no dealbreaker, then compatibility.
      total: list.total,
      page: "roommates",
    }),
    found,
  };
}

/* ---------------- This week's Journey ---------------- */

/** A Journey stop the viewer may still see: its sources resolve for them, and so does its Event. */
async function journeyStop(
  ctx: QueryCtx,
  viewer: ToolViewer,
  a: Audience,
  stop: WeekendStop,
  now: number,
): Promise<{ line: Json; found: Found | null } | null> {
  if (!(await resolveCitations(ctx, stop.citations, a))) return null;
  const event = stop.eventId ? await ctx.db.get(stop.eventId) : null;
  if (stop.eventId && (!event || !(await canSeeEvent(ctx, event, a)))) return null;
  const found = event
    ? await again(ctx, viewer, "event", event._id)
    : stop.placeKey
      ? await again(ctx, viewer, "place", stop.placeKey)
      : null;
  return {
    line: {
      name: title(stop.name),
      when: stop.startAt ? iso(stop.startAt) : stop.timeOfDay,
      type: stop.kind,
      why: said(stop.why, 200),
      over: event ? isOver(event, now) : false,
      // The Event or place itself, which a reply may cite and show.
      ...(found ? { thing: found.facts as Json } : {}),
    },
    found,
  };
}

/** Their check-in: what they've done since move-in and the level it adds up to. */
async function checkIn(ctx: QueryCtx, viewer: ToolViewer, a: Audience, moveInAt: number) {
  const now = Date.now();
  const rows = await ctx.db
    .query("journeys")
    .withIndex("by_user_week", (q) => q.eq("userId", viewer._id))
    .order("desc")
    .take(3);
  const latest = rows.find((r) => r.checkIn !== undefined);
  if (!latest?.checkIn || now < moveInAt) return null;
  const total = await viewActivity(ctx, a, latest.checkIn.total);
  const days = daysSince(moveInAt, now);
  const level = levelFor(days, doneCount(total));
  // The suggestion shows only while everything it cites is still theirs to see.
  const s = latest.endsAt > now ? latest.checkIn.suggestion : undefined;
  const event = s?.eventId ? await ctx.db.get(s.eventId) : null;
  const shown =
    s &&
    (await resolveCitations(ctx, s.citations, a)) &&
    (!s.eventId || (event && !isOver(event, now) && (await canSeeEvent(ctx, event, a)))) &&
    (!s.groupId || a.groups.has(s.groupId));
  return {
    daysSinceMoveIn: days,
    eventsGoneTo: total.events.length,
    groupsJoined: total.groups.length,
    friendsMade: total.friends.length,
    level: level.label,
    nextLevel: level.next
      ? {
          label: level.next.label,
          daysLeft: level.next.daysLeft,
          moreToDo: level.next.moreNeeded,
        }
      : null,
    suggestion: s && shown ? said(s.text, 300) : null,
  };
}

async function myJourney(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const now = Date.now();
  const profile = await getProfile(ctx, viewer);
  if (profile.briefCompletedAt === null)
    return nothing("Journeys start from their City Profile, which isn't set up yet.", "welcome");
  const moveIn = profile.moveIn?.value;
  if (!moveIn)
    return nothing(
      "Journeys need a move-in date, which their City Profile doesn't have.",
      "profile",
    );
  const phase = journeyPhase(moveIn, now);
  const week = journeyWeek(moveIn, now);
  const a = await loadAudience(ctx, viewer._id);
  const row = week
    ? await ctx.db
        .query("journeys")
        .withIndex("by_user_week", (q) => q.eq("userId", viewer._id).eq("weekOf", week.weekOf))
        .unique()
    : null;
  const stops = row
    ? (
        await Promise.all(
          [...row.stops, ...row.more]
            .slice(0, TOOL_RESULTS_MAX)
            .map((s) => journeyStop(ctx, viewer, a, s, now)),
        )
      ).filter((s) => s !== null)
    : [];
  const found = stops.flatMap((s) => s.found ?? []);
  return {
    result: {
      // before: they haven't moved in; after: the first 90 days are over.
      phase,
      week: week ? { number: week.week, weekendOf: week.weekOf } : null,
      // Null while this weekend's Journey hasn't been built yet.
      stops: row ? stops.map((s) => s.line) : null,
      checkIn: await checkIn(ctx, viewer, a, moveInStart(moveIn)),
      page: "journeys",
    },
    found,
  };
}

/* ---------------- Drafts waiting for their OK ---------------- */

/** Up to three first names from a chat, for "Message to …". */
async function chatWith(ctx: QueryCtx, conversationId: Id<"conversations">, viewerId: Id<"users">) {
  const c = await ctx.db.get(conversationId);
  if (!c) return null;
  if (c.kind === "group" && c.title) return said(c.title, 60);
  const people = await getSummaries(ctx, c.memberIds.filter((id) => id !== viewerId).slice(0, 3));
  return [...people.values()].map(first).join(", ") || null;
}

/** A pending proposal as a draft the chat can show and the person can approve or discard. */
async function draftFound(ctx: QueryCtx, p: Doc<"proposals">): Promise<Found> {
  const pay = p.payload;
  const key = foundKey("draft", p._id);
  let summary: string;
  let text: string;
  let to: string | null = null;
  let photo: string | null = null;
  const more: { [key: string]: Json | undefined } = {};
  switch (pay.kind) {
    case "message":
      to = await chatWith(ctx, pay.conversationId, p.ownerId);
      summary = `Message to ${to ?? "a chat"}`;
      text = pay.text;
      if (pay.poll) more.poll = said(pay.poll.question, 200);
      break;
    case "offer": {
      const listing = await ctx.db.get(pay.listingId);
      to = await chatWith(ctx, pay.conversationId, p.ownerId);
      summary = `Offer of ${dollars(pay.amount)} on ${listing ? title(listing.title) : "a listing"}`;
      text = pay.text;
      photo = listing?.photos[0] ?? null;
      more.amount = pay.amount;
      more.listingKey = foundKey("listing", pay.listingId);
      if (listing) more.listedPrice = listing.price;
      break;
    }
    case "event": {
      const people = await getSummaries(ctx, pay.inviteIds.slice(0, 6));
      to = [...people.values()].map(first).join(", ") || null;
      summary = `Event: ${title(pay.title)}`;
      text = pay.description;
      more.startsAt = iso(pay.startAt);
      more.venue = pay.venue ? said(pay.venue, 80) : null;
      more.invites = pay.inviteIds.length;
      break;
    }
    case "group": {
      const people = await getSummaries(ctx, pay.inviteIds.slice(0, 6));
      to = [...people.values()].map(first).join(", ") || null;
      summary = `Group: ${title(pay.name)}`;
      text = pay.description;
      more.privacy = pay.privacy;
      more.invites = pay.inviteIds.length;
      break;
    }
  }
  const body = said(text, TEXT_MAX);
  const why = said(p.rationale, 200);
  const d = { id: p._id as string, summary, text: body };
  // Approving sends the draft as written. The chat offers that only when what it
  // shows is all of it: a plain message or an offer, neither cut nor redacted. A
  // poll, an Event or a Group has more to it than its text (options, time, invites),
  // so those are read and approved in the Inbox.
  const approvable =
    body === text.trim() && (pay.kind === "offer" || (pay.kind === "message" && !pay.poll));
  const card: ChatCard = {
    key,
    kind: "draft",
    title: summary,
    lines: [
      body,
      ...(approvable ? [] : ["Read and approve it in your Inbox"]),
      ...(pay.kind === "event" ? [dayLabel(iso(pay.startAt))] : []),
      ...(p.expiresAt ? [`Sends only if approved by ${dayLabel(iso(p.expiresAt))}`] : []),
    ]
      .filter(Boolean)
      .slice(0, 3),
    photo,
    href: "/landing/inbox",
    actions: approvable ? [approveDraftAction(d), discardDraftAction(d)] : [discardDraftAction(d)],
  };
  return {
    key,
    facts: {
      kind: "draft",
      key,
      id: p._id,
      type: pay.kind,
      summary,
      approvable,
      // Their own draft may carry a phone number or a link they typed: Muse doesn't read those.
      text: body,
      to,
      why,
      expires: p.expiresAt ? iso(p.expiresAt) : null,
      ...more,
    },
    link: { label: summary, href: "/landing/inbox" },
    card,
  };
}

/** The viewer's drafts as the Inbox lists them: what expires soonest first, then newest. */
async function waitingDrafts(ctx: QueryCtx, viewerId: Id<"users">) {
  const { rows } = await waitingProposals(ctx, viewerId, Date.now());
  return rows.sort(
    (x, y) =>
      (x.expiresAt ?? Number.POSITIVE_INFINITY) - (y.expiresAt ?? Number.POSITIVE_INFINITY) ||
      y.createdAt - x.createdAt,
  );
}

async function myDrafts(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const rows = await waitingDrafts(ctx, viewer._id);
  const found = await Promise.all(rows.slice(0, TOOL_RESULTS_MAX).map((p) => draftFound(ctx, p)));
  return {
    // Nothing here is sent or created until they approve it, here or in the Inbox.
    result: listed(found, { waiting: rows.length, page: "inbox" }),
    found,
  };
}

/* ---------------- Negotiations ---------------- */

const NEGOTIATION_STATUS = { active: "Active", paused: "Paused", stopped: "Stopped" } as const;

/**
 * One of the viewer's negotiations, or null when the listing is gone or its
 * seller is blocked either way. Call it only with a row the viewer is buying on.
 */
async function negotiationFound(ctx: QueryCtx, n: Doc<"negotiations">): Promise<Found | null> {
  const listing = await ctx.db.get(n.listingId);
  if (!listing || (await isBlockedEitherWay(ctx, n.buyerId, listing.sellerId))) return null;
  const [seller, pending] = await Promise.all([
    getSummary(ctx, listing.sellerId),
    n.pendingProposalId ? ctx.db.get(n.pendingProposalId) : null,
  ]);
  const key = foundKey("negotiation", n._id);
  const name = title(listing.title);
  const draftWaiting = pending?.status === "pending";
  const ref = { id: n._id as string, title: name };
  const card: ChatCard = {
    key,
    kind: "negotiation",
    title: name,
    lines: [
      `Listed at ${dollars(listing.price)} · up to ${dollars(n.maxPrice)}`,
      `${NEGOTIATION_STATUS[n.status]}${n.lastOffer ? ` · last offer ${dollars(n.lastOffer)}` : ""}`,
      ...(draftWaiting ? ["Muse's next message is waiting for your OK"] : []),
    ],
    photo: listing.photos[0] ?? null,
    href: "/landing/place",
    actions:
      n.status === "active"
        ? [setNegotiationAction(ref, "paused"), setNegotiationAction(ref, "stopped")]
        : n.status === "paused"
          ? [setNegotiationAction(ref, "active"), setNegotiationAction(ref, "stopped")]
          : [setNegotiationAction(ref, "active")],
  };
  return {
    key,
    facts: {
      kind: "negotiation",
      key,
      id: n._id,
      title: name,
      status: n.status,
      maxPrice: n.maxPrice,
      listingKey: foundKey("listing", listing._id),
      listedPrice: listing.price,
      // sold or pending: there's nothing left to negotiate.
      listingStatus: listing.status,
      targetPrice: n.targetPrice ?? null,
      lastOffer: n.lastOffer ?? null,
      lastMove: n.lastMove ?? null,
      draftWaiting,
      ...(draftWaiting && pending ? { draftKey: foundKey("draft", pending._id) } : {}),
      seller: seller ? first(seller) : null,
    },
    link: { label: `Negotiation on ${name}`, href: "/landing/place" },
    card,
  };
}

async function myNegotiations(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const rows = await ctx.db
    .query("negotiations")
    .withIndex("by_buyer", (q) => q.eq("buyerId", viewer._id))
    .order("desc")
    .take(SCAN_MAX);
  const found: Found[] = [];
  for (const n of rows) {
    if (found.length === TOOL_RESULTS_MAX) break;
    const f = await negotiationFound(ctx, n);
    if (f) found.push(f);
  }
  return {
    // Muse drafts each offer; every one waits for their OK before it's sent.
    result: listed(found, { page: "place" }),
    found,
  };
}

/* ---------------- Movers ---------------- */

/** Mover rate cards read; a city has a handful of mover Pages. */
const MOVERS_MAX = 30;

async function myMovers(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const req = await ctx.db
    .query("moveRequests")
    .withIndex("by_user", (q) => q.eq("userId", viewer._id))
    .unique();
  if (!req)
    return nothing(
      "They haven't described their move for mover quotes yet. They do that on their place's page.",
      "place",
    );
  const [rates, a] = await Promise.all([
    ctx.db.query("moverRates").take(MOVERS_MAX),
    loadAudience(ctx, viewer._id),
  ]);
  const movers = [];
  for (const r of rates) {
    const page = await getSummary(ctx, r.pageId);
    // Rates whose posts they can't see (or that cite nothing) aren't shown, as on the page.
    if (!page || !r.citations || !(await resolveCitations(ctx, r.citations, a))) continue;
    const out = await ctx.db
      .query("moverOutreach")
      .withIndex("by_user_page", (q) => q.eq("userId", viewer._id).eq("pageId", r.pageId))
      .unique();
    const [proposal, counter] = await Promise.all([
      out ? ctx.db.get(out.proposalId) : null,
      out?.counterProposalId ? ctx.db.get(out.counterProposalId) : null,
    ]);
    // none: not asked. waiting: Muse's request awaits their OK. sent, replied or discarded after that.
    let status: "none" | "waiting" | "sent" | "replied" | "discarded" = "none";
    let quoted: number | null = null;
    if (out && proposal) {
      status =
        proposal.status === "pending"
          ? "waiting"
          : proposal.status === "approved" || proposal.status === "edited"
            ? "sent"
            : "discarded";
      if (status === "sent") {
        const msgs = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", out.conversationId))
          .order("desc")
          .take(20);
        const reply = msgs.find(
          (m) =>
            m.senderId === r.pageId &&
            m.status === "sent" &&
            m.createdAt > (proposal.decidedAt ?? 0),
        );
        if (reply) {
          status = "replied";
          quoted = quotedPrice(reply.text);
        }
      }
    }
    const e = estimate(r.card as RateCard, { size: req.size, date: req.date, stairs: req.stairs });
    movers.push({
      mover: said(page.name, 80),
      estimate: e.total,
      hours: e.hours,
      deal: e.applied ? `${said(e.applied.label, 60)} (${e.applied.percent}% off)` : null,
      status,
      quoted,
      counterWaiting: counter?.status === "pending",
    });
  }
  movers.sort((x, y) => (x.quoted ?? x.estimate) - (y.quoted ?? y.estimate));
  return {
    result: {
      move: {
        size: req.size,
        date: req.date,
        // Display names, as they picked them.
        from: said(req.fromNeighborhood, 60),
        to: said(req.toNeighborhood, 60),
        stairs: req.stairs,
        quotesRequested: req.requestedAt !== undefined,
      },
      // Cheapest first. Estimates are Landing's math from each mover's posted rates.
      movers,
      page: "place",
    },
    found: [],
  };
}

/* ---------------- Move out ---------------- */

async function myMoveOut(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const [sublets, owned] = await Promise.all([
    ctx.db
      .query("sublets")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .take(5),
    ctx.db
      .query("ownedItems")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .order("desc")
      .take(LIST_MAX),
  ]);
  if (!sublets.length && !owned.length)
    return nothing(
      "They aren't subletting and Landing tracks nothing they own yet. Both start on the move-out page.",
      "moveout",
    );
  const sublet = [];
  for (const s of sublets) {
    const l = await ctx.db.get(s.listingId);
    if (!l) continue;
    const chats = await ctx.db
      .query("conversations")
      .withIndex("by_listing", (q) => q.eq("listingId", l._id))
      .take(SCAN_MAX);
    sublet.push({
      title: title(l.title),
      rent: l.price,
      lowestRent: s.minRent,
      // active: listed; pending: a renter is lined up; sold: subleased.
      status: l.status,
      museReplies: s.museReplies,
      renterChats: chats.length,
    });
  }
  const items = [];
  for (const o of owned) {
    // A sale listing that was deleted no longer counts as listed.
    const sale = o.saleListingId ? await ctx.db.get(o.saleListingId) : null;
    items.push({
      title: title(o.title),
      paid: o.price,
      forSale: sale ? { asking: sale.price, status: sale.status } : null,
      lowestPrice: o.saleMinPrice ?? null,
      museReplies: o.saleMuse ?? null,
    });
  }
  return { result: { sublets: sublet, items, page: "moveout" }, found: [] };
}

/* ---------------- City Profile ---------------- */

async function myProfile(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const known = await knownFacts(ctx, viewer._id);
  if (known.briefCompletedAt === null && !known.facts.length)
    return nothing(
      "Their City Profile isn't set up yet. The City Profile brief sets it up.",
      "welcome",
    );
  return {
    result: {
      setUp: known.briefCompletedAt !== null,
      // stated: they said so. inferred: Landing worked it out from what they did, as `from` says.
      facts: known.facts.map((f) => ({
        about: FACT_KEY_LABELS[f.key],
        value: said(factLabel(f), 120),
        source: f.source,
        from: said(f.evidence.summary, 200),
      })),
      removedByThem: known.removed.length,
      pages: ["profile", "welcome"],
    },
    found: [],
  };
}

/* ---------------- Saved ---------------- */

async function mySaved(ctx: QueryCtx, viewer: ToolViewer): Promise<ToolOutput> {
  const rows = await ctx.db
    .query("saved")
    .withIndex("by_user", (q) => q.eq("userId", viewer._id))
    .order("desc")
    .take(SCAN_MAX);
  const found: Found[] = [];
  for (const r of rows) {
    if (found.length === TOOL_RESULTS_MAX) break;
    if (r.kind === "post") continue;
    const f = await again(ctx, viewer, r.kind, r.refId);
    if (f) found.push(f);
  }
  // Newest first. Saved posts aren't listed here.
  return { result: listed(found, { saves: rows.length }), found };
}

/* ---------------- The tool ---------------- */

const SECTIONS: Record<About, (ctx: QueryCtx, viewer: ToolViewer) => Promise<ToolOutput>> = {
  place: myPlace,
  house: myHouse,
  crew: myCrew,
  roommates: myRoommates,
  journey: myJourney,
  drafts: myDrafts,
  negotiations: myNegotiations,
  movers: myMovers,
  moveout: myMoveOut,
  profile: myProfile,
  saved: mySaved,
};

export const MINE_TOOLS: readonly HomeTool[] = [
  {
    name: "get_my_move",
    description: `Reads one part of the person's own move, as Landing shows it to them. Pick \`about\`:
- place: their place (status, neighborhood, dates, the rental and its rent), their 3D apartment (model state, the look and furniture budget, what's placed and what it costs) and whether they sublet it.
- house: the house they share: housemates, chores, bills and the grocery list.
- crew: their Move-in Crew: who is in it and what they have in common, and the crew's Group and first meetup.
- roommates: their roommate matches, with how they're connected, what plans overlap and the compatibility score with its reasons.
- journey: this weekend's Journey stops, and their check-in (what they've done since moving in, their level).
- drafts: messages, offers, Events and Groups Muse drafted that wait for their OK. approvable says whether it can be approved from the chat; the rest are read and approved in the Inbox.
- negotiations: Marketplace items Muse is negotiating for them: limits, last offer, whether a draft is waiting.
- movers: their move request and each mover's estimate, quote and status.
- moveout: their sublet and the things they own or have listed for sale.
- profile: everything Landing knows about them (City Profile facts), each with where it came from.
- saved: the listings and Events they saved.
When a part has nothing yet, the result says why and names the page that sets it up.`,
    args: v.object({ about: literals(...ABOUT) }),
    run: (ctx, viewer, args) => SECTIONS[args.about as About](ctx, viewer),
  },
];

/* ---------------- Reading again by key ---------------- */

const reads = new WeakMap<QueryCtx, Map<string, Promise<unknown>>>();

/** One read per query: several keys recalled together share the list they're looked up in. */
function once<T>(ctx: QueryCtx, key: string, load: () => Promise<T>): Promise<T> {
  let byKey = reads.get(ctx);
  if (!byKey) {
    byKey = new Map();
    reads.set(ctx, byKey);
  }
  let value = byKey.get(key) as Promise<T> | undefined;
  if (!value) {
    value = load();
    byKey.set(key, value);
  }
  return value;
}

export const RECALL_MINE: Pick<Record<FoundKind, Recall>, "person" | "draft" | "negotiation"> = {
  /** Only someone the viewer already sees on Landing: a roommate match or a crew member. */
  person: async (ctx, viewer, id) => {
    const userId = ctx.db.normalizeId("users", id);
    if (!userId) return null;
    const matches = await once(ctx, `matches:${viewer._id}`, () =>
      roommateCandidates(ctx, viewer._id),
    );
    const match = matches?.candidates.find((c) => c.user._id === userId);
    if (match) return roommatePerson(match);
    const crew = await once(ctx, `crew:${viewer._id}`, () => viewerCrew(ctx, viewer));
    const mate = crew?.find((m) => m.user._id === userId);
    return mate ? crewPerson(mate, false) : null;
  },
  /** Only the viewer's own draft, while it still waits and can still be sent. */
  draft: async (ctx, viewer, id) => {
    const proposalId = ctx.db.normalizeId("proposals", id);
    const p =
      proposalId &&
      (await once(ctx, `drafts:${viewer._id}`, () => waitingDrafts(ctx, viewer._id))).find(
        (x) => x._id === proposalId,
      );
    return p ? draftFound(ctx, p) : null;
  },
  /** Only a negotiation the viewer is the buyer in. */
  negotiation: async (ctx, viewer, id) => {
    const negotiationId = ctx.db.normalizeId("negotiations", id);
    const n = negotiationId && (await ctx.db.get(negotiationId));
    return n && n.buyerId === viewer._id ? negotiationFound(ctx, n) : null;
  },
};

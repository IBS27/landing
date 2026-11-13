import { linkOptions } from "@tanstack/react-router";
import type { Id, TableNames } from "../../convex/_generated/dataModel";
import { compareSearch } from "./neighborhoods/compare";

/**
 * Links from Landing to the Facebook objects it shows. Landing never renders
 * its own Group, Event, profile, listing or chat page: it links to the
 * clone's. Each helper returns TanStack link options, so spread it into a
 * `<Link>` or pass it to `navigate` / `redirect`:
 *
 *   <Link {...toGroup(group)} className="...">{group.name}</Link>
 *   navigate(toConversation(conversationId))
 */

type Ref<T extends TableNames> = Id<T> | { _id: Id<T> };
const idOf = <T extends TableNames>(ref: Ref<T>): Id<T> =>
  typeof ref === "string" ? ref : ref._id;

/** A Group's page. Groups are addressed by slug in URLs; an id works too. */
export function toGroup(group: Id<"groups"> | { slug: string }) {
  return linkOptions({
    to: "/groups/$groupId",
    params: { groupId: typeof group === "string" ? group : group.slug },
  });
}

/** An Event's page. */
export function toEvent(event: Ref<"events">) {
  return linkOptions({ to: "/events/$eventId", params: { eventId: idOf(event) } });
}

/** A person's or Page's profile. Any user doc or `userSummary` works. */
export function toProfile(user: { username: string }) {
  return linkOptions({ to: "/$username", params: { username: user.username } });
}

/** A Marketplace listing (items and rentals). */
export function toListing(listing: Ref<"listings">) {
  return linkOptions({
    to: "/marketplace/item/$listingId",
    params: { listingId: idOf(listing) },
  });
}

/**
 * Landing's view of a rental: its verified levels and things to check (#73) and
 * the lister's network (#65), linking on to the Marketplace listing.
 */
export function toRentalCheck(listing: Ref<"listings">) {
  return linkOptions({
    to: "/landing/find/listing/$listingId",
    params: { listingId: idOf(listing) },
  });
}

/** A neighborhood's page (#16), by slug. */
export function toNeighborhood(neighborhood: string | { slug: string }) {
  return linkOptions({
    to: "/landing/find/neighborhoods/$slug",
    params: { slug: typeof neighborhood === "string" ? neighborhood : neighborhood.slug },
  });
}

/**
 * "Try the neighborhood" (#19) with `a` and `b` picked when given. Unknown
 * slugs, and `b` when it repeats `a`, are dropped, so the page asks for them.
 */
export function toCompare(a?: string, b?: string) {
  return linkOptions({
    to: "/landing/find/neighborhoods/compare",
    search: compareSearch({ a, b }),
  });
}

/** A Messenger chat, full page. */
export function toConversation(conversation: Ref<"conversations">) {
  return linkOptions({
    to: "/messages/t/$conversationId",
    params: { conversationId: idOf(conversation) },
  });
}

/** A post's permalink, under its author's profile. */
export function toPost(post: { postId: Id<"posts">; username: string }) {
  return linkOptions({
    to: "/$username/posts/$postId",
    params: { username: post.username, postId: post.postId },
  });
}

/** My Place: the person's place, rooms and house. */
export function toMyPlace() {
  return linkOptions({ to: "/landing/place" });
}

/** One of the person's rooms: its scan and vibe (#25). */
export function toRoom(room: Ref<"rooms">) {
  return linkOptions({ to: "/landing/place/room", search: { room: idOf(room) } });
}

/**
 * The 3D unit (#37): a saved one, a new one started from a rental, or (none
 * given) the start page, which begins from the person's place. With `room`,
 * opens that room's unit (or offers to create it). `placeItem` or
 * `placeListing` arrives with that item ready to place (#131).
 */
export function toUnit(
  unit: {
    unit?: Id<"unitScenes">;
    listing?: Id<"listings">;
    room?: Id<"rooms">;
    placeItem?: Id<"ownedItems">;
    placeListing?: Id<"listings">;
  } = {},
) {
  return linkOptions({ to: "/landing/place/unit", search: unit });
}

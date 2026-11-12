/**
 * Route params for a group link. Groups are addressed by slug in URLs
 * (`/groups/$groupId`); change it here if that ever moves to ids.
 */
export function groupParams(g: { slug: string }) {
  return { groupId: g.slug };
}

/** Today as "MM-DD" in the viewer's timezone (matches `users.birthday`). */
export function todayKey(d = new Date()) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

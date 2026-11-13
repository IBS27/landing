import type { ChatAction, ChatActionCard } from "./homeChatRules";

/**
 * The action cards in Landing Home's chat (#154), worded by code. An action
 * names what the person can have done; the page runs it only on their click
 * (src/landing/home). Pure and client-safe. Titles passed in are already
 * redacted and capped by whoever read them.
 */

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

/** "Sat, Nov 16" in San Francisco, from an ISO time or a "YYYY-MM-DD" date. */
export function dayLabel(when: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(when);
  const d = new Date(date ? `${when}T12:00:00Z` : when);
  if (Number.isNaN(d.getTime())) return when;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: date ? "UTC" : "America/Los_Angeles",
  }).format(d);
}

export function rsvpAction(
  e: { id: string; title: string; startsAt: string },
  status: "going" | "interested",
): ChatActionCard {
  return {
    action: { kind: "rsvp", eventId: e.id, status },
    label: `${status === "going" ? "RSVP Going to" : "Mark Interested in"} ${e.title} · ${dayLabel(e.startsAt)}`,
    confirm: status === "going" ? "Going" : "Interested",
  };
}

export function joinGroupAction(g: { id: string; name: string }): ChatActionCard {
  return {
    action: { kind: "join_group", groupId: g.id },
    label: `Join ${g.name}`,
    confirm: "Join",
  };
}

export function saveListingAction(l: { id: string; title: string }): ChatActionCard {
  return {
    action: { kind: "save_listing", listingId: l.id },
    label: `Save ${l.title}`,
    confirm: "Save",
  };
}

export function choosePlaceAction(
  l: { id: string; title: string; price: number },
  moveIn: string,
): ChatActionCard {
  return {
    action: { kind: "choose_place", listingId: l.id, moveIn },
    label: `Make ${l.title} your place, moving in ${dayLabel(moveIn)}`,
    detail: `${money(l.price)} a month. Only you can see it; the lister isn't told.`,
    confirm: "Make it my place",
  };
}

export function negotiateAction(
  l: { id: string; title: string; price: number },
  terms: { maxPrice: number; targetPrice?: number; notes?: string },
): ChatActionCard {
  return {
    action: {
      kind: "negotiate",
      listingId: l.id,
      maxPrice: terms.maxPrice,
      ...(terms.targetPrice === undefined ? {} : { targetPrice: terms.targetPrice }),
      ...(terms.notes ? { notes: terms.notes } : {}),
    },
    label: `Have Muse negotiate ${l.title}, up to ${money(terms.maxPrice)}`,
    // Everything the negotiation will be told, notes included: they steer every later offer.
    detail: `Listed at ${money(l.price)}${terms.targetPrice === undefined ? "" : `, aiming for ${money(terms.targetPrice)}`}. Every offer waits for your OK before it's sent.${terms.notes ? ` Notes for Muse: "${terms.notes}"` : ""}`,
    confirm: "Start",
  };
}

const NEGOTIATION_VERB = { active: "Resume", paused: "Pause", stopped: "Stop" } as const;

export function setNegotiationAction(
  n: { id: string; title: string },
  status: "active" | "paused" | "stopped",
): ChatActionCard {
  return {
    action: { kind: "set_negotiation", negotiationId: n.id, status },
    label: `${NEGOTIATION_VERB[status]} Muse's negotiation on ${n.title}`,
    confirm: NEGOTIATION_VERB[status],
  };
}

/** A waiting draft: `summary` says what approving does, `text` is what would be sent. */
export function approveDraftAction(d: {
  id: string;
  summary: string;
  text?: string;
}): ChatActionCard {
  return {
    action: { kind: "approve_draft", proposalId: d.id },
    label: `Approve: ${d.summary}`,
    ...(d.text ? { detail: d.text } : {}),
    confirm: "Approve",
  };
}

export function discardDraftAction(d: { id: string; summary: string }): ChatActionCard {
  return {
    action: { kind: "discard_draft", proposalId: d.id },
    label: `Discard: ${d.summary}`,
    confirm: "Discard",
  };
}

export function addGroceryAction(
  house: { id: string; name: string },
  text: string,
): ChatActionCard {
  return {
    action: { kind: "add_grocery", houseId: house.id, text },
    label: `Add "${text}" to ${house.name}'s grocery list`,
    confirm: "Add",
  };
}

const CADENCE = { once: "once", weekly: "every week", monthly: "every month" } as const;

export function addChoreAction(
  house: { id: string; name: string },
  chore: { title: string; cadence: "once" | "weekly" | "monthly" },
): ChatActionCard {
  return {
    action: { kind: "add_chore", houseId: house.id, title: chore.title, cadence: chore.cadence },
    label: `Add the chore "${chore.title}" (${CADENCE[chore.cadence]}) to ${house.name}`,
    confirm: "Add",
  };
}

export function addBillAction(
  house: { id: string; name: string },
  bill: { title: string; amount: number; cadence: "once" | "monthly"; dueDate?: string },
): ChatActionCard {
  return {
    action: {
      kind: "add_bill",
      houseId: house.id,
      title: bill.title,
      amount: bill.amount,
      cadence: bill.cadence,
      ...(bill.dueDate ? { dueDate: bill.dueDate } : {}),
    },
    label: `Add the bill "${bill.title}" for ${money(bill.amount)} (${CADENCE[bill.cadence]}) to ${house.name}`,
    ...(bill.dueDate ? { detail: `Due ${dayLabel(bill.dueDate)}.` } : {}),
    confirm: "Add",
  };
}

export function askRoommateAction(p: { id: string; name: string }, text: string): ChatActionCard {
  return {
    action: { kind: "ask_roommate", userId: p.id, text },
    label: `Send ${p.name} this intro`,
    detail: text,
    confirm: "Send",
  };
}

/** What the page says once an action ran. */
export function actionDone(a: ChatAction): string {
  switch (a.kind) {
    case "rsvp":
      return a.status === "going" ? "You're going." : "Marked as interested.";
    case "join_group":
      return "You joined.";
    case "save_listing":
      return "Saved.";
    case "choose_place":
      return "That's your place.";
    case "negotiate":
      return "Started. Muse's first offer will wait for your OK.";
    case "set_negotiation":
      return a.status === "active" ? "Resumed." : a.status === "paused" ? "Paused." : "Stopped.";
    case "approve_draft":
      return "Approved.";
    case "discard_draft":
      return "Discarded.";
    case "add_grocery":
    case "add_chore":
    case "add_bill":
      return "Added.";
    case "ask_roommate":
      return "Sent.";
  }
}

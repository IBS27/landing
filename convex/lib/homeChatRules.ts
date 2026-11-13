import {
  CHAT_ALIASES,
  type ChatNeighborhood,
  type ChatView,
  cleanVibe,
  findNeighborhoods,
  furnishAsk,
  furnishRequest,
  priceIn,
  RENTAL_WORDS,
  type RulesWhy,
  spendIn,
  validFurnishBudget,
  vibeProblem,
  words,
} from "./chatText";
import { todayInSF } from "./cityProfileFacts";
import { FURNISH_LIMITS, kindList } from "./furnish";
import { planIn, statesPlan } from "./movePlan";
import { hasProtected, redactProtected } from "./protectedText";
import { ALL_ITEM_KINDS, type PlacementKind } from "./unitScene";

/**
 * Landing Home's chat dock: the person types, and the reply carries one
 * command the client runs (fly to a neighborhood, show rentals, open a page,
 * show or furnish their 3D apartment, #150, or add named things to it, #153).
 * Muse answers on the server
 * (`api.homeChat.reply`, convex/homeChat.ts); these keyword rules are its
 * fallback there (AI off, a rejected answer, a model error) and in the browser
 * when the action can't be reached. Pure, so the client and the server share it.
 */

export {
  CHAT_ALIASES,
  type ChatNeighborhood,
  type ChatView,
  cleanVibe,
  findNeighborhoods,
  priceIn,
};

export type ChatStage = "globe" | "city" | "hood" | "house";
export type ChatContext = {
  stage: ChatStage;
  neighborhood?: string /* slug */;
  /** The tab that's showing. Absent means the map. */
  view?: ChatView;
};
export type ChatPage =
  | "find"
  | "place"
  | "crew"
  | "journeys"
  | "moveout"
  | "profile"
  | "inbox"
  | "roommates"
  | "house"
  | "room"
  | "unit"
  | "neighborhoods"
  | "welcome";
export type ChatCommand =
  | { kind: "show_move" } // globe → Bay Area, origin → destination
  | { kind: "fly_neighborhood"; slug: string }
  | { kind: "compare"; a: string; b: string } // slugs
  | { kind: "weekend_route"; slug: string }
  | { kind: "show_rentals"; maxPrice?: number }
  | { kind: "open_listing"; listingId: string }
  | { kind: "show_pins"; layer: "events" | "groups" | "homes" | "items"; slug?: string }
  | { kind: "show_crew" }
  | { kind: "open_page"; page: ChatPage }
  | { kind: "open_neighborhood_page"; slug: string }
  | { kind: "show_apartment" } // the Apartment tab: the 3D model of their place
  /** Furnish the apartment: `vibe` in the person's words, `budget` for all the furniture, whole dollars. */
  | { kind: "furnish"; vibe: string; budget?: number }
  /**
   * Add the things the person named and nothing else (#153): `items` is one to
   * four different kinds, `want` how they described them ("reading"), `budget`
   * the most this request may spend, whole dollars. Never the whole apartment.
   */
  | { kind: "add_items"; items: PlacementKind[]; want?: string; budget?: number }
  | { kind: "none" };
export type ChatSource = { label: string; href?: string };
/** A ranked rental as a card in the reply. Code builds every field; Muse writes none of it. */
export type ChatRentalCard = {
  id: string;
  title: string;
  /** Monthly rent, whole dollars. */
  price: number;
  photo: string | null;
  /** The neighborhood's display name ("SoMa"). */
  neighborhood: string | null;
  /** Why it ranks where it does, each with its sources. */
  reasons: { text: string; sources: ChatSource[] }[];
  /** "YYYY-MM-DD"; null or absent means available now. */
  availableFrom?: string | null;
};
export type ChatReply = {
  text: string;
  command: ChatCommand;
  sources: ChatSource[];
  via: "muse" | "rules";
  /** Why the rules answered (#153), when the server said; absent for Muse's answers and the browser's. */
  why?: RulesWhy;
  /** Rentals the reply names or shows, as cards the person can choose from. */
  rentals: ChatRentalCard[];
  /** What this message added to the City Profile ("Budget up to $2,400/mo"). */
  saved: string[];
};
/** A ranked rental the rules may name (optional `data.rentals`). Price is monthly, whole dollars. */
export type ChatRental = { id: string; title: string; price: number; slug?: string };

/** The longest message the chat sends, in characters. */
export const CHAT_MESSAGE_MAX = 500;
/** How many earlier turns go with a message, and how much of each. */
export const CHAT_RECENT_MAX = 6;
export const CHAT_TURN_MAX = 300;
/** Most rental cards one reply carries. */
export const CHAT_CARDS_MAX = 4;

export const CHAT_PAGES = [
  "find",
  "place",
  "crew",
  "journeys",
  "moveout",
  "profile",
  "inbox",
  "roommates",
  "house",
  "room",
  "unit",
  "neighborhoods",
  "welcome",
] as const satisfies readonly ChatPage[];
export const PIN_LAYERS = ["events", "groups", "homes", "items"] as const;

const PAGE_INFO: Record<ChatPage, { label: string; href: string }> = {
  find: { label: "Find a place", href: "/landing/find" },
  place: { label: "Your place", href: "/landing/place" },
  crew: { label: "Move-in Crew", href: "/landing/crew" },
  journeys: { label: "Journeys", href: "/landing/crew/journeys" },
  moveout: { label: "Move out", href: "/landing/move-out" },
  profile: { label: "City Profile", href: "/landing/profile" },
  inbox: { label: "Inbox", href: "/landing/inbox" },
  roommates: { label: "Roommates", href: "/landing/place/roommates" },
  house: { label: "Your house", href: "/landing/place/house" },
  room: { label: "Your room", href: "/landing/place/room" },
  unit: { label: "3D unit editor", href: "/landing/place/unit" },
  neighborhoods: { label: "Neighborhoods", href: "/landing/find/neighborhoods" },
  welcome: { label: "City Profile brief", href: "/landing/welcome" },
};

/** The Landing route for a chat page. */
export function pageHref(page: ChatPage): string {
  return PAGE_INFO[page].href;
}

/** A chat page as a source: its name, linking to it. */
export function pageSource(page: ChatPage): ChatSource {
  return PAGE_INFO[page];
}

/** A rental as a chat source: its title and rent, linking to Landing's view of it. */
export function rentalSource(r: { id: string; title: string; price: number }): ChatSource {
  return { label: `${r.title} · ${money(r.price)}/mo`, href: `/landing/find/listing/${r.id}` };
}

function nameOf(slug: string, neighborhoods: ChatNeighborhood[]): string {
  const n = neighborhoods.find((x) => x.slug === slug);
  return n ? (n.aliases?.[0] ?? n.name) : slug;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/**
 * Whether a command only names neighborhoods and listings that exist, a
 * furnish request carries a clean vibe and a sane budget, and a request to add
 * things names one to four different kinds. Whether there is an apartment to
 * show or furnish is the server's check (convex/homeChat.ts).
 */
export function validCommand(
  cmd: ChatCommand,
  data: { neighborhoods: ChatNeighborhood[]; listingIds?: string[] },
): boolean {
  const slugs = new Set(data.neighborhoods.map((n) => n.slug));
  switch (cmd.kind) {
    case "show_move":
    case "show_crew":
    case "show_apartment":
    case "none":
      return true;
    case "fly_neighborhood":
    case "weekend_route":
    case "open_neighborhood_page":
      return slugs.has(cmd.slug);
    case "compare":
      return slugs.has(cmd.a) && slugs.has(cmd.b) && cmd.a !== cmd.b;
    case "show_rentals":
      return (
        cmd.maxPrice === undefined ||
        (Number.isFinite(cmd.maxPrice) && cmd.maxPrice > 0 && cmd.maxPrice <= 100_000)
      );
    case "open_listing":
      // Without the viewer's listings to check against, no id is known.
      return data.listingIds?.includes(cmd.listingId) ?? false;
    case "show_pins":
      return (
        (PIN_LAYERS as readonly string[]).includes(cmd.layer) &&
        (cmd.slug === undefined || slugs.has(cmd.slug))
      );
    case "open_page":
      return (CHAT_PAGES as readonly string[]).includes(cmd.page);
    case "furnish":
      return (
        vibeProblem(cmd.vibe) === null &&
        (cmd.budget === undefined || validFurnishBudget(cmd.budget))
      );
    case "add_items":
      return (
        addItemsProblems(cmd).length === 0 &&
        (cmd.budget === undefined || validFurnishBudget(cmd.budget))
      );
    default:
      return false;
  }
}

/**
 * What's wrong with the things an `add_items` command names and how it
 * describes them (#153): one to four different kinds of thing, and a `want`
 * that is empty or passes the same checks as a vibe. Empty when fine.
 */
export function addItemsProblems(cmd: { items: readonly string[]; want?: string }): string[] {
  const problems: string[] = [];
  const kinds: readonly string[] = ALL_ITEM_KINDS;
  if (
    cmd.items.length < 1 ||
    cmd.items.length > FURNISH_LIMITS.onlyMax ||
    new Set(cmd.items).size !== cmd.items.length ||
    !cmd.items.every((k) => kinds.includes(k))
  )
    problems.push(
      `command.items: one to ${FURNISH_LIMITS.onlyMax} different kinds, each one of ${kinds.join(", ")}`,
    );
  const want = cmd.want?.trim() ? vibeProblem(cmd.want) : null;
  if (want) problems.push(`command.want: ${want}`);
  return problems;
}

/**
 * Links that back a reply: the page the command opens or the neighborhood it
 * shows, plus any listings it names. Never an address.
 */
export function commandSources(
  cmd: ChatCommand,
  data: { neighborhoods: ChatNeighborhood[]; rentals?: ChatRental[] },
): ChatSource[] {
  const hood = (slug: string): ChatSource => ({
    label: `${nameOf(slug, data.neighborhoods)} neighborhood page`,
    href: `/landing/find/neighborhoods/${slug}`,
  });
  switch (cmd.kind) {
    case "fly_neighborhood":
    case "weekend_route":
    case "open_neighborhood_page":
      return [hood(cmd.slug)];
    case "compare":
      return [
        {
          label: `${nameOf(cmd.a, data.neighborhoods)} vs ${nameOf(cmd.b, data.neighborhoods)}`,
          href: `/landing/find/neighborhoods/compare?a=${encodeURIComponent(cmd.a)}&b=${encodeURIComponent(cmd.b)}`,
        },
      ];
    case "show_pins":
      return cmd.slug ? [hood(cmd.slug)] : [];
    case "show_rentals":
      return [PAGE_INFO.find];
    case "open_listing": {
      const r = data.rentals?.find((x) => x.id === cmd.listingId);
      return [
        r ? rentalSource(r) : { label: "Rental", href: `/landing/find/listing/${cmd.listingId}` },
      ];
    }
    case "show_crew":
      return [PAGE_INFO.crew];
    case "open_page":
      return [PAGE_INFO[cmd.page]];
    case "show_apartment":
      return [PAGE_INFO.place];
    default:
      return [];
  }
}

/**
 * The rental cards a reply carries, picked from the ranked `cards` it was
 * given and nothing else: the rentals it cites first, then, for
 * `show_rentals`, the top ranked ones within `maxPrice`. At most `CHAT_CARDS_MAX`.
 */
export function replyCards(
  command: ChatCommand,
  citedIds: readonly string[],
  cards: readonly ChatRentalCard[],
): ChatRentalCard[] {
  const cited = citedIds.flatMap((id) => cards.find((c) => c.id === id) ?? []);
  const shown =
    command.kind === "show_rentals"
      ? cards.filter((c) => command.maxPrice === undefined || c.price <= command.maxPrice)
      : [];
  return [...new Set([...cited, ...shown])].slice(0, CHAT_CARDS_MAX);
}

export const CHAT_HELP =
  'I can fly to a neighborhood, compare two, show rentals under a price, events or Groups nearby, a weekend route, your Move-in Crew, or furnish your apartment. Try "rooms under $2,000", "Mission vs Noe Valley" or "make my place cozy for $800".';

const PROTECTED_LINE =
  "Landing never picks places by who lives there or who you are. Ask about rent, commute, events or Groups instead.";

const VIBE_HELP = 'Describe the vibe in a few words, like "cozy and warm, under $800".';

/** What furnishing does and doesn't do, said the same way by every rules reply (#153). */
const REVIEW_LINE = "your private 3D model for you to review; nothing is bought or sent.";

/** The Inbox line (#153): how many drafts are waiting, when known. */
function inboxLine(waiting: number | undefined): string {
  if (waiting === undefined) return PAGE_LINES.inbox;
  if (waiting <= 0)
    return "Opening Inbox. Nothing is waiting for your OK right now; Muse's drafts show up there, and nothing is sent until you approve it.";
  return `Opening Inbox: ${waiting} ${waiting === 1 ? "draft is" : "drafts are"} waiting for your OK. Nothing is sent until you approve it.`;
}

const PAGE_LINES: Record<ChatPage, string> = {
  find: "Opening Find, with rentals ranked for your City Profile.",
  place: "Opening your place: roommates, the house and what fits.",
  crew: "Opening your Move-in Crew.",
  journeys: "Opening Journeys, your check-ins for the first 90 days.",
  moveout: "Opening Move out, where you can sublet your room and sell what you're not taking.",
  profile: "Opening your City Profile: everything Landing knows about you, which you can edit.",
  inbox:
    "Opening Inbox, where Muse's drafts wait for your OK. Nothing is sent until you approve it.",
  roommates: "Opening Roommates, where you set how you live and see who fits.",
  house: "Opening your house: chores, bills and groceries with your roommates.",
  room: "Opening your room, where you can scan it and pick a style.",
  unit: "Opening the 3D editor for your place, where you can change the layout.",
  neighborhoods: "Opening the list of San Francisco's neighborhoods.",
  welcome: "Opening your City Profile brief.",
};

const has = (re: RegExp, s: string) => re.test(s);

/** "Title at $X", unless the title already carries its price. */
function withPrice(r: ChatRental): string {
  const price = money(r.price);
  return r.title.includes(price) ? r.title : `${r.title} at ${price}`;
}

type Routed = { text: string; command: ChatCommand; listingIds: string[] };

/**
 * The rules' answer, plus the listings it names (so the server can cite them).
 * `ruleReply` is the browser's form.
 */
export function ruleRoute(
  message: string,
  ctx: ChatContext,
  data: {
    neighborhoods: ChatNeighborhood[];
    homeSlugs?: string[];
    rentals?: ChatRental[];
    /** The City Profile's budget top, for "in my budget". */
    budgetMax?: number | null;
    /** The message had protected traits removed before it got here. */
    hadProtected?: boolean;
    /**
     * Their apartment (#150): null with no place yet, absent when not known.
     * Furnishing needs its 3D model.
     */
    apartment?: { hasModel: boolean } | null;
    /** Today in San Francisco ("YYYY-MM-DD"), for move-in dates. Now, when absent. */
    today?: string;
    /** Drafts waiting in the Inbox (#153); absent when not known (the browser). */
    inboxWaiting?: number;
  },
): Routed {
  const fallbackLine = hasProtected(message) || data.hadProtected ? PROTECTED_LINE : CHAT_HELP;
  const none = (text = fallbackLine): Routed => ({
    text,
    command: { kind: "none" },
    listingIds: [],
  });
  // Route on the words with protected traits removed, so they can't steer anything.
  const clean = redactProtected(message);
  const t = words(clean);
  if (!t.trim()) return none();
  const hoods = findNeighborhoods(clean, data.neighborhoods);
  const valid = new Set(data.neighborhoods.map((n) => n.slug));
  const here = ctx.neighborhood && valid.has(ctx.neighborhood) ? ctx.neighborhood : undefined;
  const home = data.homeSlugs?.find((s) => valid.has(s));
  const name = (slug: string) => nameOf(slug, data.neighborhoods);
  const page = (p: ChatPage): Routed => ({
    text: p === "inbox" ? inboxLine(data.inboxWaiting) : PAGE_LINES[p],
    command: { kind: "open_page", page: p },
    listingIds: [],
  });
  // The move plan the message states (budget, move-in, where): it's answered with rentals.
  const plan = planIn(clean, {
    today: data.today ?? todayInSF(),
    neighborhoods: data.neighborhoods,
    view: ctx.view,
  });
  /** Rentals on the map, counted and with the cheapest named when the ranked list is known. */
  const showRentals = (maxPrice: number | undefined, lead = ""): Routed => {
    const rentals = (data.rentals ?? []).filter(
      (r) => maxPrice === undefined || r.price <= maxPrice,
    );
    const cheapest = [...rentals].sort((a, b) => a.price - b.price)[0];
    const under = maxPrice === undefined ? "" : ` under ${money(maxPrice)}`;
    const command: ChatCommand = {
      kind: "show_rentals",
      ...(maxPrice === undefined ? {} : { maxPrice }),
    };
    if (data.rentals && !cheapest)
      return {
        text: `${lead}No rentals in your ranked list are${under || " open"} right now. Try a higher limit.`,
        command,
        listingIds: [],
      };
    return {
      text:
        lead +
        (cheapest
          ? `${rentals.length} rental${rentals.length === 1 ? "" : "s"}${under}, ranked for you. The cheapest is ${withPrice(cheapest)}.`
          : `Showing rentals${under}, ranked for your City Profile.`),
      command,
      listingIds: cheapest ? [cheapest.id] : [],
    };
  };

  // Compare: two neighborhoods with "vs", "or", "compare"; or one plus where the map is.
  const comparing =
    has(/ (compare|vs|versus|difference) /, t) ||
    (has(/ (or|better) /, t) && !has(RENTAL_WORDS, t) && !statesPlan(plan));
  if (comparing && hoods.length >= 2)
    return {
      text: `Comparing ${name(hoods[0])} and ${name(hoods[1])} side by side.`,
      command: { kind: "compare", a: hoods[0], b: hoods[1] },
      listingIds: [],
    };
  if (has(/ compare /, t) && hoods.length === 1 && here && here !== hoods[0])
    return {
      text: `Comparing ${name(here)} and ${name(hoods[0])} side by side.`,
      command: { kind: "compare", a: here, b: hoods[0] },
      listingIds: [],
    };

  if (has(/ (inbox|approve|approvals?|drafts?|pending) /, t)) return page("inbox");
  if (
    has(
      / (set up my profile|set up my city profile|setup my profile|my brief|the brief|profile brief|onboarding) /,
      t,
    )
  )
    return page("welcome");
  if (has(/ (my profile|city profile|know about me|about me) /, t)) return page("profile");
  if (
    has(
      / (sell|selling|sublet my|sublet our|sublease my|sublet the room|move out|moveout|moving out|leaving) /,
      t,
    )
  )
    return page("moveout");
  if (has(/ (edit layout|edit the layout|edit my layout|floor plan|floorplan|unit editor) /, t))
    return page("unit");
  if (has(/ (scan my room|scan the room|scan a room|room scan|room photos?) /, t))
    return page("room");

  // Furnishing (#150) needs the apartment's 3D model; without one, say what comes first.
  if (furnishAsk(clean, { view: ctx.view, neighborhoods: data.neighborhoods })) {
    if (!data.apartment)
      return showRentals(
        undefined,
        "Choose a place first, and I can furnish it once its 3D model is built. ",
      );
    if (!data.apartment.hasModel)
      return {
        text: "Your apartment's 3D model is still being built. Ask me to furnish it once it's ready.",
        command: { kind: "show_apartment" },
        listingIds: [],
      };
    const budget = spendIn(clean);
    const within = budget === undefined ? "" : `, within ${money(budget)}`;
    // Things named ("add a reading lamp") are added and nothing else (#153); anything
    // else is a look for the whole apartment.
    const request = furnishRequest(clean);
    if (request.type === "items") {
      const want = cleanVibe(request.want);
      return {
        text: `Looking on Marketplace for ${kindList(request.kinds)}${within}. What fits goes into ${REVIEW_LINE}`,
        command: {
          kind: "add_items",
          items: request.kinds,
          ...(want ? { want } : {}),
          ...(budget === undefined ? {} : { budget }),
        },
        listingIds: [],
      };
    }
    const vibe = cleanVibe(request.vibe) ?? cleanVibe(clean);
    if (!vibe) return none(VIBE_HELP);
    return {
      text: `Picking Marketplace items for that vibe${within}. They go into ${REVIEW_LINE}`,
      command: { kind: "furnish", vibe, ...(budget === undefined ? {} : { budget }) },
      listingIds: [],
    };
  }
  if (
    has(/ (3d|model|my apartment|our apartment|show my place|show me my place|see my place) /, t)
  ) {
    if (data.apartment === null)
      return showRentals(
        undefined,
        "You haven't chosen a place yet. Choose a rental to see it in 3D. ",
      );
    return {
      text:
        data.apartment?.hasModel === false
          ? "Here's your apartment. Its 3D model is still being built."
          : "Here's your apartment in 3D.",
      command: { kind: "show_apartment" },
      listingIds: [],
    };
  }

  if (has(/ (weekend|route|saturday|sunday|day out|itinerary) /, t)) {
    const slug = hoods[0] ?? here ?? home;
    if (!slug)
      return none(
        'Which neighborhood? Try "weekend route in the Mission" or "weekend in Noe Valley".',
      );
    return {
      text: `Here's a weekend route in ${name(slug)}, built from what locals recommend.`,
      command: { kind: "weekend_route", slug },
      listingIds: [],
    };
  }

  if (
    !statesPlan(plan) &&
    has(/ (show me the move|show the move|my move|the move|where am i moving|moving to sf) /, t)
  )
    return {
      text: "Here's San Francisco. Ask about neighborhoods, rooms, events or your crew.",
      command: { kind: "show_move" },
      listingIds: [],
    };

  if (has(RENTAL_WORDS, t)) {
    // "In my budget" means the City Profile's budget when no price is given.
    const maxPrice =
      priceIn(clean) ??
      plan.budgetMax ??
      (/\bbudget\b/.test(t) && data.budgetMax ? data.budgetMax : undefined);
    if (maxPrice === undefined && hoods[0])
      return {
        text: `Showing rentals in ${name(hoods[0])}.`,
        command: { kind: "show_pins", layer: "homes", slug: hoods[0] },
        listingIds: [],
      };
    const cheapest = (data.rentals ?? [])
      .filter((r) => maxPrice === undefined || r.price <= maxPrice)
      .sort((a, b) => a.price - b.price)[0];
    if (cheapest && has(/ (cheapest|least expensive|lowest) /, t))
      return {
        text: `The cheapest match is ${withPrice(cheapest)} a month.`,
        command: { kind: "open_listing", listingId: cheapest.id },
        listingIds: [cheapest.id],
      };
    return showRentals(maxPrice);
  }

  const pinSlug = hoods[0] ?? (ctx.stage === "hood" || ctx.stage === "house" ? here : undefined);
  const inHood = pinSlug ? ` in ${name(pinSlug)}` : " around the city";
  const pins = (layer: "events" | "groups" | "items", text: string): Routed => ({
    text,
    command: { kind: "show_pins", layer, ...(pinSlug ? { slug: pinSlug } : {}) },
    listingIds: [],
  });
  if (has(/ (events?|things to do|happening|meetups?|concerts?|shows) /, t))
    return pins("events", `Showing upcoming events${inHood}.`);
  if (has(/ (groups?|communit(y|ies)|clubs?) /, t))
    return pins("groups", `Showing local Groups${inHood}.`);
  if (has(/ (marketplace|for sale|used|secondhand|second hand) /, t))
    return pins("items", `Showing Marketplace items${inHood}.`);

  if (has(/ (my crew|crew|move in crew|people moving|meet people|new friends) /, t))
    return {
      text: "Here's your Move-in Crew: people arriving around the same time who opted in.",
      command: { kind: "show_crew" },
      listingIds: [],
    };
  if (has(/ (roommates?|roomies?|housemates?|flatmates?) /, t)) return page("roommates");
  // "A house in Noe Valley" is about the neighborhood, not their household.
  if (
    has(/ (chores|bills|groceries|household|my house|our house) /, t) ||
    (has(/ house /, t) && hoods.length === 0)
  )
    return page("house");
  if (has(/ (my place|furniture|fit|my room) /, t)) return page("place");
  if (has(/ (check ins?|checkins?|journeys?|90 day) /, t)) return page("journeys");
  if (
    has(/ (neighborhoods list|list of neighborhoods|all neighborhoods|all the neighborhoods) /, t)
  )
    return page("neighborhoods");

  // A move plan and nothing else: rentals that match it.
  if (statesPlan(plan)) return showRentals(plan.budgetMax ?? undefined);

  if (has(/ (find a place|apartment hunt|search|find) /, t)) return page("find");

  if (hoods[0]) {
    // "Tell me about X" stays on the map (flies there); asking for its page or scores opens the page.
    if (has(/ (page|details|scores?|stats|safe|commute) /, t))
      return {
        text: `Opening the ${name(hoods[0])} page, with its scores and sources.`,
        command: { kind: "open_neighborhood_page", slug: hoods[0] },
        listingIds: [],
      };
    return {
      text: `Flying to ${name(hoods[0])}. Ask for rentals, events or a weekend route here.`,
      command: { kind: "fly_neighborhood", slug: hoods[0] },
      listingIds: [],
    };
  }

  return none();
}

/**
 * The keyword rules: a useful answer with AI off, or when the model's answer
 * is rejected. In the browser nothing is saved to the City Profile, and the
 * reply carries rental cards only when `data.cards` gives the ranked ones.
 */
export function ruleReply(
  message: string,
  ctx: ChatContext,
  data: Parameters<typeof ruleRoute>[2] & { cards?: readonly ChatRentalCard[] },
): ChatReply {
  const r = ruleRoute(message, ctx, data);
  const rentals = data.rentals ?? [];
  const named = r.listingIds.flatMap((id) => {
    const x = rentals.find((y) => y.id === id);
    return x && r.command.kind !== "open_listing" ? [rentalSource(x)] : [];
  });
  return {
    text: r.text,
    command: r.command,
    sources: [...commandSources(r.command, data), ...named],
    via: "rules",
    rentals: replyCards(r.command, r.listingIds, data.cards ?? []),
    saved: [],
  };
}

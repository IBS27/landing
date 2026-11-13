import { hasProtected, redactProtected } from "../../../convex/lib/protectedText";

/**
 * Landing Home's chat dock: the person types, and the reply carries one map
 * command the client runs (fly to a neighborhood, show rentals, open a page).
 * These rules answer in the browser from the viewer's own data (no server
 * function yet). A Muse-backed answer can replace `ruleReply` later and reuse
 * the same types and command check, so the UI won't change.
 */

export type ChatStage = "globe" | "city" | "hood" | "house";
export type ChatContext = { stage: ChatStage; neighborhood?: string /* slug */ };
export type ChatPage = "find" | "place" | "crew" | "journeys" | "moveout" | "profile" | "inbox";
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
  | { kind: "none" };
export type ChatSource = { label: string; href?: string };
export type ChatReply = {
  text: string;
  command: ChatCommand;
  sources: ChatSource[];
  via: "muse" | "rules";
};
export type ChatNeighborhood = { slug: string; name: string; aliases?: string[] };
/** A ranked rental the rules may name (optional `data.rentals`). Price is monthly, whole dollars. */
export type ChatRental = { id: string; title: string; price: number; slug?: string };

export const CHAT_PAGES = [
  "find",
  "place",
  "crew",
  "journeys",
  "moveout",
  "profile",
  "inbox",
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
};

/** The Landing route for a chat page. */
export function pageHref(page: ChatPage): string {
  return PAGE_INFO[page].href;
}

/** Everyday names people use that aren't the DataSF name or its short name. */
export const CHAT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "south-of-market": ["soma"],
  "potrero-hill": ["dogpatch"],
  "western-addition": ["nopa", "fillmore"],
  "haight-ashbury": ["the haight", "upper haight"],
  "sunset-parkside": ["the sunset", "outer sunset", "parkside"],
  "financial-district-south-beach": ["fidi", "financial district", "south beach"],
  "castro-upper-market": ["castro", "the castro", "upper market"],
  "lone-mountain-usf": ["lone mountain", "usf"],
  "oceanview-merced-ingleside": ["omi", "ingleside"],
  "pacific-heights": ["pac heights"],
  "visitacion-valley": ["vis valley"],
  "bayview-hunters-point": ["bayview", "hunters point"],
};

/** Lowercase words separated by single spaces, so phrases match on word boundaries. */
function words(s: string): string {
  return ` ${s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Every name a neighborhood answers to, normalized. */
function namesOf(n: ChatNeighborhood): string[] {
  const raw = [
    n.name,
    n.slug.replace(/-/g, " "),
    ...n.name.split("/"),
    ...(n.aliases ?? []),
    ...(CHAT_ALIASES[n.slug] ?? []),
  ];
  return [...new Set(raw.map((r) => words(r).trim()).filter((r) => r.length >= 3))];
}

/**
 * The neighborhoods a message names, in the order it names them. Longer names
 * win ("Mission Bay" is not the Mission), and each word counts once.
 */
export function findNeighborhoods(message: string, neighborhoods: ChatNeighborhood[]): string[] {
  const names = neighborhoods
    .flatMap((n) => namesOf(n).map((name) => ({ slug: n.slug, name })))
    .sort((a, b) => b.name.length - a.name.length);
  let text = words(message);
  const found: { slug: string; at: number }[] = [];
  for (const { slug, name } of names) {
    const needle = ` ${name} `;
    let at = text.indexOf(needle);
    while (at >= 0) {
      if (!found.some((f) => f.slug === slug)) found.push({ slug, at });
      // Blank the match so a shorter name can't reuse its words.
      text = text.slice(0, at + 1) + "#".repeat(name.length) + text.slice(at + 1 + name.length);
      at = text.indexOf(needle);
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.slug);
}

/** "under $2,400", "below 2.5k", "max $1800", "$2k". Whole dollars, or undefined. */
export function priceIn(message: string): number | undefined {
  const m =
    /(?:under|below|less than|max(?:imum)?|up to|at most|<|cheaper than|within)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(
      message,
    ) ?? /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i.exec(message);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // "under 2.5" with no k reads as thousands; rent is never under $100.
  const dollars = n < 100 ? n * 1000 : n;
  return Math.round(dollars);
}

function nameOf(slug: string, neighborhoods: ChatNeighborhood[]): string {
  const n = neighborhoods.find((x) => x.slug === slug);
  return n ? (n.aliases?.[0] ?? n.name) : slug;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** Whether a command only names neighborhoods and listings that exist. */
export function validCommand(
  cmd: ChatCommand,
  data: { neighborhoods: ChatNeighborhood[]; listingIds?: string[] },
): boolean {
  const slugs = new Set(data.neighborhoods.map((n) => n.slug));
  switch (cmd.kind) {
    case "show_move":
    case "show_crew":
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
    default:
      return false;
  }
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
        {
          label: r ? `${r.title} · ${money(r.price)}/mo` : "Rental",
          href: `/landing/find/listing/${cmd.listingId}`,
        },
      ];
    }
    case "show_crew":
      return [PAGE_INFO.crew];
    case "open_page":
      return [PAGE_INFO[cmd.page]];
    default:
      return [];
  }
}

export const CHAT_HELP =
  'I can fly to a neighborhood, compare two, show rentals under a price, events or Groups nearby, a weekend route, or your Move-in Crew. Try "rooms under $2,000" or "Mission vs Noe Valley".';

const PROTECTED_LINE =
  "Landing never picks places by who lives there or who you are. Ask about rent, commute, events or Groups instead.";

const PAGE_LINES: Record<ChatPage, string> = {
  find: "Opening Find, with rentals ranked for your City Profile.",
  place: "Opening your place: roommates, the house and what fits.",
  crew: "Opening your Move-in Crew.",
  journeys: "Opening Journeys, your check-ins for the first 90 days.",
  moveout: "Opening Move out, where you can sublet your room and sell what you're not taking.",
  profile: "Opening your City Profile: everything Landing knows about you, which you can edit.",
  inbox:
    "Opening Inbox, where Muse's drafts wait for your OK. Nothing is sent until you approve it.",
};

const has = (re: RegExp, s: string) => re.test(s);

/**
 * The rules' answer, plus the listings it names (so the server can cite them).
 * `ruleReply` is the public form.
 */
/** "Title at $X", unless the title already carries its price. */
function withPrice(r: ChatRental): string {
  const price = money(r.price);
  return r.title.includes(price) ? r.title : `${r.title} at ${price}`;
}

export function ruleRoute(
  message: string,
  ctx: ChatContext,
  data: {
    neighborhoods: ChatNeighborhood[];
    homeSlugs?: string[];
    rentals?: ChatRental[];
    /** The City Profile's budget top, for "in my budget". */
    budgetMax?: number | null;
  },
): { text: string; command: ChatCommand; listingIds: string[] } {
  const none = (text = CHAT_HELP) => ({ text, command: { kind: "none" } as const, listingIds: [] });
  // Route on the words with protected traits removed, so they can't steer anything.
  const clean = redactProtected(message);
  const t = words(clean);
  if (!t.trim()) return none();
  const hoods = findNeighborhoods(clean, data.neighborhoods);
  const valid = new Set(data.neighborhoods.map((n) => n.slug));
  const here = ctx.neighborhood && valid.has(ctx.neighborhood) ? ctx.neighborhood : undefined;
  const home = data.homeSlugs?.find((s) => valid.has(s));
  const name = (slug: string) => nameOf(slug, data.neighborhoods);
  const page = (p: ChatPage) => ({
    text: PAGE_LINES[p],
    command: { kind: "open_page", page: p } as const,
    listingIds: [],
  });

  // Compare: two neighborhoods with "vs", "or", "compare"; or one plus where the map is.
  const rentalWords =
    / (rooms?|rentals?|rent|apartments?|apts?|studios?|1br|2br|places to live|listings?|housing|homes?|sublets?) /;
  const comparing =
    has(/ (compare|vs|versus|difference) /, t) || (has(/ (or|better) /, t) && !has(rentalWords, t));
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
  if (has(/ (my profile|city profile|know about me|about me|my brief) /, t)) return page("profile");
  if (
    has(
      / (sell|selling|sublet my|sublet our|sublease my|sublet the room|move out|moveout|moving out|leaving) /,
      t,
    )
  )
    return page("moveout");

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

  if (has(/ (show me the move|show the move|my move|the move|where am i moving|moving to sf) /, t))
    return {
      text: "Here's San Francisco. Ask about neighborhoods, rooms, events or your crew.",
      command: { kind: "show_move" },
      listingIds: [],
    };

  if (has(rentalWords, t)) {
    // "In my budget" means the City Profile's budget when no price is given.
    const maxPrice =
      priceIn(clean) ?? (/\bbudget\b/.test(t) && data.budgetMax ? data.budgetMax : undefined);
    if (maxPrice === undefined && hoods[0])
      return {
        text: `Showing rentals in ${name(hoods[0])}.`,
        command: { kind: "show_pins", layer: "homes", slug: hoods[0] },
        listingIds: [],
      };
    const rentals = (data.rentals ?? []).filter(
      (r) => maxPrice === undefined || r.price <= maxPrice,
    );
    const cheapest = [...rentals].sort((a, b) => a.price - b.price)[0];
    if (cheapest && has(/ (cheapest|least expensive|lowest) /, t))
      return {
        text: `The cheapest match is ${withPrice(cheapest)} a month.`,
        command: { kind: "open_listing", listingId: cheapest.id },
        listingIds: [cheapest.id],
      };
    const under = maxPrice === undefined ? "" : ` under ${money(maxPrice)}`;
    if (data.rentals && !cheapest)
      return {
        text: `No rentals in your ranked list are${under || " open"} right now. Try a higher limit.`,
        command: { kind: "show_rentals", ...(maxPrice === undefined ? {} : { maxPrice }) },
        listingIds: [],
      };
    return {
      text: cheapest
        ? `${rentals.length} rental${rentals.length === 1 ? "" : "s"}${under}, ranked for you. The cheapest is ${withPrice(cheapest)}.`
        : `Showing rentals${under}, ranked for your City Profile.`,
      command: { kind: "show_rentals", ...(maxPrice === undefined ? {} : { maxPrice }) },
      listingIds: cheapest ? [cheapest.id] : [],
    };
  }

  const pinSlug = hoods[0] ?? (ctx.stage === "hood" || ctx.stage === "house" ? here : undefined);
  const inHood = pinSlug ? ` in ${name(pinSlug)}` : " around the city";
  const pins = (layer: "events" | "groups" | "items", text: string) => ({
    text,
    command: { kind: "show_pins", layer, ...(pinSlug ? { slug: pinSlug } : {}) } as const,
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
  if (has(/ (roommates?|my place|furniture|fit|my room|chores|bills|groceries) /, t))
    return page("place");
  if (has(/ (check ins?|checkins?|journeys?|90 day) /, t)) return page("journeys");
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

  return none(hasProtected(message) ? PROTECTED_LINE : CHAT_HELP);
}

/** The keyword rules: a useful answer with AI off, or when the model's answer is rejected. */
export function ruleReply(
  message: string,
  ctx: ChatContext,
  data: {
    neighborhoods: ChatNeighborhood[];
    homeSlugs?: string[];
    rentals?: ChatRental[];
    budgetMax?: number | null;
  },
): ChatReply {
  const r = ruleRoute(message, ctx, data);
  const rentals = data.rentals ?? [];
  const named = r.listingIds.flatMap((id) => {
    const x = rentals.find((y) => y.id === id);
    return x && r.command.kind !== "open_listing"
      ? [{ label: `${x.title} · ${money(x.price)}/mo`, href: `/landing/find/listing/${x.id}` }]
      : [];
  });
  return {
    text: r.text,
    command: r.command,
    sources: [...commandSources(r.command, data), ...named],
    via: "rules",
  };
}

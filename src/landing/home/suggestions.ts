import type { ChatCommand } from "../../../convex/lib/homeChatRules";
import type { Chip } from "./ChatDock";
import type { HomeView } from "./HomeChrome";

/**
 * The suggestion chips under Landing Home's chat. They follow the tab that's
 * showing, where the person is in their move (no place yet, a place, a 3D
 * model, furniture in it) and the last answer. A chip with no `run` is sent
 * as a message, so each is worded for Landing's keyword rules too (AI off).
 */
export function suggestions(s: {
  view: HomeView;
  /** The person's apartment; undefined while it loads. */
  apartment: { place: boolean; model: boolean; items: number } | undefined;
  /** The last reply's command. */
  last: ChatCommand | undefined;
  /** They haven't done the City Profile brief. */
  needsBrief: boolean;
  /** A neighborhood's name, by slug. */
  name: (slug: string) => string;
  /** What chips do themselves. `nearPlace` needs the place's approximate point. */
  go: {
    apartment: () => void;
    nearPlace: (() => void) | undefined;
    neighborhood: (slug: string) => void;
    compare: (a: string, b: string) => void;
    find: () => void;
    brief: () => void;
  };
}): Chip[] {
  const { last, go } = s;
  const nearPlace: Chip = { label: "Show me events near my place", run: go.nearPlace };

  if (s.view === "apartment") {
    if (!s.apartment) return [];
    if (!s.apartment.place) return [{ label: "Rooms in my budget" }, { label: "Show me the move" }];
    if (!s.apartment.model) return [nearPlace, { label: "Who's in my crew?" }];
    if (s.apartment.items === 0)
      return [
        { label: "Make it cozy and warm under $1,500" },
        { label: "A minimal, bright style under $1,000" },
        { label: "Add a desk and a lamp" },
      ];
    return [{ label: "Add a reading lamp" }, { label: "Add a rug under $200" }, nearPlace];
  }

  const openApartment: Chip[] = s.apartment?.place
    ? [{ label: "Open my apartment", run: go.apartment }]
    : [];
  switch (last?.kind) {
    case "weekend_route":
      return [
        { label: `Events in ${s.name(last.slug)}` },
        { label: `Groups in ${s.name(last.slug)}` },
        { label: `Open ${s.name(last.slug)}`, run: () => go.neighborhood(last.slug) },
      ];
    case "fly_neighborhood":
      return [
        { label: `Weekend route in ${s.name(last.slug)}` },
        { label: `Events in ${s.name(last.slug)}` },
        { label: `Open ${s.name(last.slug)}`, run: () => go.neighborhood(last.slug) },
      ];
    case "compare":
      return [{ label: "Open the full comparison", run: () => go.compare(last.a, last.b) }];
    case "show_rentals":
      return [
        { label: "Open Find", run: go.find },
        { label: "Who's in my crew?" },
        ...openApartment,
      ];
    case "show_move":
      return [{ label: "Rooms in my budget" }, { label: "Events this week" }, ...openApartment];
    default:
      if (s.needsBrief)
        return [{ label: "Set up my City Profile", run: go.brief }, { label: "Show me the move" }];
      return [
        { label: "Show me the move" },
        { label: "Rooms in my budget" },
        ...(openApartment.length ? openApartment : [{ label: "What's waiting for approval?" }]),
      ];
  }
}

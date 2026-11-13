import { compass, hoursMinutes, keyDays, sfTime, sunDay } from "./sun";

/**
 * What a unit's view is like through the year (#13): computed sun times and
 * directions for its exact location, plus San Francisco seasonal patterns
 * (summer fog on the west side, clear Septembers) worded as tendencies, not
 * promises.
 */

export type ViewKind = "sunrise" | "sunset" | "ocean";

export type SeasonRow = {
  id: string;
  label: string;
  /** "5:48 AM" */
  time: string;
  /** "east-northeast" */
  direction: string;
  /** "5:48–6:48 AM" */
  goldenHour: string;
  daylight: string;
};

export type ViewStory = {
  kind: ViewKind;
  title: string;
  lead: string;
  rows: SeasonRow[];
  seasons: { label: string; text: string }[];
  facts: string[];
};

/** West-side neighborhoods where summer fog is most common (the "fog belt"). */
const FOG_BELT =
  /sunset|richmond|parkside|lake|seacliff|ocean|golden gate|presidio|lone mountain|merced/i;
/** East-side neighborhoods sheltered by Twin Peaks, usually sunnier in summer. */
const SUN_BELT =
  /mission|bernal|potrero|dogpatch|soma|bayview|excelsior|portola|noe|castro|glen park/i;

const range = (a: number | null, b: number | null) => {
  const s = sfTime(a);
  const e = sfTime(b);
  const [sv, sp] = s.split(" ");
  const [ev, ep] = e.split(" ");
  return sp === ep ? `${sv}–${ev} ${ep}` : `${s}–${e}`;
};

function rows(kind: ViewKind, lat: number, lng: number, now: Date): SeasonRow[] {
  const HOUR = 3_600_000;
  return keyDays(now).map((d) => {
    const s = sunDay(lat, lng, d.date);
    const rise = kind === "sunrise";
    const at = rise ? s.sunrise : s.sunset;
    return {
      id: d.id,
      label: d.label,
      time: sfTime(at),
      direction: compass(rise ? s.sunriseAzimuth : s.sunsetAzimuth),
      goldenHour: at === null ? "n/a" : rise ? range(at, at + HOUR) : range(at - HOUR, at),
      daylight: hoursMinutes(s.daylightMin),
    };
  });
}

function swing(kind: "sunrise" | "sunset", lat: number, lng: number, now: Date) {
  const [, summer, , winter] = keyDays(now);
  const a = sunDay(lat, lng, summer.date);
  const b = sunDay(lat, lng, winter.date);
  return Math.round(
    Math.abs(
      kind === "sunrise" ? b.sunriseAzimuth - a.sunriseAzimuth : a.sunsetAzimuth - b.sunsetAzimuth,
    ),
  );
}

export function viewStory(
  kind: ViewKind,
  at: { lat: number; lng: number; neighborhood: string | null },
  now = new Date(),
): ViewStory {
  const hood = at.neighborhood ?? "";
  const fog = FOG_BELT.test(hood);
  const sunny = SUN_BELT.test(hood);

  if (kind === "sunrise") {
    const r = rows("sunrise", at.lat, at.lng, now);
    return {
      kind,
      title: "Sunrise view",
      lead: `East-facing windows catch the sun coming up over the East Bay hills. Today it rises at ${r[0].time}, ${r[0].direction}.`,
      rows: r,
      seasons: [
        {
          label: "Summer",
          text: `The earliest sunrises of the year, before 6 AM, far to the ${r[1].direction}. ${sunny ? `${hood} sits on the sunnier east side, sheltered by Twin Peaks, so mornings are often clear` : "Some mornings start under the marine layer, so the first light comes through soft and silver until it burns off"}.`,
        },
        {
          label: "Fall",
          text: `The sun rises almost ${r[2].direction} around ${r[2].time}. September and October are usually San Francisco's warmest, clearest weeks, the best time for crisp, sharp sunrises.`,
        },
        {
          label: "Winter",
          text: `Sunrise slides to the ${r[3].direction} and comes after ${r[3].time.replace(/:\d\d/, "")}. Storm fronts bring the most dramatic pink and orange skies of the year.`,
        },
      ],
      facts: [
        `The sunrise point travels about ${swing("sunrise", at.lat, at.lng, now)}° along the horizon between June and December, so the window that catches it changes with the seasons.`,
        "East-facing rooms get direct sun first thing and cool off by the afternoon, a plus in SF's warmer fall.",
        `Daylight ranges from ${r[3].daylight} at the winter solstice to ${r[1].daylight} at midsummer.`,
      ],
    };
  }

  if (kind === "sunset") {
    const r = rows("sunset", at.lat, at.lng, now);
    return {
      kind,
      title: "Sunset view",
      lead: `West-facing windows look toward the sunset. Today the sun goes down at ${r[0].time}, ${r[0].direction}.`,
      rows: r,
      seasons: [
        {
          label: "Summer",
          text: `The latest sunsets of the year, around ${r[1].time}, far to the ${r[1].direction}. ${fog ? "On this side of the city the fog bank often rolls in near sunset, so you may watch the sun sink into the fog" : "Evenings on the east side are often clear while the fog piles up over the western hills, which can turn the sky gold behind it"}.`,
        },
        {
          label: "Fall",
          text: `Sunset swings to almost ${r[2].direction} around ${r[2].time}. The clear, warm weeks of September and October usually bring the cleanest sunsets.`,
        },
        {
          label: "Winter",
          text: `The sun sets before 5 PM to the ${r[3].direction}. The low winter sun sends long, warm light deep into west-facing rooms through the afternoon.`,
        },
      ],
      facts: [
        `The sunset point moves about ${swing("sunset", at.lat, at.lng, now)}° along the horizon between June and December.`,
        "When daylight saving time ends in early November, sunsets jump an hour earlier overnight.",
        "West-facing rooms soak up afternoon heat, which is welcome most of the year in SF's cool climate.",
      ],
    };
  }

  const r = rows("sunset", at.lat, at.lng, now);
  return {
    kind,
    title: "Ocean view",
    lead: `A view west toward the Pacific. Today the sun sets over the water at ${r[0].time}, ${r[0].direction}.`,
    rows: r,
    seasons: [
      {
        label: "Summer",
        text: "June through August is fog season on the coast. Many mornings and evenings the ocean is hidden under a white marine layer, with clearer views around midday.",
      },
      {
        label: "Fall",
        text: "September and October are usually the clearest, warmest weeks by the ocean, the best season for full sunsets over the water.",
      },
      {
        label: "Winter",
        text: "Between storms the air is often crystal clear. Winter is also gray whale migration season along the coast.",
      },
    ],
    facts: [
      "On very clear days the Farallon Islands, about 27 miles offshore, can be seen on the horizon.",
      "A clean ocean horizon is where you have the best chance of catching a rare green flash at sunset.",
      `In summer the sun sets well to the ${r[1].direction}, around ${r[1].time}; in winter it drops to the ${r[3].direction} before 5 PM.`,
    ],
  };
}

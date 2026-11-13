/**
 * Sunrise, sunset and where the sun sits on the horizon, for a point and a day
 * (#13's view details). NOAA's solar position equations (the "General Solar
 * Position Calculations" spreadsheet), accurate to about a minute for the Bay
 * Area. Pure and client-side; times are shown in San Francisco time.
 */

const rad = Math.PI / 180;
const deg = 180 / Math.PI;

export type SunDay = {
  /** Epoch ms, or null when the sun doesn't rise or set (never at Bay Area latitudes). */
  sunrise: number | null;
  sunset: number | null;
  /** Compass bearing of the sun at sunrise and sunset, degrees from north. */
  sunriseAzimuth: number;
  sunsetAzimuth: number;
  /** Daylight length in minutes. */
  daylightMin: number;
};

/** Sun times for the calendar day containing `date` (UTC noon of that day is used). */
export function sunDay(lat: number, lng: number, date: Date): SunDay {
  const noonUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  const jd = noonUtc / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(m * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * rad) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const obliq0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(obliq * rad) * Math.sin(appLong * rad)) * deg;

  const y = Math.tan((obliq / 2) * rad) ** 2;
  const eqTime =
    4 *
    deg *
    (y * Math.sin(2 * l0 * rad) -
      2 * e * Math.sin(m * rad) +
      4 * e * y * Math.sin(m * rad) * Math.cos(2 * l0 * rad) -
      0.5 * y * y * Math.sin(4 * l0 * rad) -
      1.25 * e * e * Math.sin(2 * m * rad));

  // Hour angle for the sun's center 0.833° below the horizon (refraction + disc).
  const cosHa =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl * rad)) -
    Math.tan(lat * rad) * Math.tan(decl * rad);
  const solarNoonMin = 720 - 4 * lng - eqTime; // minutes after 00:00 UTC
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  // Azimuth of sunrise/sunset on the horizon: cos(A) = sin(decl) / cos(lat).
  const az = Math.acos(Math.sin(decl * rad) / Math.cos(lat * rad)) * deg;

  if (cosHa > 1 || cosHa < -1)
    return {
      sunrise: null,
      sunset: null,
      sunriseAzimuth: az,
      sunsetAzimuth: 360 - az,
      daylightMin: cosHa > 1 ? 0 : 1440,
    };
  const ha = Math.acos(cosHa) * deg;
  return {
    sunrise: dayStart + (solarNoonMin - 4 * ha) * 60_000,
    sunset: dayStart + (solarNoonMin + 4 * ha) * 60_000,
    sunriseAzimuth: az,
    sunsetAzimuth: 360 - az,
    daylightMin: 8 * ha,
  };
}

const POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];
const NAMES: Record<string, string> = {
  NE: "northeast",
  ENE: "east-northeast",
  E: "due east",
  ESE: "east-southeast",
  SE: "southeast",
  SW: "southwest",
  WSW: "west-southwest",
  W: "due west",
  WNW: "west-northwest",
  NW: "northwest",
};

/** "east-northeast" for 62°. */
export function compass(azimuth: number): string {
  const p = POINTS[Math.round(azimuth / 22.5) % 16];
  return NAMES[p] ?? p;
}

/** "5:48 AM" in San Francisco time. */
export function sfTime(ms: number | null): string {
  if (ms === null) return "n/a";
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "14h 46m" */
export function hoursMinutes(min: number): string {
  const h = Math.floor(min / 60);
  return `${h}h ${Math.round(min - h * 60)}m`;
}

/** The key days of the year for this year: today, both solstices and the fall equinox. */
export function keyDays(now = new Date()) {
  const y = now.getFullYear();
  return [
    { id: "today", label: "Today", date: now },
    { id: "summer", label: "Summer solstice (Jun 21)", date: new Date(Date.UTC(y, 5, 21, 12)) },
    { id: "fall", label: "Fall equinox (Sep 22)", date: new Date(Date.UTC(y, 8, 22, 12)) },
    { id: "winter", label: "Winter solstice (Dec 21)", date: new Date(Date.UTC(y, 11, 21, 12)) },
  ] as const;
}

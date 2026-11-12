import { Info } from "lucide-react";
import type { CSSProperties } from "react";

/** Small deterministic PRNG so each venue gets a stable map. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const POI_NAMES = [
  ["Harbor Steps Café", "cafe"],
  ["Commons Park", "park"],
  ["Union Market", "shop"],
  ["Lantern Noodle House", "food"],
  ["Northgate Books", "shop"],
  ["Tidewater Taproom", "food"],
  ["Pine Hollow Playfield", "park"],
  ["Morning Ritual Coffee", "cafe"],
] as const;

const WATER_NAMES = ["Salmon Bay", "Lake Union", "Elliott Bay", "Portage Bay"];

const POI_COLOR = { cafe: "#a0703c", park: "#3f9b52", shop: "#4a7fd6", food: "#e3742f" } as const;

/** Map palette, swapped for dark mode through CSS variables. */
const PALETTE =
  "[--m-land:#f3f0ea] [--m-block:#ebe7df] [--m-bldg:#e1dcd2] [--m-road:#ffffff] [--m-case:#dcd6cb] [--m-art:#fde8a8] [--m-art-case:#ecc96a] [--m-hwy:#f8c77a] [--m-hwy-case:#e0a64a] [--m-water:#aad3f2] [--m-shore:#93c4ea] [--m-park:#cfe7c4] [--m-park-dark:#b9dbad] [--m-label:#5f6368] [--m-halo:#ffffff] [--m-hood:#8b8680] [--m-water-label:#4a86b8] dark:[--m-land:#262a30] dark:[--m-block:#2b3037] dark:[--m-bldg:#343a42] dark:[--m-road:#434a54] dark:[--m-case:#2b3037] dark:[--m-art:#6a5b35] dark:[--m-art-case:#4f4428] dark:[--m-hwy:#7a5a2c] dark:[--m-hwy-case:#5a4220] dark:[--m-water:#1c3550] dark:[--m-shore:#24425f] dark:[--m-park:#283f31] dark:[--m-park-dark:#2f4a39] dark:[--m-label:#b0b3b8] dark:[--m-halo:#262a30] dark:[--m-hood:#8f949b] dark:[--m-water-label:#7fb0db]";

const halo: CSSProperties = {
  paintOrder: "stroke",
  stroke: "var(--m-halo)",
  strokeWidth: 3,
  strokeLinejoin: "round",
};

/**
 * A static street-map tile (stand-in for Facebook's map): an irregular street
 * grid with city blocks and building footprints, an arterial and a highway,
 * a park, a shoreline, street/neighborhood labels, POIs and the venue pin.
 */
export function StaticMap({
  seed,
  address,
  height = 324,
}: {
  seed: string;
  address: string | null;
  height?: number;
}) {
  const r = rng(seed);
  const W = 432;
  const H = height;
  const R = Math.ceil(Math.hypot(W, H) / 2) + 40;
  const angle = -8 - Math.round(r() * 22);

  // Irregular street positions, always including 0 (the venue's corner).
  const axis = () => {
    const out = [0];
    let p = 0;
    while (p < R) {
      p += 38 + Math.round(r() * 26);
      out.push(p);
    }
    p = 0;
    while (p > -R) {
      p -= 38 + Math.round(r() * 26);
      out.unshift(p);
    }
    return out;
  };
  const xs = axis();
  const ys = axis();

  const parts = (address ?? "")
    .split(/&|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  const isStreet = (s: string) => /\b(St|Ave|Way|Blvd|Rd|Pl|Dr|Ln|Pkwy|Hwy)\b\.?/i.test(s);
  const streets = parts.filter(isStreet).slice(0, 2);
  const hood =
    parts.find(
      (s) => !isStreet(s) && !/^\d/.test(s) && !/^(Seattle|WA|USA|United States)$/i.test(s),
    ) ?? "Downtown";

  // Blocks with 1-4 building footprints each.
  const buildings: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 6;
      const x1 = xs[i + 1] - 6;
      const y0 = ys[j] + 6;
      const y1 = ys[j + 1] - 6;
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const w = (x1 - x0) * (0.25 + r() * 0.35);
        const h = (y1 - y0) * (0.25 + r() * 0.35);
        buildings.push({
          x: x0 + r() * (x1 - x0 - w),
          y: y0 + r() * (y1 - y0 - h),
          w,
          h,
        });
      }
    }
  }

  // One avenue (vertical) and the venue's street (horizontal) are arterials.
  const artX = xs[Math.max(1, Math.min(xs.length - 2, Math.floor(xs.length / 2) + 2))];
  const parkI = Math.floor(xs.length / 2) - 3 + Math.floor(r() * 2);
  const parkJ = Math.floor(ys.length / 2) - 2 - Math.floor(r() * 2);
  const park = {
    x: xs[parkI] + 4,
    y: ys[parkJ] + 4,
    w: xs[parkI + 2] - xs[parkI] - 8,
    h: ys[parkJ + 1] - ys[parkJ] - 8,
  };

  // Shoreline along one side, with a little wobble.
  const waterSide = r() > 0.5 ? "left" : "bottom";
  const wob = () => (r() - 0.5) * 18;
  const water =
    waterSide === "left"
      ? `M-10 -10 L${W * 0.16 + wob()} -10 C ${W * 0.2 + wob()} ${H * 0.25}, ${W * 0.08 + wob()} ${H * 0.45}, ${W * 0.14 + wob()} ${H * 0.65} S ${W * 0.3} ${H * 0.95}, ${W * 0.26} ${H + 10} L-10 ${H + 10} Z`
      : `M-10 ${H * 0.8 + wob()} C ${W * 0.22} ${H * 0.72 + wob()}, ${W * 0.4} ${H * 0.9 + wob()}, ${W * 0.62} ${H * 0.82 + wob()} S ${W * 0.92} ${H * 0.86}, ${W + 10} ${H * 0.78} L${W + 10} ${H + 10} L-10 ${H + 10} Z`;
  const waterLabel =
    waterSide === "left"
      ? { x: W * 0.06, y: H * 0.5, rot: -70 }
      : { x: W * 0.38, y: H * 0.95, rot: 0 };

  // Highway sweeping across the far corner.
  const hwy =
    waterSide === "left"
      ? `M${W * 0.72} -20 C ${W * 0.8} ${H * 0.3}, ${W * 0.95} ${H * 0.55}, ${W + 20} ${H * 0.62}`
      : `M${W * 0.62} -20 C ${W * 0.7} ${H * 0.25}, ${W * 0.88} ${H * 0.4}, ${W + 20} ${H * 0.42}`;

  const first = Math.floor(r() * POI_NAMES.length);
  const spots = [
    { x: W * 0.68, y: H * 0.2 },
    { x: W * 0.26, y: H * 0.26 },
    { x: W * 0.64, y: H * 0.7 },
  ];
  const pois = spots.map((spot, k) => {
    const [name, kind] = POI_NAMES[(first + k * 3) % POI_NAMES.length];
    return { name, kind, ...spot };
  });

  const line = (horizontal: boolean, p: number, width: number, color: string, key: string) =>
    horizontal ? (
      <line key={key} x1={-R} y1={p} x2={R} y2={p} stroke={color} strokeWidth={width} />
    ) : (
      <line key={key} x1={p} y1={-R} x2={p} y2={R} stroke={color} strokeWidth={width} />
    );

  return (
    <div className={`relative overflow-hidden ${PALETTE}`} style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={address ? `Map of ${address}` : "Map"}
        className="block"
      >
        <rect width={W} height={H} fill="var(--m-land)" />
        <g transform={`translate(${W / 2} ${H / 2}) rotate(${angle})`}>
          {/* blocks */}
          {xs
            .slice(0, -1)
            .flatMap((x, i) =>
              ys
                .slice(0, -1)
                .map((y, j) => (
                  <rect
                    key={`b${x}:${y}`}
                    x={x + 3}
                    y={y + 3}
                    width={xs[i + 1] - x - 6}
                    height={ys[j + 1] - y - 6}
                    rx="2"
                    fill="var(--m-block)"
                  />
                )),
            )}
          {buildings.map((b) => (
            <rect
              key={`h${b.x.toFixed(1)}:${b.y.toFixed(1)}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="1"
              fill="var(--m-bldg)"
            />
          ))}
          <rect x={park.x} y={park.y} width={park.w} height={park.h} rx="3" fill="var(--m-park)" />
          {[0.2, 0.45, 0.7].map((f) => (
            <circle
              key={f}
              cx={park.x + park.w * f}
              cy={park.y + park.h * (0.35 + f * 0.4)}
              r="3.5"
              fill="var(--m-park-dark)"
            />
          ))}
          {/* minor street casings, then fills */}
          {xs.map((x) => line(false, x, 7, "var(--m-case)", `cx${x}`))}
          {ys.map((y) => line(true, y, 7, "var(--m-case)", `cy${y}`))}
          {xs.map((x) => line(false, x, 5, "var(--m-road)", `rx${x}`))}
          {ys.map((y) => line(true, y, 5, "var(--m-road)", `ry${y}`))}
          {/* arterials */}
          {line(false, artX, 10, "var(--m-art-case)", "ac1")}
          {line(true, 0, 10, "var(--m-art-case)", "ac2")}
          {line(false, artX, 8, "var(--m-art)", "a1")}
          {line(true, 0, 8, "var(--m-art)", "a2")}
          {streets[0] && (
            <text
              x={-R / 2 - 20}
              y={3}
              fontSize="9"
              fontWeight="600"
              letterSpacing=".4"
              fill="var(--m-label)"
              style={halo}
            >
              {streets[0].toUpperCase()}
            </text>
          )}
          {streets[1] && (
            <text
              transform="translate(3 -34) rotate(-90)"
              fontSize="9"
              fontWeight="600"
              letterSpacing=".4"
              fill="var(--m-label)"
              style={halo}
            >
              {streets[1].toUpperCase()}
            </text>
          )}
        </g>
        <path d={hwy} fill="none" stroke="var(--m-hwy-case)" strokeWidth="12" />
        <path d={hwy} fill="none" stroke="var(--m-hwy)" strokeWidth="9" />
        <path d={water} fill="var(--m-water)" stroke="var(--m-shore)" strokeWidth="2" />
        <text
          transform={`translate(${waterLabel.x} ${waterLabel.y}) rotate(${waterLabel.rot})`}
          fontSize="10"
          fontStyle="italic"
          letterSpacing="1"
          fill="var(--m-water-label)"
        >
          {WATER_NAMES[Math.floor(r() * WATER_NAMES.length)]}
        </text>
        <text
          x={W * 0.4}
          y={H * 0.64}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          letterSpacing="2.5"
          fill="var(--m-hood)"
          style={halo}
        >
          {hood.toUpperCase()}
        </text>
        {pois.map((p) => (
          <g key={p.name} transform={`translate(${p.x} ${p.y})`}>
            <circle r="7" fill={POI_COLOR[p.kind]} stroke="var(--m-halo)" strokeWidth="1.5" />
            <circle r="2.2" fill="#fff" />
            <text
              x="10"
              y="3.5"
              fontSize="10"
              fontWeight="600"
              fill={POI_COLOR[p.kind]}
              style={halo}
            >
              {p.name}
            </text>
          </g>
        ))}
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <ellipse cx="0" cy="1" rx="6" ry="2.5" fill="rgba(0,0,0,.25)" />
          <path
            d="M0 0C-3-6-13-12-13-22a13 13 0 0 1 26 0C13-12 3-6 0 0Z"
            fill="#e41e3f"
            stroke="#fff"
            strokeWidth="2"
          />
          <circle cx="0" cy="-22" r="4.5" fill="#fff" />
        </g>
      </svg>
      <span className="absolute right-3 bottom-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
        <Info size={14} strokeWidth={2.6} />
      </span>
    </div>
  );
}

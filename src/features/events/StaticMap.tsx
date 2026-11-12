import { Info } from "lucide-react";

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

/**
 * A styled, static street map (stand-in for Facebook's map tiles): a rotated
 * street grid, a park, water, street labels from the address and a red pin.
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
  const angle = -20 - Math.round(r() * 30);
  const step = 46 + Math.round(r() * 10);
  const lines = Array.from({ length: 22 }, (_, i) => (i - 11) * step);
  const arterial = new Set([Math.floor(r() * 6) - 3, Math.floor(r() * 6) - 3]);
  const waterLeft = r() > 0.5;
  const streets = (address ?? "")
    .split(/&|,/)
    .map((s) => s.trim())
    .filter((s) => /\b(St|Ave|Way|Blvd|Rd|Pl|Dr)\b/.test(s))
    .slice(0, 2);
  const park = { x: Math.round(r() * 3 + 1) * step, y: Math.round(r() * 2 - 3) * step };

  return (
    <div className="relative overflow-hidden" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={address ? `Map of ${address}` : "Map"}
      >
        <rect width={W} height={H} className="fill-[#eef0f2] dark:fill-[#2b2f35]" />
        <g transform={`translate(${W / 2} ${H / 2}) rotate(${angle})`}>
          <rect
            x={park.x}
            y={park.y}
            width={step * 2 - 8}
            height={step - 8}
            rx="4"
            className="fill-[#cfe8cf] dark:fill-[#2f4a39]"
          />
          {lines.map((p, i) => (
            <g key={p}>
              <line
                x1={p}
                y1={-600}
                x2={p}
                y2={600}
                strokeWidth={arterial.has(i - 11) ? 9 : 5}
                className={
                  arterial.has(i - 11)
                    ? "stroke-[#ffe7a3] dark:stroke-[#5b5236]"
                    : "stroke-white dark:stroke-[#41464e]"
                }
              />
              <line
                x1={-600}
                y1={p}
                x2={600}
                y2={p}
                strokeWidth={i === 12 ? 9 : 5}
                className={
                  i === 12
                    ? "stroke-[#ffe7a3] dark:stroke-[#5b5236]"
                    : "stroke-white dark:stroke-[#41464e]"
                }
              />
            </g>
          ))}
          {streets[0] && (
            <text
              x={-150}
              y={step - 5}
              className="fill-[#5f6368] font-semibold text-[9px] uppercase tracking-wide dark:fill-[#9aa0a6]"
            >
              {streets[0]}
            </text>
          )}
          {streets[1] && (
            <text
              transform={`translate(${step - 5} 120) rotate(-90)`}
              className="fill-[#5f6368] font-semibold text-[9px] uppercase tracking-wide dark:fill-[#9aa0a6]"
            >
              {streets[1]}
            </text>
          )}
        </g>
        <path
          d={
            waterLeft
              ? `M0 ${H * 0.55} C ${W * 0.12} ${H * 0.62}, ${W * 0.18} ${H * 0.8}, ${W * 0.3} ${H} L0 ${H} Z`
              : `M${W} ${H * 0.35} C ${W * 0.86} ${H * 0.5}, ${W * 0.8} ${H * 0.75}, ${W * 0.72} ${H} L${W} ${H} Z`
          }
          className="fill-[#a9d3f5] dark:fill-[#1d3b57]"
        />
        <g transform={`translate(${W / 2} ${H / 2})`}>
          <ellipse cx="0" cy="2" rx="6" ry="2.5" fill="rgba(0,0,0,.25)" />
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

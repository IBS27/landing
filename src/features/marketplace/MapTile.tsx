import { useId } from "react";
import { cn } from "@/lib/format";

/** Small deterministic PRNG so each place gets its own, stable street layout. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const W = 400;
const H = 240;
const STEP = 17;

/** The street layout for a seed, in a 400x240 world. */
function layout(seed: string) {
  const r = rng(seed);
  const angle = -14 + r() * 28;
  // Minor street offsets, with a few streets skipped for irregular blocks.
  const lines = (len: number, base: number) => {
    const out: number[] = [];
    for (let p = -len / 2; p < len / 2; p += base * (0.7 + r() * 0.75)) {
      if (r() > 0.1) out.push(p);
    }
    return out;
  };
  const vertical = lines(W * 1.6, STEP * 1.25).map((x) => x + W / 2);
  const horizontal = lines(H * 2.2, STEP).map((y) => y + H / 2);
  const diagonal = { x: W / 2 + (r() - 0.5) * 200, tilt: 0.5 + r() * 0.8 };
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)] as T;
  const arterialsV = [W / 2 - 60 - r() * 40, W / 2 + 50 + r() * 50];
  const arterialsH = [H / 2 - 30 - r() * 30, H / 2 + 35 + r() * 25];
  const parks = Array.from({ length: 3 }, () => ({
    x: W / 2 + (r() - 0.5) * 300,
    y: H / 2 + (r() - 0.5) * 180,
    w: STEP * (1 + Math.floor(r() * 3)),
    h: STEP * (1 + Math.floor(r() * 2)),
  }));
  const water = pick(["left", "right", "top", "lake"] as const);
  const wobble = Array.from({ length: 6 }, () => (r() - 0.5) * 30);
  const highway = r() > 0.35;
  const hwX = W / 2 + (r() - 0.5) * 160;
  return {
    angle,
    vertical,
    horizontal,
    diagonal,
    arterialsV,
    arterialsH,
    parks,
    water,
    wobble,
    highway,
    hwX,
  };
}

function waterPath(kind: ReturnType<typeof layout>["water"], w: number[]) {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = w;
  switch (kind) {
    case "left":
      return `M0 0H${70 + a}C${55 + b} 50 ${85 + c} 90 ${60 + d} 130S${40 + e} 200 ${70 + f} ${H}H0Z`;
    case "right":
      return `M${W} 0H${330 + a}C${345 + b} 60 ${315 + c} 100 ${338 + d} 150S${350 + e} 210 ${325 + f} ${H}H${W}Z`;
    case "top":
      return `M0 0H${W}V${18 + a / 2}C${300 + b} ${30 + c / 2} ${220 + d} ${10 + e / 2} 140 ${26 + f / 2}S40 ${12 + a / 3} 0 ${24 + b / 3}Z`;
    default:
      return `M${250 + a} ${40 + b / 2}c22-10 44 2 42 24-2 18-24 26-40 18-14-7-18-32-2-42Z`;
  }
}

/**
 * A static light street map (no external tiles): a seeded street grid,
 * arterials, parks, water and an optional highway, with the place label and
 * Marketplace's "approximate area" circle on top. Dark mode swaps the palette.
 */
export function MapTile({
  label,
  seed,
  height = 52,
  radius = 20,
  className,
  info,
}: {
  label: string;
  seed?: string;
  height?: number;
  radius?: number;
  className?: string;
  /** Show the "i" attribution badge (as on Facebook's map strip). */
  info?: boolean;
}) {
  const m = layout(seed ?? label);
  const clip = useId();
  const casing = "var(--map-casing)";
  return (
    <div
      className={cn(
        "relative w-full select-none overflow-hidden",
        "[--map-arterial-casing:#e9cf7a] [--map-arterial:#fdf0b8] [--map-casing:#dfdbd2] [--map-highway-casing:#e4a94f] [--map-highway:#f9c66b] [--map-land:#f2efe9] [--map-park:#cfe8c4] [--map-road:#ffffff] [--map-water:#aad3f2]",
        "dark:[--map-arterial-casing:#5a4e2c] dark:[--map-arterial:#6b5b2d] dark:[--map-casing:#3a3c40] dark:[--map-highway-casing:#5e4320] dark:[--map-highway:#8a6630] dark:[--map-land:#2f3034] dark:[--map-park:#24382a] dark:[--map-road:#45474c] dark:[--map-water:#1c3a57]",
        className,
      )}
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <clipPath id={clip}>
            <rect width={W} height={H} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width={W} height={H} fill="var(--map-land)" />
          <g transform={`rotate(${m.angle} ${W / 2} ${H / 2})`}>
            {m.parks.map((p) => (
              <rect
                key={`${p.x}-${p.y}`}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx="2"
                fill="var(--map-park)"
              />
            ))}
            <g strokeLinecap="square" fill="none">
              {[casing, "var(--map-road)"].map((stroke, k) => (
                <g key={stroke} stroke={stroke} strokeWidth={k === 0 ? 3.6 : 2.4}>
                  {m.vertical.map((x) => (
                    <path key={`v${x}`} d={`M${x} ${-H} V${H * 2}`} />
                  ))}
                  {m.horizontal.map((y) => (
                    <path key={`h${y}`} d={`M${-W / 2} ${y} H${W * 1.5}`} />
                  ))}
                  <path
                    d={`M${m.diagonal.x - H * m.diagonal.tilt} ${-H / 2} L${m.diagonal.x + H * m.diagonal.tilt} ${H * 1.5}`}
                    strokeWidth={k === 0 ? 4.6 : 3.2}
                  />
                </g>
              ))}
              {[
                ["var(--map-arterial-casing)", 7],
                ["var(--map-arterial)", 5],
              ].map(([stroke, w]) => (
                <g key={String(stroke)} stroke={String(stroke)} strokeWidth={Number(w)}>
                  {m.arterialsV.map((x) => (
                    <path key={`av${x}`} d={`M${x} ${-H} V${H * 2}`} />
                  ))}
                  {m.arterialsH.map((y) => (
                    <path key={`ah${y}`} d={`M${-W / 2} ${y} H${W * 1.5}`} />
                  ))}
                </g>
              ))}
            </g>
          </g>
          {m.highway && (
            <g fill="none" strokeLinecap="round">
              {[
                ["var(--map-highway-casing)", 9],
                ["var(--map-highway)", 6.5],
              ].map(([stroke, w]) => (
                <path
                  key={String(stroke)}
                  d={`M${m.hwX - 30} ${-10}C${m.hwX + 10} 70 ${m.hwX - 40} 150 ${m.hwX + 20} ${H + 10}`}
                  stroke={String(stroke)}
                  strokeWidth={Number(w)}
                />
              ))}
            </g>
          )}
          <path d={waterPath(m.water, m.wobble)} fill="var(--map-water)" />
        </g>
      </svg>
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0866FF] bg-[#0866FF]/15"
        style={{ width: radius * 2, height: radius * 2 }}
      />
      <span className="absolute top-1 left-1/2 -translate-x-1/2 whitespace-nowrap font-bold text-[#1c1e21] text-[13px] leading-4 [text-shadow:0_0_2px_#fff,0_0_3px_#fff,0_0_4px_#fff] dark:text-white dark:[text-shadow:0_0_3px_#000,0_0_4px_#000]">
        {label}
      </span>
      {info && (
        <span className="absolute right-1.5 bottom-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white font-bold font-serif text-[#1c1e21] text-[11px] leading-none shadow-[0_0_0_1.5px_#1c1e21]">
          i
        </span>
      )}
    </div>
  );
}

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/format";
import {
  type EngineProps,
  GameFrame,
  gameScale,
  type Phase,
  randInt,
  useKeys,
  useReport,
} from "./kit";

/**
 * Merge board: tap the generator for items, drag two identical items together
 * to make the next one in the chain, and fill orders for coins. The game ends
 * when the board is full and nothing can merge or ship.
 */

const COLS = 7;
const ROWS = 6;
const CELL = 52;
const GEN = 38;

type Theme = {
  chain: { e: string; name: string }[];
  gen: { e: string; name: string };
  progress: string;
};

const THEMES: Record<string, Theme> = {
  "manor-makeover": {
    chain: [
      { e: "🪵", name: "Plank" },
      { e: "🪑", name: "Chair" },
      { e: "🛋️", name: "Sofa" },
      { e: "🪔", name: "Lamp" },
      { e: "🖼️", name: "Painting" },
      { e: "🪞", name: "Mirror" },
      { e: "🕰️", name: "Grandfather clock" },
    ],
    gen: { e: "🧰", name: "Toolbox" },
    progress: "Rooms restored",
  },
  "harbor-tycoon": {
    chain: [
      { e: "🛶", name: "Canoe" },
      { e: "⛵", name: "Sailboat" },
      { e: "🚤", name: "Speedboat" },
      { e: "🛥️", name: "Motor yacht" },
      { e: "⛴️", name: "Ferry" },
      { e: "🚢", name: "Cargo ship" },
    ],
    gen: { e: "⚓", name: "Boatyard" },
    progress: "Piers built",
  },
  "island-village": {
    chain: [
      { e: "⛺", name: "Tent" },
      { e: "🛖", name: "Hut" },
      { e: "🏠", name: "House" },
      { e: "🏡", name: "Cottage" },
      { e: "🏘️", name: "Neighbourhood" },
      { e: "🏨", name: "Hotel" },
      { e: "🏝️", name: "Resort island" },
    ],
    gen: { e: "🌴", name: "Palm grove" },
    progress: "Homes built",
  },
  "rail-city": {
    chain: [
      { e: "🔩", name: "Bolts" },
      { e: "🛤️", name: "Track" },
      { e: "🚃", name: "Railcar" },
      { e: "🚋", name: "Tram" },
      { e: "🚂", name: "Steam engine" },
      { e: "🚄", name: "Express train" },
      { e: "🚉", name: "Station" },
    ],
    gen: { e: "🏭", name: "Depot" },
    progress: "Lines opened",
  },
};

type Order = { id: number; tier: number; reward: number };
let orderId = 1;
const newOrder = (maxTier: number): Order => {
  const tier = 2 + randInt(Math.max(1, Math.min(maxTier, 5) - 1));
  return { id: orderId++, tier, reward: 15 * 2 ** tier };
};

/** Empty cells ordered by distance from the generator. */
function nearestEmpty(cells: (number | null)[]) {
  const gr = Math.floor(GEN / COLS);
  const gc = GEN % COLS;
  return cells
    .map((v, i) => ({
      i,
      v,
      d: Math.hypot(Math.floor(i / COLS) - gr, (i % COLS) - gc) + Math.random() * 0.1,
    }))
    .filter((x) => x.v === null && x.i !== GEN)
    .sort((a, b) => a.d - b.d)[0]?.i;
}

function startingCells() {
  const cells: (number | null)[] = Array(COLS * ROWS).fill(null);
  for (const [i, t] of [
    [8, 0],
    [12, 0],
    [17, 1],
    [22, 0],
    [24, 1],
  ] as const)
    cells[i] = t;
  return cells;
}

export default function MergeBoard({ game, onScore }: EngineProps) {
  const theme = THEMES[game.id] ?? THEMES["manor-makeover"];
  const top = theme.chain.length - 1;
  const [phase, setPhase] = useState<Phase>("ready");
  const [cells, setCells] = useState<(number | null)[]>(startingCells);
  const [orders, setOrders] = useState<Order[]>(() => [newOrder(2), newOrder(2), newOrder(3)]);
  const [coins, setCoins] = useState(0);
  const [shipped, setShipped] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; dx: number; dy: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const suppress = useRef(false);
  useReport(coins, onScore);

  const maxTier = Math.max(1, ...cells.map((v) => v ?? 0));

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((x) => (x === t ? null : x)), 1200);
  };

  const start = () => {
    setCells(startingCells());
    setOrders([newOrder(2), newOrder(2), newOrder(3)]);
    setCoins(0);
    setShipped(0);
    setSel(null);
    setPhase("playing");
  };

  const spawn = () => {
    if (phase !== "playing") return;
    const i = nearestEmpty(cellsRef.current);
    if (i === undefined) {
      say("Board is full — merge or fill an order");
      return;
    }
    const n = [...cellsRef.current];
    n[i] = Math.random() < 0.2 ? 1 : 0;
    setCells(n);
    setPop(i);
  };

  /** Moves the item at `a` onto cell `b`: merge, move or swap. */
  const act = (a: number, b: number) => {
    const c = [...cellsRef.current];
    const va = c[a];
    if (va === null || a === b || b === GEN) return;
    const vb = c[b];
    if (vb === va && va < top) {
      c[a] = null;
      c[b] = va + 1;
      setCoins((x) => x + 2 ** (va + 1));
      setPop(b);
      if (va + 1 === top) say(`${theme.chain[top].name} unlocked!`);
    } else {
      c[a] = vb;
      c[b] = va;
    }
    setCells(c);
    setSel(null);
  };

  const deliver = (o: Order, from?: number) => {
    const c = [...cellsRef.current];
    const at = from !== undefined && c[from] === o.tier ? from : c.indexOf(o.tier);
    if (at < 0) {
      say(`You need a ${theme.chain[o.tier].name}`);
      return;
    }
    c[at] = null;
    setCells(c);
    setCoins((x) => x + o.reward);
    setShipped((s) => s + 1);
    setOrders((os) => os.map((x) => (x.id === o.id ? newOrder(maxTier + 1) : x)));
    setSel(null);
    say(`+${o.reward} coins`);
  };

  const clickCell = (i: number) => {
    if (suppress.current || phase !== "playing") return;
    if (i === GEN) return spawn();
    if (sel === null) {
      if (cells[i] !== null) setSel(i);
    } else if (sel === i) setSel(null);
    else act(sel, i);
  };

  const stuck = useMemo(() => {
    if (cells.some((v, i) => v === null && i !== GEN)) return false;
    const seen = new Set<number>();
    for (const v of cells) {
      if (v === null) continue;
      if (seen.has(v) && v < top) return false;
      seen.add(v);
    }
    return !orders.some((o) => seen.has(o.tier));
  }, [cells, orders, top]);

  useEffect(() => {
    if (phase === "playing" && stuck) {
      const t = setTimeout(() => setPhase("over"), 900);
      return () => clearTimeout(t);
    }
  }, [phase, stuck]);

  useEffect(() => {
    if (pop === null) return;
    const t = setTimeout(() => setPop(null), 260);
    return () => clearTimeout(t);
  }, [pop]);

  const onPointerDown = (e: ReactPointerEvent, from: number) => {
    if (e.button !== 0 || phase !== "playing" || cells[from] === null || from === GEN) return;
    setCursor(null);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const k = gameScale(e.currentTarget);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / k;
      const dy = (ev.clientY - y0) / k;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      setDrag({ from, dx, dy });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) return;
      suppress.current = true;
      setTimeout(() => {
        suppress.current = false;
      }, 0);
      for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
        if (el.closest("[data-dragging]")) continue;
        const cell = el.closest<HTMLElement>("[data-cell]")?.dataset.cell;
        if (cell !== undefined) return act(from, Number(cell));
        const order = el.closest<HTMLElement>("[data-order]")?.dataset.order;
        if (order !== undefined) {
          const o = orders.find((x) => x.id === Number(order));
          if (o) {
            if (cellsRef.current[from] === o.tier) deliver(o, from);
            else say(`That order needs a ${theme.chain[o.tier].name}`);
          }
          return;
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useKeys((e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (d !== undefined) {
      const cur = cursor ?? GEN;
      const n = cur + d;
      const ok =
        n >= 0 &&
        n < COLS * ROWS &&
        !(d === -1 && cur % COLS === 0) &&
        !(d === 1 && cur % COLS === COLS - 1);
      setCursor(cursor === null ? GEN : ok ? n : cur);
      return true;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (cursor === null) setCursor(GEN);
      else clickCell(cursor);
      return true;
    }
    if (e.key === "g" || e.key === "G") {
      spawn();
      return true;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 3 && orders[n - 1]) {
      deliver(orders[n - 1]);
      return true;
    }
    if (e.key === "Escape" && sel !== null) {
      setSel(null);
      return true;
    }
    return false;
  }, phase === "playing");

  const have = new Set(cells.filter((v): v is number => v !== null));

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo={`Tap the ${theme.gen.name.toLowerCase()} for items, drag matching items together to merge them, and fill orders for coins.`}
      overTitle="The board is full"
      overDetail={`${coins} coins · ${shipped} orders filled`}
      onStart={start}
      hud={
        <>
          <span>
            {theme.progress} <b>{Math.floor(shipped / 3)}</b>
          </span>
          <span>
            Orders filled <b>{shipped}</b>
          </span>
          <span>
            Best item <b>{theme.chain[maxTier].e}</b>
          </span>
        </>
      }
      hint={`Drag to merge · Click the ${theme.gen.e} or press G · 1–3 fill orders`}
      className="w-[388px] p-3"
      style={{ background: `linear-gradient(170deg, ${game.from}, ${game.band})` }}
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        {orders.map((o, k) => {
          const ready = have.has(o.tier);
          return (
            <button
              key={o.id}
              type="button"
              data-order={o.id}
              onClick={() => phase === "playing" && deliver(o)}
              className={cn(
                "flex h-[58px] items-center gap-2 rounded-lg bg-white/90 px-2 text-left text-[#1c1e21] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform",
                ready && "ring-[3px] ring-[#42b72a] hover:-translate-y-0.5",
              )}
              aria-label={`Order ${k + 1}: ${theme.chain[o.tier].name} for ${o.reward} coins`}
            >
              <span className="text-[26px] leading-none">{theme.chain[o.tier].e}</span>
              <span className="min-w-0 leading-4">
                <span className="block truncate font-semibold text-[12px]">
                  {theme.chain[o.tier].name}
                </span>
                <span className="block font-bold text-[#b07a00] text-[13px]">🪙 {o.reward}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="grid rounded-lg bg-black/15 p-[2px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL - 2}px)`, gap: 2 }}
      >
        {cells.map((v, i) => {
          const isGen = i === GEN;
          const item = isGen ? theme.gen : v !== null ? theme.chain[v] : null;
          const dragging = drag?.from === i;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              data-cell={i}
              title={
                item
                  ? isGen
                    ? `${item.name} — tap for items`
                    : `${item.name} (level ${(v ?? 0) + 1})`
                  : undefined
              }
              aria-label={item ? item.name : "Empty"}
              onPointerDown={(e) => onPointerDown(e, i)}
              onClick={() => clickCell(i)}
              className={cn(
                "relative flex touch-none items-center justify-center rounded-md text-[28px] leading-none",
                isGen
                  ? "bg-gradient-to-b from-[#ffe8a3] to-[#f2b632] shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)] active:scale-95"
                  : "bg-white/55",
                v !== null &&
                  !isGen &&
                  v < top &&
                  have.has(v) &&
                  cells.filter((x) => x === v).length > 1 &&
                  "bg-white/75",
                sel === i && "ring-[3px] ring-white",
                cursor === i && "outline-[3px] outline-[#ffe066] outline-offset-[-3px] outline",
              )}
              style={{ height: CELL - 2 }}
            >
              {item && (
                <span
                  data-dragging={dragging ? "" : undefined}
                  className={cn("relative block", pop === i && "animate-[mb-pop_.26s_ease-out]")}
                  style={
                    dragging
                      ? {
                          transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.15)`,
                          zIndex: 40,
                        }
                      : undefined
                  }
                >
                  {item.e}
                </span>
              )}
              {v !== null && !isGen && (
                <span className="absolute right-[3px] bottom-[2px] font-bold text-[10px] text-black/45 leading-none">
                  {v + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <style>
        {"@keyframes mb-pop{0%{transform:scale(.4)}70%{transform:scale(1.2)}100%{transform:none}}"}
      </style>
      {toast && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center">
          <span className="rounded-full bg-black/70 px-3 py-1.5 font-semibold text-[13px] text-white">
            {toast}
          </span>
        </p>
      )}
    </GameFrame>
  );
}

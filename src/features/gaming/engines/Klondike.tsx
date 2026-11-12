import { Undo2 } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import {
  CardBack,
  CardFace,
  cardName,
  EmptySlot,
  felt,
  isRed,
  newDeck,
  type PlayingCard,
  SUIT_GLYPH,
} from "./cards";
import { type EngineProps, GameFrame, gameScale, type Phase, useKeys, useReport } from "./kit";

/** Klondike solitaire, draw one, with Windows-style scoring. */

type K = {
  stock: PlayingCard[];
  waste: PlayingCard[];
  found: PlayingCard[][];
  tab: PlayingCard[][];
  score: number;
  moves: number;
};
type Src =
  | { kind: "waste" }
  | { kind: "found"; i: number }
  | { kind: "tab"; i: number; at: number };
type Dst = { kind: "found"; i: number } | { kind: "tab"; i: number };

// Landscape table (fills the player's wide stage): stock + waste in a left
// column, the seven tableau piles, and the four foundations stacked on the right.
const CW = 48;
const CH = 67;
const GAP = 6;
const SIDE_GAP = 14;
const TAB_H = 4 * CH + 3 * GAP;
const DOWN_OFF = 7;
const UP_OFF = 19;
const TABLE_W = 2 * CW + 2 * SIDE_GAP + 7 * CW + 6 * GAP + 16;

function deal(): K {
  const d = newDeck();
  const tab = Array.from({ length: 7 }, (_, i) =>
    d.splice(0, i + 1).map((c, j) => ({ ...c, up: j === i })),
  );
  return { stock: d, waste: [], found: [[], [], [], []], tab, score: 0, moves: 0 };
}

const top = <T,>(xs: T[]) => xs[xs.length - 1];

function cardsAt(s: K, src: Src): PlayingCard[] {
  if (src.kind === "waste") return s.waste.slice(-1);
  if (src.kind === "found") return s.found[src.i].slice(-1);
  return s.tab[src.i].slice(src.at);
}

function fits(s: K, cards: PlayingCard[], dst: Dst) {
  const c = cards[0];
  if (!c?.up) return false;
  if (dst.kind === "found") {
    if (cards.length !== 1) return false;
    const t = top(s.found[dst.i]);
    return t ? t.suit === c.suit && t.rank === c.rank - 1 : c.rank === 1;
  }
  const t = top(s.tab[dst.i]);
  return t ? t.up && isRed(t.suit) !== isRed(c.suit) && t.rank === c.rank + 1 : c.rank === 13;
}

function apply(s: K, src: Src, dst: Dst): K {
  const cards = cardsAt(s, src);
  const n: K = {
    ...s,
    waste: [...s.waste],
    found: s.found.map((p) => [...p]),
    tab: s.tab.map((p) => [...p]),
    moves: s.moves + 1,
  };
  let pts = 0;
  if (src.kind === "waste") {
    n.waste.pop();
    pts += dst.kind === "found" ? 10 : 5;
  } else if (src.kind === "found") {
    n.found[src.i].pop();
    pts -= 15;
  } else {
    const pile = n.tab[src.i];
    pile.splice(src.at);
    if (dst.kind === "found") pts += 10;
    const t = top(pile);
    if (t && !t.up) {
      pile[pile.length - 1] = { ...t, up: true };
      pts += 5;
    }
  }
  if (dst.kind === "found") n.found[dst.i].push(cards[0]);
  else n.tab[dst.i].push(...cards);
  n.score = Math.max(0, s.score + pts);
  return n;
}

function draw(s: K): K {
  if (s.stock.length === 0) {
    if (s.waste.length === 0) return s;
    return {
      ...s,
      stock: [...s.waste].reverse().map((c) => ({ ...c, up: false })),
      waste: [],
      score: Math.max(0, s.score - 100),
      moves: s.moves + 1,
    };
  }
  const stock = s.stock.slice(0, -1);
  const c = top(s.stock);
  return { ...s, stock, waste: [...s.waste, { ...c, up: true }], moves: s.moves + 1 };
}

/** Where a click sends a card: a foundation first, then the best tableau pile. */
function bestDst(s: K, src: Src): Dst | null {
  const cards = cardsAt(s, src);
  if (src.kind !== "found")
    for (let i = 0; i < 4; i++)
      if (fits(s, cards, { kind: "found", i })) return { kind: "found", i };
  const order = [0, 1, 2, 3, 4, 5, 6].sort(
    (a, b) => Number(s.tab[a].length === 0) - Number(s.tab[b].length === 0),
  );
  for (const i of order) {
    if (src.kind === "tab" && src.i === i) continue;
    // Moving a king that already heads its pile to an empty pile achieves nothing.
    if (src.kind === "tab" && src.at === 0 && s.tab[i].length === 0) continue;
    if (fits(s, cards, { kind: "tab", i })) return { kind: "tab", i };
  }
  return null;
}

/** One card that can go up to a foundation (used by auto-complete). */
function autoStep(s: K): K | null {
  const srcs: Src[] = [
    { kind: "waste" },
    ...s.tab.map((p, i) => ({ kind: "tab" as const, i, at: p.length - 1 })),
  ];
  for (const src of srcs) {
    const cards = cardsAt(s, src);
    if (!cards.length) continue;
    for (let i = 0; i < 4; i++)
      if (fits(s, cards, { kind: "found", i })) return apply(s, src, { kind: "found", i });
  }
  return null;
}

const won = (s: K) => s.found.every((p) => p.length === 13);
const canAutoFinish = (s: K) =>
  !won(s) &&
  s.stock.length === 0 &&
  s.waste.length === 0 &&
  s.tab.every((p) => p.every((c) => c.up));

function parseDst(v: string | undefined): Dst | null {
  const [kind, i] = (v ?? "").split(":");
  if (kind === "found" || kind === "tab") return { kind, i: Number(i) };
  return null;
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

export default function Klondike({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [s, setS] = useState<K>(deal);
  const [history, setHistory] = useState<K[]>([]);
  const [time, setTime] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [drag, setDrag] = useState<{ ids: Set<number>; dx: number; dy: number } | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const sRef = useRef(s);
  sRef.current = s;
  const suppressClick = useRef(false);

  useReport(s.score + bonus, onScore);

  const start = () => {
    setS(deal());
    setHistory([]);
    setTime(0);
    setBonus(0);
    setPhase("playing");
  };

  const commit = (next: K) => {
    if (next === sRef.current) return;
    setHistory((h) => [...h.slice(-199), sRef.current]);
    sRef.current = next;
    setS(next);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev || phase !== "playing") return;
    setHistory((h) => h.slice(0, -1));
    sRef.current = prev;
    setS(prev);
  };

  const tryMove = (src: Src, dst: Dst) => {
    if (!fits(sRef.current, cardsAt(sRef.current, src), dst)) return false;
    commit(apply(sRef.current, src, dst));
    return true;
  };

  const clickCard = (src: Src, id: number) => {
    // Foundation cards only come back down by dragging.
    if (suppressClick.current || phase !== "playing" || src.kind === "found") return;
    const dst = bestDst(sRef.current, src);
    if (dst) tryMove(src, dst);
    else {
      setShake(id);
      setTimeout(() => setShake(null), 300);
    }
  };

  // Clock.
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => setTime((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Win, and auto-complete once every card is face up.
  const auto = phase === "playing" && canAutoFinish(s);
  useEffect(() => {
    if (phase === "playing" && won(s)) {
      setBonus(Math.max(0, 1000 - time * 2));
      setPhase("over");
    }
  }, [s, phase, time]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-arms after every auto move (`s` changes).
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => {
      const next = autoStep(sRef.current);
      if (next) {
        sRef.current = next;
        setS(next);
      }
    }, 90);
    return () => clearTimeout(t);
  }, [auto, s]);

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (k === "d" || k === " ") {
      commit(draw(sRef.current));
      return true;
    }
    if (k === "z" || k === "u") {
      undo();
      return true;
    }
    if (k === "a") {
      const next = autoStep(sRef.current);
      if (next) commit(next);
      return true;
    }
    return false;
  }, phase === "playing");

  const onPointerDown = (e: ReactPointerEvent, src: Src) => {
    if (e.button !== 0 || phase !== "playing") return;
    const cards = cardsAt(sRef.current, src);
    if (!cards[0]?.up) return;
    const ids = new Set(cards.map((c) => c.id));
    const x0 = e.clientX;
    const y0 = e.clientY;
    const k = gameScale(e.currentTarget);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / k;
      const dy = (ev.clientY - y0) / k;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      setDrag({ ids, dx, dy });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (!moved) return;
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
        if (el.closest("[data-drag='1']")) continue;
        const dst = parseDst(el.closest<HTMLElement>("[data-drop]")?.dataset.drop);
        if (dst) {
          tryMove(src, dst);
          break;
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const dragStyle = (id: number) =>
    drag?.ids.has(id)
      ? {
          transform: `translate(${drag.dx}px, ${drag.dy}px)`,
          zIndex: 50,
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))",
        }
      : undefined;

  const cardButton = (c: PlayingCard, src: Src, extra?: string) => (
    <button
      key={c.id}
      type="button"
      aria-label={cardName(c)}
      data-drag={drag?.ids.has(c.id) ? "1" : undefined}
      onPointerDown={(e) => onPointerDown(e, src)}
      onClick={() => clickCard(src, c.id)}
      className={cn(
        "block touch-none rounded-[5px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-white",
        shake === c.id && "animate-[k-shake_.3s]",
        extra,
      )}
      style={dragStyle(c.id)}
    >
      <CardFace card={c} w={CW} h={CH} />
    </button>
  );

  const prevWaste = s.waste[s.waste.length - 2];
  const wasteTop = top(s.waste);

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Build each suit up from Ace to King on the foundations. Stack the tableau down in alternating colors."
      overTitle="You win!"
      overDetail={`${s.score + bonus} points · ${s.moves} moves · ${clock(time)}`}
      onStart={start}
      hud={
        <>
          <span>
            Moves <b>{s.moves}</b>
          </span>
          <span>
            Time <b>{clock(time)}</b>
          </span>
        </>
      }
      hint="Drag or click cards · D draw · Z undo"
      extra={
        <Button
          variant="secondary"
          size="sm"
          icon={<Undo2 size={14} />}
          disabled={history.length === 0}
          onClick={undo}
        >
          Undo
        </Button>
      }
      className="p-2"
      style={{ width: TABLE_W, background: felt(game) }}
    >
      <style>
        {
          "@keyframes k-shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}"
        }
      </style>
      <div className="flex" style={{ gap: SIDE_GAP }}>
        <div className="flex flex-col" style={{ gap: GAP }}>
          <button
            type="button"
            aria-label={
              s.stock.length ? `Draw a card (${s.stock.length} left)` : "Recycle the waste pile"
            }
            onClick={() => phase === "playing" && commit(draw(sRef.current))}
            className="relative rounded-[5px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-white"
            style={{ width: CW, height: CH }}
          >
            {s.stock.length > 0 ? (
              <>
                {s.stock.length > 1 && (
                  <CardBack game={game} w={CW} h={CH} className="absolute top-[2px] left-[2px]" />
                )}
                <CardBack game={game} w={CW} h={CH} className="relative" />
              </>
            ) : (
              <EmptySlot w={CW} h={CH} label="↻" />
            )}
          </button>
          <div className="relative" style={{ width: CW, height: CH }}>
            {prevWaste && <CardFace card={prevWaste} w={CW} h={CH} className="absolute inset-0" />}
            {wasteTop ? (
              <div className="absolute inset-0">{cardButton(wasteTop, { kind: "waste" })}</div>
            ) : (
              <EmptySlot w={CW} h={CH} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-7" style={{ gap: GAP }}>
          {s.tab.map((pile, i) => {
            const downs = pile.filter((c) => !c.up).length;
            const ups = pile.length - downs;
            const upOff =
              ups > 1 ? Math.min(UP_OFF, (TAB_H - CH - downs * DOWN_OFF) / (ups - 1)) : UP_OFF;
            let y = 0;
            return (
              <div
                key={i}
                data-drop={`tab:${i}`}
                className="relative"
                style={{ width: CW, height: TAB_H }}
              >
                {pile.length === 0 && <EmptySlot w={CW} h={CH} label="K" />}
                {pile.map((c, j) => {
                  const at = y;
                  y += c.up ? upOff : DOWN_OFF;
                  return (
                    <div key={c.id} className="absolute left-0" style={{ top: at }}>
                      {c.up ? (
                        cardButton(c, { kind: "tab", i, at: j })
                      ) : (
                        <CardBack game={game} w={CW} h={CH} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col" style={{ gap: GAP }}>
          {s.found.map((pile, i) => {
            const t = top(pile);
            const under = pile[pile.length - 2];
            return (
              <div
                key={i}
                data-drop={`found:${i}`}
                className="relative"
                style={{ width: CW, height: CH }}
              >
                {under ? (
                  <CardFace card={under} w={CW} h={CH} className="absolute inset-0" />
                ) : (
                  <EmptySlot w={CW} h={CH} label={SUIT_GLYPH[(["S", "H", "D", "C"] as const)[i]]} />
                )}
                {t && <div className="absolute inset-0">{cardButton(t, { kind: "found", i })}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </GameFrame>
  );
}

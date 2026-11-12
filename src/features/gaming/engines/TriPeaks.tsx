import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { CardBack, CardFace, cardName, EmptySlot, felt, newDeck, type PlayingCard } from "./cards";
import { type EngineProps, GameFrame, type Phase, useKeys, useReport } from "./kit";

/**
 * TriPeaks solitaire: clear three peaks by playing cards one rank above or
 * below the waste card (Ace and King wrap). Each hand cleared deals a new one.
 */

const CW = 35;
const CH = 49;
const PITCH = 37;
const ROW_Y = 27;
const BOARD_W = 372;

type Slot = { row: number; x: number; covers: number[] };

/** The 28 tableau slots: rows of 3, 6, 9 and 10 cards; `covers` = slots lying on top. */
const SLOTS: Slot[] = (() => {
  const slots: Slot[] = [];
  const id = (row: number, i: number) => [0, 3, 9, 18][row] + i;
  for (let p = 0; p < 3; p++)
    slots.push({ row: 0, x: 3 * p + 1.5, covers: [id(1, 2 * p), id(1, 2 * p + 1)] });
  for (let j = 0; j < 6; j++) {
    const p = Math.floor(j / 2);
    const k = j % 2;
    slots.push({ row: 1, x: 3 * p + k + 1, covers: [id(2, 3 * p + k), id(2, 3 * p + k + 1)] });
  }
  for (let m = 0; m < 9; m++) slots.push({ row: 2, x: m + 0.5, covers: [id(3, m), id(3, m + 1)] });
  for (let m = 0; m < 10; m++) slots.push({ row: 3, x: m, covers: [] });
  return slots;
})();

type T = {
  tab: (PlayingCard | null)[];
  stock: PlayingCard[];
  waste: PlayingCard[];
  score: number;
  streak: number;
  hand: number;
};

function dealHand(score = 0, hand = 1): T {
  const d = newDeck();
  const tab = d.splice(0, 28);
  const waste = [{ ...d.splice(0, 1)[0], up: true }];
  return { tab, stock: d, waste, score, streak: 0, hand };
}

const isOpen = (s: T, i: number) => SLOTS[i].covers.every((c) => s.tab[c] === null);
const adjacent = (a: number, b: number) => Math.abs(a - b) === 1 || Math.abs(a - b) === 12;

function playable(s: T, i: number) {
  const c = s.tab[i];
  const w = s.waste[s.waste.length - 1];
  return !!c && !!w && isOpen(s, i) && adjacent(c.rank, w.rank);
}

export default function TriPeaks({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [s, setS] = useState<T>(() => dealHand());
  const [flash, setFlash] = useState<string | null>(null);
  useReport(s.score, onScore);

  const anyMove = useMemo(() => s.tab.some((_, i) => playable(s, i)), [s]);
  const stuck = s.stock.length === 0 && !anyMove;

  useEffect(() => {
    if (phase !== "playing" || !stuck) return;
    const t = setTimeout(() => setPhase("over"), 1400);
    return () => clearTimeout(t);
  }, [phase, stuck]);

  const start = () => {
    setS(dealHand());
    setPhase("playing");
  };

  const say = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 900);
  };

  const play = (i: number) => {
    if (phase !== "playing" || !playable(s, i)) return;
    const c = s.tab[i]!;
    const tab = [...s.tab];
    tab[i] = null;
    const streak = s.streak + 1;
    let score = s.score + 10 * streak;
    // Clearing a peak's top card clears that peak.
    if (SLOTS[i].row === 0) {
      score += 250;
      say("Peak cleared! +250");
    }
    const next: T = { ...s, tab, waste: [...s.waste, { ...c, up: true }], score, streak };
    if (tab.every((x) => x === null)) {
      const bonus = 500 + 25 * s.stock.length;
      say(`Hand cleared! +${bonus}`);
      setS(dealHand(score + bonus, s.hand + 1));
      return;
    }
    setS(next);
  };

  const drawCard = () => {
    if (phase !== "playing") return;
    if (s.stock.length === 0) return;
    const c = s.stock[s.stock.length - 1];
    setS({ ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, { ...c, up: true }], streak: 0 });
  };

  useKeys((e) => {
    if (e.key === "d" || e.key === "D" || e.key === " ") {
      drawCard();
      return true;
    }
    return false;
  }, phase === "playing");

  const offsetX = (BOARD_W - 9 * PITCH - CW) / 2;
  const wasteTop = s.waste[s.waste.length - 1];

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Play cards one higher or lower than the card on the pile to clear all three peaks. Long streaks score more."
      overTitle="No more moves"
      overDetail={`${s.score} points · ${s.hand - 1} ${s.hand === 2 ? "hand" : "hands"} cleared`}
      onStart={start}
      hud={
        <>
          <span>
            Hand <b>{s.hand}</b>
          </span>
          <span>
            Streak <b>{s.streak}</b>
          </span>
          <span>
            Cards left <b>{s.stock.length}</b>
          </span>
        </>
      }
      hint="Play a card one rank up or down · D draws"
      className="w-[388px] px-2 pt-4 pb-3"
      style={{ background: felt(game) }}
    >
      <div className="relative" style={{ height: 3 * ROW_Y + CH + 12 }}>
        {SLOTS.map((slot, i) => {
          const c = s.tab[i];
          if (!c) return null;
          const open = isOpen(s, i);
          const style = { left: offsetX + slot.x * PITCH, top: slot.row * ROW_Y };
          return open ? (
            <button
              key={c.id}
              type="button"
              aria-label={cardName(c)}
              onClick={() => play(i)}
              className={cn(
                "absolute rounded-[5px] transition-transform focus-visible:outline-2 focus-visible:outline-white",
                playable(s, i) ? "hover:-translate-y-1" : "cursor-default",
              )}
              style={style}
            >
              <CardFace card={c} w={CW} h={CH} />
            </button>
          ) : (
            <CardBack key={c.id} game={game} w={CW} h={CH} className="absolute" style={style} />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label={s.stock.length ? `Draw a card (${s.stock.length} left)` : "No cards left"}
          onClick={drawCard}
          className="relative rounded-[5px] focus-visible:outline-2 focus-visible:outline-white"
          style={{ width: 48 + Math.min(10, s.stock.length) * 3, height: 67 }}
        >
          {s.stock.length === 0 ? (
            <EmptySlot w={48} h={67} label={stuck ? "✕" : ""} />
          ) : (
            s.stock
              .slice(-10)
              .map((c, k) => (
                <CardBack
                  key={c.id}
                  game={game}
                  w={48}
                  h={67}
                  className="absolute top-0"
                  style={{ left: k * 3 }}
                />
              ))
          )}
        </button>
        {wasteTop && <CardFace card={wasteTop} w={48} h={67} />}
      </div>
      {flash && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center font-bold text-[22px] text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.5)]">
          {flash}
        </p>
      )}
    </GameFrame>
  );
}

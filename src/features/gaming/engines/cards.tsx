import type { CSSProperties } from "react";
import { cn } from "@/lib/format";
import type { Game } from "../games";
import { shuffle } from "./kit";

/** Playing cards shared by the solitaire and casino engines. */

export type Suit = "S" | "H" | "D" | "C";
export type PlayingCard = { id: number; rank: number; suit: Suit; up: boolean };

export const SUITS: Suit[] = ["S", "H", "D", "C"];
/** Text presentation selector keeps the suits from rendering as emoji. */
export const SUIT_GLYPH: Record<Suit, string> = {
  S: "♠︎",
  H: "♥︎",
  D: "♦︎",
  C: "♣︎",
};
const SUIT_NAME: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_NAME = [
  "",
  "Ace",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "Jack",
  "Queen",
  "King",
];

export const isRed = (s: Suit) => s === "H" || s === "D";
export const rankLabel = (r: number) => RANKS[r];
export const cardName = (c: PlayingCard) => `${RANK_NAME[c.rank]} of ${SUIT_NAME[c.suit]}`;

/** A shuffled deck (or shoe of `decks` decks), face down. */
export function newDeck(decks = 1): PlayingCard[] {
  const cards: PlayingCard[] = [];
  for (let d = 0; d < decks; d++)
    for (const suit of SUITS)
      for (let rank = 1; rank <= 13; rank++)
        cards.push({ id: cards.length, rank, suit, up: false });
  return shuffle(cards);
}

/** Card face: corner index, plus a large pip in the middle when there is room. */
export function CardFace({
  card,
  w,
  h,
  className,
  style,
}: {
  card: PlayingCard;
  w: number;
  h: number;
  className?: string;
  style?: CSSProperties;
}) {
  const small = w < 42;
  const face = card.rank > 10;
  return (
    <span
      className={cn(
        "relative block overflow-hidden rounded-[5px] border border-black/15 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        isRed(card.suit) ? "text-[#d0201a]" : "text-[#1c1e21]",
        className,
      )}
      style={{ width: w, height: h, ...style }}
    >
      <span
        className="absolute top-[2px] left-[3px] flex flex-col items-center font-bold leading-none"
        style={{ fontSize: small ? 12 : Math.round(w * 0.3) }}
      >
        <span className={card.rank === 10 ? "-tracking-[1.5px]" : undefined}>
          {RANKS[card.rank]}
        </span>
        <span style={{ fontSize: small ? 11 : Math.round(w * 0.26) }}>{SUIT_GLYPH[card.suit]}</span>
      </span>
      {!small && (
        <span
          className={cn(
            "absolute right-[4px] bottom-[1px] leading-none",
            face && "font-bold font-serif",
          )}
          style={{ fontSize: Math.round(w * (face ? 0.42 : 0.5)) }}
        >
          {face ? RANKS[card.rank] : SUIT_GLYPH[card.suit]}
        </span>
      )}
    </span>
  );
}

/** Card back in the game's colors. */
export function CardBack({
  game,
  w,
  h,
  className,
  style,
}: {
  game: Game;
  w: number;
  h: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "block rounded-[5px] border-[2.5px] border-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{
        width: w,
        height: h,
        background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 3px, transparent 3px 7px), linear-gradient(160deg, ${game.band}, ${game.from})`,
        ...style,
      }}
    />
  );
}

/** Dashed outline for an empty pile. */
export function EmptySlot({
  w,
  h,
  label,
  className,
}: {
  w: number;
  h: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[5px] border-2 border-white/30 font-bold text-[18px] text-white/35",
        className,
      )}
      style={{ width: w, height: h }}
    >
      {label}
    </span>
  );
}

/** Felt table background tinted with the game's colors. */
export const felt = (game: Game) =>
  `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${game.from} 85%, #fff 15%), color-mix(in srgb, ${game.from} 70%, #000 30%))`;

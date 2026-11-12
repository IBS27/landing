import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import { CardBack, CardFace, cardName, felt, newDeck, type PlayingCard } from "./cards";
import { type EngineProps, GameFrame, type Phase, useKeys, useReport } from "./kit";

/** Blackjack against the house: dealer stands on 17, blackjack pays 3:2. */

const START = 1000;
const CHIPS = [
  { v: 10, color: "#1c7ed6" },
  { v: 25, color: "#2b8a3e" },
  { v: 50, color: "#c92a2a" },
  { v: 100, color: "#212529" },
];
const CW = 56;
const CH = 78;

type Round = "betting" | "player" | "dealer" | "settled";

export function handTotal(hand: PlayingCard[]) {
  let sum = 0;
  let aces = 0;
  for (const c of hand) {
    sum += Math.min(10, c.rank);
    if (c.rank === 1) aces++;
  }
  const soft = aces > 0 && sum + 10 <= 21;
  return { total: soft ? sum + 10 : sum, soft };
}

const isBlackjack = (hand: PlayingCard[]) => hand.length === 2 && handTotal(hand).total === 21;

export default function Blackjack({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [balance, setBalance] = useState(START);
  const [bet, setBet] = useState(0);
  const [round, setRound] = useState<Round>("betting");
  const [player, setPlayer] = useState<PlayingCard[]>([]);
  const [dealer, setDealer] = useState<PlayingCard[]>([]);
  const [message, setMessage] = useState("Place your bet");
  const [hands, setHands] = useState(0);
  const shoe = useRef<PlayingCard[]>([]);
  useReport(balance, onScore);

  const drawCard = (up = true): PlayingCard => {
    if (shoe.current.length < 20) shoe.current = newDeck(4);
    const c = shoe.current.pop()!;
    return { ...c, up };
  };

  const start = () => {
    shoe.current = newDeck(4);
    setBalance(START);
    setBet(0);
    setRound("betting");
    setPlayer([]);
    setDealer([]);
    setHands(0);
    setMessage("Place your bet");
    setPhase("playing");
  };

  const settle = (p: PlayingCard[], d: PlayingCard[], stake: number) => {
    const pt = handTotal(p).total;
    const dt = handTotal(d).total;
    let back = 0;
    let msg: string;
    if (pt > 21) msg = "Bust! You lose";
    else if (isBlackjack(p) && !isBlackjack(d)) {
      back = stake * 2.5;
      msg = `Blackjack! You win $${stake * 1.5}`;
    } else if (isBlackjack(d) && !isBlackjack(p)) msg = "Dealer has blackjack";
    else if (dt > 21) {
      back = stake * 2;
      msg = `Dealer busts! You win $${stake}`;
    } else if (pt > dt) {
      back = stake * 2;
      msg = `You win $${stake}`;
    } else if (pt === dt) {
      back = stake;
      msg = "Push";
    } else msg = "Dealer wins";
    setDealer(d.map((c) => ({ ...c, up: true })));
    setBalance((b) => b + back);
    setMessage(msg);
    setHands((h) => h + 1);
    setRound("settled");
  };

  const deal = () => {
    if (round !== "betting" && round !== "settled") return;
    const stake = Math.min(bet || 25, balance);
    if (stake < CHIPS[0].v) return;
    setBet(stake);
    setBalance((b) => b - stake);
    const p = [drawCard(), drawCard()];
    const d = [drawCard(), drawCard(false)];
    setPlayer(p);
    setDealer(d);
    if (isBlackjack(p) || isBlackjack(d)) settle(p, d, stake);
    else {
      setMessage("Hit or stand?");
      setRound("player");
    }
  };

  const hit = () => {
    if (round !== "player") return;
    const p = [...player, drawCard()];
    setPlayer(p);
    if (handTotal(p).total > 21) settle(p, dealer, bet);
    else if (handTotal(p).total === 21) stand(p);
  };

  const stand = (p = player, stake = bet) => {
    setRound("dealer");
    setMessage("Dealer's turn");
    setDealer((d) => d.map((c) => ({ ...c, up: true })));
    // The dealer's draws play out one card at a time.
    let d = dealer.map((c) => ({ ...c, up: true }));
    const step = () => {
      if (handTotal(d).total < 17) {
        d = [...d, drawCard()];
        setDealer(d);
        timer.current = setTimeout(step, 550);
      } else settle(p, d, stake);
    };
    timer.current = setTimeout(step, 550);
  };

  const double = () => {
    if (round !== "player" || player.length !== 2 || balance < bet) return;
    setBalance((b) => b - bet);
    const stake = bet * 2;
    setBet(stake);
    const p = [...player, drawCard()];
    setPlayer(p);
    if (handTotal(p).total > 21) settle(p, dealer, stake);
    else stand(p, stake);
  };

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const betting = round === "betting" || round === "settled";
  const broke = betting && balance < CHIPS[0].v;
  useEffect(() => {
    if (phase === "playing" && broke) {
      const t = setTimeout(() => setPhase("over"), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, broke]);

  const addChip = (v: number) => {
    if (!betting) return;
    const base = round === "settled" ? 0 : bet;
    if (round === "settled") {
      setRound("betting");
      setPlayer([]);
      setDealer([]);
      setMessage("Place your bet");
    }
    setBet(Math.min(balance, base + v));
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (round === "player") {
      if (k === "h") hit();
      else if (k === "s") stand();
      else if (k === "d") double();
      else return false;
      return true;
    }
    if (betting) {
      const n = Number(k);
      if (n >= 1 && n <= 4) addChip(CHIPS[n - 1].v);
      else if (k === "enter" || k === " ") deal();
      else if (k === "backspace") setBet(0);
      else return false;
      return true;
    }
    return false;
  }, phase === "playing");

  const hand = (cards: PlayingCard[], label: string, showTotal: boolean) => (
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-full bg-black/35 px-2.5 py-0.5 font-semibold text-[13px] text-white">
        {label}
        {showTotal && cards.length > 0 && ` · ${handTotal(cards.filter((c) => c.up)).total}`}
      </span>
      <div className="relative flex h-[78px] justify-center" style={{ width: CW + 30 * 5 }}>
        <div className="flex">
          {cards.map((c, i) => (
            <span
              key={`${c.id}-${i}`}
              role="img"
              aria-label={c.up ? cardName(c) : "Face-down card"}
              className="animate-[bj-deal_.25s_ease-out]"
              style={{ marginLeft: i ? -26 : 0 }}
            >
              {c.up ? <CardFace card={c} w={CW} h={CH} /> : <CardBack game={game} w={CW} h={CH} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Get closer to 21 than the dealer without going over. Blackjack pays 3 to 2."
      overTitle="Out of chips"
      overDetail={`You played ${hands} hands`}
      onStart={start}
      hud={
        <>
          <span>
            Chips <b>${balance}</b>
          </span>
          <span>
            Bet <b>${bet}</b>
          </span>
          <span>
            Hands <b>{hands}</b>
          </span>
        </>
      }
      hint="H hit · S stand · D double · Enter deal"
      className="flex h-[400px] w-[388px] flex-col items-center justify-between py-3"
      style={{ background: felt(game) }}
    >
      <style>{"@keyframes bj-deal{from{transform:translateY(-24px);opacity:0}}"}</style>
      {hand(dealer, "Dealer", true)}
      <p
        className={cn(
          "font-bold text-[17px] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]",
          round === "settled" && "text-[20px] text-[#ffe066]",
        )}
      >
        {message}
      </p>
      {hand(player, "You", true)}
      <div className="flex h-10 items-center gap-2">
        {betting ? (
          <>
            {CHIPS.map((c) => (
              <button
                key={c.v}
                type="button"
                aria-label={`Add $${c.v}`}
                disabled={balance < c.v}
                onClick={() => addChip(c.v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white border-dashed font-bold text-[13px] text-white shadow-[0_2px_4px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
                style={{ background: c.color }}
              >
                {c.v}
              </button>
            ))}
            <Button variant="primary" className="ml-2" onClick={deal} disabled={balance < 10}>
              {round === "settled" ? "Deal again" : "Deal"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={hit} disabled={round !== "player"}>
              Hit
            </Button>
            <Button variant="secondary" onClick={() => stand()} disabled={round !== "player"}>
              Stand
            </Button>
            <Button
              variant="secondary"
              onClick={double}
              disabled={round !== "player" || player.length !== 2 || balance < bet}
            >
              Double
            </Button>
          </>
        )}
      </div>
    </GameFrame>
  );
}

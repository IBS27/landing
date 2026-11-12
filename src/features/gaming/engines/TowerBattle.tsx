import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Button } from "@/ui/primitives";
import { type EngineProps, GameFrame, type Phase, useFrame, useKeys, useReport } from "./kit";

/**
 * Tower Legends: climb the tower one floor at a time, fighting the monster on
 * each. Attacks are timed — stop the swing in the gold zone for a critical
 * hit — and every fifth floor holds a boss.
 */

const HERO_MAX = 100;
const FOES = [
  { name: "Goblin", e: "👺" },
  { name: "Dire wolf", e: "🐺" },
  { name: "Skeleton", e: "💀" },
  { name: "Troll", e: "🧌" },
  { name: "Wraith", e: "👻" },
  { name: "Ogre", e: "👹" },
];
const BOSS = { name: "Ember dragon", e: "🐉" };

type Foe = { name: string; e: string; hp: number; max: number; atk: number; boss: boolean };
type Turn = "choose" | "timing" | "enemy" | "between";

function foeFor(floor: number): Foe {
  const boss = floor % 5 === 0;
  const base = boss ? BOSS : FOES[(floor - 1) % FOES.length];
  const max = Math.round((boss ? 90 : 40) * 1.16 ** (floor - 1));
  return { ...base, hp: max, max, atk: Math.round((boss ? 13 : 8) * 1.1 ** (floor - 1)), boss };
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="block h-3 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/20">
      <span
        className="block h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }}
      />
    </span>
  );
}

export default function TowerBattle({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [floor, setFloor] = useState(1);
  const [hp, setHp] = useState(HERO_MAX);
  const [potions, setPotions] = useState(3);
  const [shield, setShield] = useState(false);
  const [foe, setFoe] = useState<Foe>(() => foeFor(1));
  const [turn, setTurn] = useState<Turn>("choose");
  const [log, setLog] = useState("Choose your move");
  const [score, setScore] = useState(0);
  const [hitFx, setHitFx] = useState<"hero" | "foe" | null>(null);
  const [marker, setMarker] = useState(0);
  const swing = useRef({ t: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useReport(score, onScore);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const flash = (who: "hero" | "foe") => {
    setHitFx(who);
    later(() => setHitFx(null), 350);
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    setFloor(1);
    setHp(HERO_MAX);
    setPotions(3);
    setShield(false);
    setFoe(foeFor(1));
    setTurn("choose");
    setLog("Choose your move");
    setScore(0);
    setPhase("playing");
  };

  const enemyTurn = (f: Foe, guarded: boolean, heroHp: number) => {
    setTurn("enemy");
    later(() => {
      const raw = Math.round(f.atk * (0.8 + Math.random() * 0.45));
      const dmg = guarded ? Math.round(raw * 0.3) : raw;
      const left = heroHp - dmg;
      flash("hero");
      setHp(Math.max(0, left));
      setShield(false);
      setLog(
        guarded ? `You block! ${f.name} hits for only ${dmg}` : `${f.name} hits you for ${dmg}`,
      );
      if (left <= 0) {
        later(() => setPhase("over"), 700);
        return;
      }
      later(() => {
        setTurn("choose");
        setLog("Choose your move");
      }, 650);
    }, 750);
  };

  const damageFoe = (dmg: number, text: string, guarded: boolean) => {
    const left = foe.hp - dmg;
    flash("foe");
    setLog(text);
    if (left <= 0) {
      setFoe({ ...foe, hp: 0 });
      setTurn("between");
      setScore((s) => s + floor * 100 + (foe.boss ? 500 : 0));
      later(() => {
        const next = floor + 1;
        setFloor(next);
        setFoe(foeFor(next));
        setHp((h) => Math.min(HERO_MAX, h + 18));
        if (next % 3 === 0) setPotions((p) => p + 1);
        setLog(next % 5 === 0 ? "A boss blocks the stairs!" : `Floor ${next}`);
        setTurn("choose");
      }, 1100);
      setLog(`${foe.name} defeated! +${floor * 100 + (foe.boss ? 500 : 0)}`);
      return;
    }
    setFoe({ ...foe, hp: left });
    enemyTurn(foe, guarded, hp);
  };

  const attack = () => {
    if (turn !== "choose") return;
    swing.current.t = 0;
    setTurn("timing");
    setLog("Stop the swing in the gold zone!");
  };

  const strike = () => {
    if (turn !== "timing") return;
    const acc = 1 - Math.abs(marker - 0.5) * 2;
    const base = 12 + floor * 1.5;
    const crit = acc > 0.88;
    const dmg = Math.round(base * (0.45 + acc) * (crit ? 1.8 : 1));
    damageFoe(dmg, crit ? `Critical hit! ${dmg} damage` : `You hit for ${dmg}`, false);
  };

  const defend = () => {
    if (turn !== "choose") return;
    setShield(true);
    damageFoe(4, "You raise your shield and bash for 4", true);
  };

  const potion = () => {
    if (turn !== "choose" || potions === 0) return;
    setPotions((p) => p - 1);
    const healed = Math.min(HERO_MAX, hp + 40);
    setHp(healed);
    setLog(`You drink a potion (+${healed - hp})`);
    enemyTurn(foe, false, healed);
  };

  // The swing marker sweeps back and forth, faster on higher floors.
  useFrame(
    (dt) => {
      swing.current.t += dt * (1.1 + floor * 0.06);
      const t = swing.current.t % 2;
      setMarker(t < 1 ? t : 2 - t);
    },
    phase === "playing" && turn === "timing",
  );

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (turn === "timing" && (k === " " || k === "enter" || k === "a" || k === "1")) {
      strike();
      return true;
    }
    if (k === "a" || k === "1") attack();
    else if (k === "d" || k === "2") defend();
    else if (k === "p" || k === "3") potion();
    else return false;
    return true;
  }, phase === "playing");

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Climb the tower floor by floor. Time your attacks for critical hits, block when you need to, and save your potions for the bosses."
      overTitle={`Fallen on floor ${floor}`}
      overDetail={`${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Floor <b>{floor}</b>
          </span>
          <span>
            🧪 <b>{potions}</b>
          </span>
        </>
      }
      hint="A attack · D defend · P potion · Space strikes"
      className="flex h-[410px] w-[388px] flex-col justify-between p-4"
      style={{
        background: `radial-gradient(120% 70% at 50% 15%, ${foe.boss ? "#7a2b12" : game.from}, #12172a)`,
      }}
    >
      <style>
        {
          "@keyframes tb-hit{0%,100%{transform:none;filter:none}30%{transform:translateX(-8px);filter:brightness(2) saturate(0)}60%{transform:translateX(8px)}}"
        }
      </style>
      <div className="flex flex-col items-center gap-2 text-white">
        <span
          className={cn(
            "text-[72px] leading-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]",
            foe.boss && "text-[88px]",
            hitFx === "foe" && "animate-[tb-hit_.35s]",
            foe.hp === 0 && "opacity-20 grayscale transition-opacity duration-700",
          )}
        >
          {foe.e}
        </span>
        <span className="font-bold text-[15px]">
          {foe.name}
          {foe.boss && (
            <span className="ml-1.5 rounded bg-[#f03e3e] px-1.5 py-0.5 text-[11px] uppercase">
              Boss
            </span>
          )}
        </span>
        <span className="flex w-[220px] items-center gap-2 text-[12px] text-white/80">
          <Bar value={foe.hp} max={foe.max} color="linear-gradient(90deg,#fa5252,#ff8787)" />
          <span className="w-14 shrink-0 text-right tabular-nums">
            {foe.hp}/{foe.max}
          </span>
        </span>
      </div>

      <p className="text-center font-bold text-[16px] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
        {log}
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-white">
          <span
            className={cn(
              "relative text-[44px] leading-none",
              hitFx === "hero" && "animate-[tb-hit_.35s]",
            )}
          >
            🤺{shield && <span className="absolute -right-2 -bottom-1 text-[22px]">🛡️</span>}
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-semibold text-[13px]">You</span>
            <span className="flex items-center gap-2 text-[12px] text-white/80">
              <Bar value={hp} max={HERO_MAX} color="linear-gradient(90deg,#37b24d,#8ce99a)" />
              <span className="w-14 shrink-0 text-right tabular-nums">
                {hp}/{HERO_MAX}
              </span>
            </span>
          </span>
        </div>
        {turn === "timing" ? (
          <div className="flex items-center gap-2">
            <span className="relative h-9 flex-1 overflow-hidden rounded-md bg-black/45 ring-1 ring-white/25">
              <span className="absolute inset-y-0 left-[30%] w-[40%] bg-white/10" />
              <span className="absolute inset-y-0 left-[44%] w-[12%] bg-[#fcc419]/70" />
              <span
                className="absolute inset-y-0 w-[3px] rounded bg-white shadow-[0_0_6px_#fff]"
                style={{ left: `calc(${marker * 100}% - 1.5px)` }}
              />
            </span>
            <Button variant="primary" onClick={strike}>
              Strike!
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" onClick={attack} disabled={turn !== "choose"}>
              ⚔️ Attack
            </Button>
            <Button variant="secondary" onClick={defend} disabled={turn !== "choose"}>
              🛡️ Defend
            </Button>
            <Button
              variant="secondary"
              onClick={potion}
              disabled={turn !== "choose" || potions === 0}
            >
              🧪 Potion
            </Button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}

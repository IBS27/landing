import { Delete } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { type EngineProps, GameFrame, type Phase, pick, useKeys, useReport } from "./kit";
import { ANSWERS, VALID } from "./words";

/**
 * Word Garden: guess the hidden five-letter word in six tries. Green letters
 * are in the right spot, yellow ones are in the word elsewhere. Solve words in
 * a row to grow your garden; one miss ends the run.
 */

const LEN = 5;
const TRIES = 6;
type Mark = "hit" | "near" | "miss";
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const COLOR: Record<Mark, string> = { hit: "#2f9e44", near: "#e8a400", miss: "#868e96" };

/** Wordle marking, handling repeated letters. */
function mark(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(LEN).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) out[i] = "hit";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (out[i] === "hit") continue;
    if (left[guess[i]]) {
      out[i] = "near";
      left[guess[i]]--;
    }
  }
  return out;
}

export default function Word({ game, onScore }: EngineProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [answer, setAnswer] = useState(() => pick(ANSWERS));
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirrors of the round state, so several keys in one tick all see the latest.
  const live = useRef({ current: "", guesses: [] as string[], done: false });
  const setCur = (v: string) => {
    live.current.current = v;
    setCurrent(v);
  };
  const setG = (v: string[]) => {
    live.current.guesses = v;
    setGuesses(v);
  };
  const setD = (v: boolean) => {
    live.current.done = v;
  };
  useReport(score, onScore);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const say = (t: string, ms = 1300) => {
    setToast(t);
    later(() => setToast(null), ms);
  };

  const nextWord = () => {
    setAnswer(pick(ANSWERS));
    setG([]);
    setCur("");
    setD(false);
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    nextWord();
    setScore(0);
    setSolved(0);
    setToast(null);
    setPhase("playing");
  };

  const submit = () => {
    const { current, guesses, done } = live.current;
    if (done) return;
    if (current.length < LEN) {
      setShake(true);
      later(() => setShake(false), 400);
      say("Not enough letters");
      return;
    }
    if (!VALID.has(current)) {
      setShake(true);
      later(() => setShake(false), 400);
      say("Not in word list");
      return;
    }
    const all = [...guesses, current];
    setG(all);
    setCur("");
    if (current === answer) {
      setD(true);
      const pts = (TRIES + 1 - all.length) * 100 + solved * 25;
      later(
        () => {
          setScore((s) => s + pts);
          setSolved((n) => n + 1);
          say(
            ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"][
              all.length - 1
            ],
          );
        },
        LEN * 120 + 200,
      );
      later(nextWord, LEN * 120 + 1700);
    } else if (all.length === TRIES) {
      setD(true);
      later(() => say(answer.toUpperCase(), 1800), LEN * 120 + 200);
      later(() => setPhase("over"), LEN * 120 + 1900);
    }
  };

  const type = (k: string) => {
    const c = live.current.current;
    if (phase !== "playing" || live.current.done) return;
    if (k === "enter") submit();
    else if (k === "back") setCur(c.slice(0, -1));
    else if (/^[a-z]$/.test(k) && c.length < LEN) setCur(c + k);
  };

  useKeys((e) => {
    if (e.key === "Enter") type("enter");
    else if (e.key === "Backspace") type("back");
    else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
    else return false;
    return true;
  }, phase === "playing");

  // Best mark seen per letter, for the keyboard.
  const keys: Record<string, Mark> = {};
  for (const g of guesses) {
    mark(g, answer).forEach((m, i) => {
      const prev = keys[g[i]];
      if (prev === "hit" || (prev === "near" && m === "miss")) return;
      keys[g[i]] = m;
    });
  }

  return (
    <GameFrame
      game={game}
      phase={phase}
      howTo="Guess the five-letter word in six tries. Green means right spot, yellow means it's in the word."
      overTitle={`The word was ${answer.toUpperCase()}`}
      overDetail={`You solved ${solved} ${solved === 1 ? "word" : "words"} · ${score} points`}
      onStart={start}
      hud={
        <>
          <span>
            Words solved <b>{solved}</b>
          </span>
          <span aria-hidden>{"🌻".repeat(Math.min(8, solved)) || "🌱"}</span>
        </>
      }
      hint="Type a word and press Enter"
      className="flex w-[388px] flex-col items-center gap-3 px-3 py-3"
      style={{ background: "linear-gradient(170deg, #fff9db, #ffe8a3)" }}
    >
      <style>
        {
          "@keyframes wg-flip{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}@keyframes wg-shake{0%,100%{transform:none}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}@keyframes wg-pop{50%{transform:scale(1.12)}}"
        }
      </style>
      <div className="grid gap-[5px]">
        {Array.from({ length: TRIES }, (_, r) => {
          const g = guesses[r];
          const isCur = r === guesses.length;
          const word = g ?? (isCur ? current : "");
          const marks = g ? mark(g, answer) : null;
          return (
            <div
              key={r}
              className={cn("flex gap-[5px]", isCur && shake && "animate-[wg-shake_.4s]")}
            >
              {Array.from({ length: LEN }, (_, c) => {
                const ch = word[c] ?? "";
                const m = marks?.[c];
                return (
                  <span
                    key={`${r}-${c}-${g ? "done" : ch}`}
                    className={cn(
                      "flex h-[48px] w-[48px] items-center justify-center rounded-md border-2 font-bold text-[26px] uppercase",
                      m
                        ? "border-transparent text-white"
                        : ch
                          ? "border-[#8a6d1f] bg-white text-[#3d3214]"
                          : "border-[#e2c76b] bg-white/60",
                      ch && !m && "animate-[wg-pop_.1s]",
                    )}
                    style={
                      m
                        ? {
                            background: COLOR[m],
                            animation: `wg-flip .45s ease ${c * 120}ms both`,
                          }
                        : undefined
                    }
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex w-full flex-col items-center gap-[6px]">
        {ROWS.map((row, i) => (
          <div key={row} className="flex gap-[5px]">
            {i === 2 && (
              <Key label="Enter" wide onPress={() => type("enter")}>
                Enter
              </Key>
            )}
            {[...row].map((k) => (
              <Key key={k} label={k} mark={keys[k]} onPress={() => type(k)}>
                {k}
              </Key>
            ))}
            {i === 2 && (
              <Key label="Delete" wide onPress={() => type("back")}>
                <Delete size={18} />
              </Key>
            )}
          </div>
        ))}
      </div>
      {toast && (
        <p className="pointer-events-none absolute inset-x-0 top-[22%] z-20 text-center">
          <span className="rounded-md bg-[#1c1e21] px-3 py-2 font-bold text-[15px] text-white shadow-lg">
            {toast}
          </span>
        </p>
      )}
    </GameFrame>
  );
}

function Key({
  label,
  mark: m,
  wide,
  onPress,
  children,
}: {
  label: string;
  mark?: Mark;
  wide?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={cn(
        "flex h-10 items-center justify-center rounded-md font-bold uppercase transition-colors active:scale-95",
        wide ? "w-[52px] text-[11px]" : "w-[30px] text-[15px]",
        !m && "bg-[#f1e3b0] text-[#3d3214] hover:bg-[#ead48a]",
        m && "text-white",
      )}
      style={m ? { background: COLOR[m] } : undefined}
    >
      {children}
    </button>
  );
}

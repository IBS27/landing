import { Bike, Check, Lightbulb, Recycle, Salad, ThermometerSun, Waves, Wind } from "lucide-react";
import { useState } from "react";
import { BmClimate } from "@/icons";
import { cn } from "@/lib/format";
import { Button, Card } from "@/ui/primitives";

const FACTS = [
  {
    Icon: ThermometerSun,
    title: "The planet is warming",
    body: "Global average temperatures have risen about 1.2°C since the late 1800s, and each of the last several decades has been warmer than the one before.",
  },
  {
    Icon: Waves,
    title: "Seas are rising",
    body: "Melting glaciers and ice sheets, and warmer water expanding, have raised the global sea level by more than 20 centimeters since 1900.",
  },
  {
    Icon: Wind,
    title: "Greenhouse gases trap heat",
    body: "Burning coal, oil and gas releases carbon dioxide, which keeps heat in the atmosphere like a blanket around the planet.",
  },
];

const ACTIONS = [
  {
    Icon: Bike,
    title: "Choose low-carbon travel",
    body: "Walk, bike, take transit or share rides for short trips.",
  },
  {
    Icon: Lightbulb,
    title: "Save energy at home",
    body: "Switch to LED bulbs and unplug devices you're not using.",
  },
  {
    Icon: Salad,
    title: "Eat more plants",
    body: "Plant-rich meals generally have a smaller climate footprint.",
  },
  {
    Icon: Recycle,
    title: "Reduce and reuse",
    body: "Buy less, repair what you have, and recycle what you can.",
  },
];

const QUIZ = {
  q: "Which gas is the largest contributor to human-caused climate change?",
  options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"],
  answer: 1,
};

/** /climate — Climate Science Center landing. */
export function ClimatePage() {
  const [following, setFollowing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  return (
    <main className="flex justify-center px-4 pt-4 pb-10">
      <div className="flex w-full max-w-[880px] flex-col gap-4">
        <Card className="overflow-hidden rounded-xl">
          <div className="relative h-[260px] bg-[linear-gradient(135deg,#0b6e4f,#2aba6b_45%,#7fd3f7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
          </div>
          <div className="flex items-end gap-4 px-6 pb-5">
            <span className="relative -mt-12 rounded-full bg-card p-1">
              <BmClimate size={96} />
            </span>
            <div className="min-w-0 flex-1 pt-3">
              <h1 className="font-bold text-[32px] text-primary leading-[38px]">
                Climate Science Center
              </h1>
              <p className="text-[15px] text-secondary">
                Learn about climate change and its effects, and find ways to take action.
              </p>
            </div>
            <Button
              variant={following ? "secondary" : "primary"}
              icon={following ? <Check size={16} strokeWidth={3} /> : undefined}
              onClick={() => setFollowing((f) => !f)}
            >
              {following ? "Following" : "Follow"}
            </Button>
          </div>
        </Card>

        <Card className="rounded-xl p-4">
          <h2 className="pb-3 font-bold text-[20px] text-primary">Facts about climate change</h2>
          <div className="grid grid-cols-3 gap-3">
            {FACTS.map((f) => (
              <div key={f.title} className="rounded-lg bg-wash p-4">
                <f.Icon size={28} className="text-[#2aba6b]" />
                <p className="mt-3 font-semibold text-[17px] text-primary leading-5">{f.title}</p>
                <p className="mt-1 text-[15px] text-secondary leading-5">{f.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-xl p-4">
          <h2 className="font-bold text-[20px] text-primary">Test your knowledge</h2>
          <p className="pt-1 pb-3 text-[15px] text-primary">{QUIZ.q}</p>
          <div className="grid grid-cols-2 gap-2">
            {QUIZ.options.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => setPicked(i)}
                disabled={picked !== null}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left font-medium text-[15px] transition-colors",
                  picked === null && "border-divider text-primary hover:bg-hover",
                  picked !== null &&
                    i === QUIZ.answer &&
                    "border-positive bg-positive/10 text-positive",
                  picked !== null &&
                    picked === i &&
                    i !== QUIZ.answer &&
                    "border-negative bg-negative/10 text-negative",
                  picked !== null &&
                    picked !== i &&
                    i !== QUIZ.answer &&
                    "border-divider text-secondary",
                )}
              >
                {o}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[15px] text-primary">
                {picked === QUIZ.answer
                  ? "Correct! Carbon dioxide from burning fossil fuels is the biggest driver."
                  : "Not quite. Carbon dioxide from burning fossil fuels is the biggest driver."}
              </p>
              <Button variant="secondary" onClick={() => setPicked(null)}>
                Try again
              </Button>
            </div>
          )}
        </Card>

        <Card className="rounded-xl p-4">
          <h2 className="pb-1 font-bold text-[20px] text-primary">What you can do</h2>
          <p className="pb-3 text-[15px] text-secondary">
            Small changes add up. Mark the ones you're already doing.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => {
              const on = done.has(a.title);
              return (
                <button
                  key={a.title}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDone((d) => {
                      const n = new Set(d);
                      if (on) n.delete(a.title);
                      else n.add(a.title);
                      return n;
                    })
                  }
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3 text-left transition-colors",
                    on
                      ? "bg-highlight"
                      : "bg-wash hover:brightness-[0.97] dark:hover:brightness-125",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      on ? "bg-fb text-white" : "bg-card text-icon",
                    )}
                  >
                    {on ? <Check size={18} strokeWidth={3} /> : <a.Icon size={18} />}
                  </span>
                  <span>
                    <span className="block font-semibold text-[15px] text-primary">{a.title}</span>
                    <span className="block text-[13px] text-secondary">{a.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </main>
  );
}

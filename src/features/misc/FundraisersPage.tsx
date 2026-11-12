import { Compass, HandCoins, Heart, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card, EmptyState } from "@/ui/primitives";
import { AppRail, AppRailDivider, AppRailItem } from "./AppRail";

type Fundraiser = {
  id: string;
  title: string;
  org: string;
  category: string;
  raised: number;
  goal: number;
  donors: number;
  from: string;
  to: string;
  emoji: string;
};

/** Fictional local fundraisers (cover art is generated). */
const FUNDRAISERS: Fundraiser[] = [
  {
    id: "food-bank",
    title: "Stock the shelves for the winter",
    org: "Lake City Community Pantry",
    category: "Hunger",
    raised: 18420,
    goal: 25000,
    donors: 312,
    from: "#f08c00",
    to: "#ffd43b",
    emoji: "🥫",
  },
  {
    id: "dog-rescue",
    title: "Medical care for senior rescue dogs",
    org: "Puget Paws Rescue",
    category: "Animals",
    raised: 9150,
    goal: 12000,
    donors: 198,
    from: "#5c7cfa",
    to: "#a5d8ff",
    emoji: "🐕",
  },
  {
    id: "trails",
    title: "Rebuild the washed-out ridge trail",
    org: "Cascade Trail Keepers",
    category: "Environment",
    raised: 6300,
    goal: 15000,
    donors: 87,
    from: "#2b8a3e",
    to: "#b2f2bb",
    emoji: "🌲",
  },
  {
    id: "library",
    title: "Books for every kid in the U District",
    org: "Little Free Library Seattle",
    category: "Education",
    raised: 4210,
    goal: 5000,
    donors: 141,
    from: "#c2255c",
    to: "#fcc2d7",
    emoji: "📚",
  },
  {
    id: "shelter",
    title: "Warm beds this winter",
    org: "Northgate Shelter Network",
    category: "Housing",
    raised: 31200,
    goal: 40000,
    donors: 506,
    from: "#364fc7",
    to: "#91a7ff",
    emoji: "🛏️",
  },
  {
    id: "music",
    title: "Instruments for the youth orchestra",
    org: "Rainier Youth Strings",
    category: "Arts",
    raised: 2780,
    goal: 8000,
    donors: 54,
    from: "#862e9c",
    to: "#e599f7",
    emoji: "🎻",
  },
];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** /fundraisers — explore fundraisers and donate. Donations are kept for this visit. */
export function FundraisersPage() {
  const [view, setView] = useState<"explore" | "yours" | "donations">("explore");
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [donating, setDonating] = useState<Fundraiser | null>(null);
  const donated = Object.entries(extra);

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <AppRail title="Fundraisers" label="Fundraisers">
        <div className="px-2 pt-1 pb-2">
          <Button
            variant="primary"
            block
            icon={<Plus size={18} strokeWidth={2.6} />}
            onClick={() => setView("yours")}
          >
            Raise money
          </Button>
        </div>
        <AppRailDivider />
        <AppRailItem
          icon={<Compass size={20} />}
          label="Explore"
          selected={view === "explore"}
          onClick={() => setView("explore")}
        />
        <AppRailItem
          icon={<HandCoins size={20} />}
          label="Your fundraisers"
          selected={view === "yours"}
          onClick={() => setView("yours")}
        />
        <AppRailItem
          icon={<Heart size={20} />}
          label="Your donations"
          selected={view === "donations"}
          onClick={() => setView("donations")}
        />
      </AppRail>

      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-[900px]">
          {view === "explore" && (
            <>
              <h1 className="pb-3 font-bold text-[24px] text-primary leading-7">
                Fundraisers near Seattle
              </h1>
              <div className="grid grid-cols-2 gap-3 min-[1200px]:grid-cols-3">
                {FUNDRAISERS.map((f) => {
                  const raised = f.raised + (extra[f.id] ?? 0);
                  const pct = Math.min(100, Math.round((raised / f.goal) * 100));
                  return (
                    <Card key={f.id} className="flex flex-col overflow-hidden rounded-xl">
                      <div
                        className="flex h-[150px] items-center justify-center text-[64px]"
                        style={{ background: `linear-gradient(135deg, ${f.from}, ${f.to})` }}
                        aria-hidden
                      >
                        {f.emoji}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="text-[13px] text-secondary">{f.category}</p>
                        <p className="font-semibold text-[17px] text-primary leading-5">
                          {f.title}
                        </p>
                        <p className="mt-0.5 text-[13px] text-secondary">by {f.org}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-btn">
                          <div className="h-full rounded-full bg-fb" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1.5 text-[13px] text-primary">
                          <span className="font-semibold">{money(raised)}</span> raised of{" "}
                          {money(f.goal)}
                        </p>
                        <p className="text-[13px] text-secondary">
                          {(f.donors + (extra[f.id] ? 1 : 0)).toLocaleString("en-US")} people
                          donated
                        </p>
                        <div className="mt-auto pt-3">
                          <Button variant="soft" block onClick={() => setDonating(f)}>
                            Donate
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
          {view === "yours" && (
            <Card className="rounded-xl">
              <EmptyState
                icon={<HandCoins size={48} strokeWidth={1.5} />}
                title="Raise money for a cause you care about"
                body="Create a fundraiser for a nonprofit or a personal cause and share it with friends."
              />
            </Card>
          )}
          {view === "donations" &&
            (donated.length === 0 ? (
              <Card className="rounded-xl">
                <EmptyState
                  icon={<Heart size={48} strokeWidth={1.5} />}
                  title="No donations yet"
                  body="Fundraisers you donate to will appear here."
                />
              </Card>
            ) : (
              <Card className="rounded-xl p-2">
                {donated.map(([id, amount]) => {
                  const f = FUNDRAISERS.find((x) => x.id === id);
                  if (!f) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-lg p-2">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-lg text-[24px]"
                        style={{ background: `linear-gradient(135deg, ${f.from}, ${f.to})` }}
                      >
                        {f.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[15px] text-primary">{f.title}</p>
                        <p className="text-[13px] text-secondary">{f.org}</p>
                      </div>
                      <p className="font-semibold text-[15px] text-primary">{money(amount)}</p>
                    </div>
                  );
                })}
              </Card>
            ))}
        </div>
      </main>
      {donating && (
        <DonateDialog
          fundraiser={donating}
          onClose={() => setDonating(null)}
          onDonate={(amount) => {
            setExtra((e) => ({ ...e, [donating.id]: (e[donating.id] ?? 0) + amount }));
          }}
        />
      )}
    </div>
  );
}

function DonateDialog({
  fundraiser,
  onClose,
  onDonate,
}: {
  fundraiser: Fundraiser;
  onClose: () => void;
  onDonate: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(25);
  const [thanks, setThanks] = useState(false);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Donate" width={460}>
      {thanks ? (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <Heart size={48} className="text-[#f3425f]" fill="currentColor" />
          <p className="mt-3 font-bold text-[20px] text-primary">Thanks for your donation!</p>
          <p className="mt-1 text-[15px] text-secondary">
            You gave {money(amount)} to {fundraiser.org}.
          </p>
          <Button variant="primary" className="mt-5" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <p className="font-semibold text-[17px] text-primary">{fundraiser.title}</p>
          <p className="text-[13px] text-secondary">{fundraiser.org}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[10, 25, 50, 100].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={cn(
                  "h-11 rounded-lg border font-semibold text-[15px]",
                  amount === a
                    ? "border-fb bg-highlight text-fb"
                    : "border-divider text-primary hover:bg-hover",
                )}
              >
                {money(a)}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            block
            className="mt-4"
            onClick={() => {
              onDonate(amount);
              setThanks(true);
            }}
          >
            Donate {money(amount)}
          </Button>
          <p className="mt-2 text-center text-[12px] text-secondary">
            This is a demo: no payment is collected.
          </p>
        </div>
      )}
    </Modal>
  );
}

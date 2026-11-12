import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Trophy,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useViewer } from "@/app/viewer";
import {
  AppRail,
  AppRailDivider,
  AppRailHeading,
  AppRailItem,
  RailGear,
  RailSearch,
} from "@/features/misc/AppRail";
import { BellFilled, BookmarkFilled, ControllerFilled } from "@/features/misc/icons";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card, EmptyState } from "@/ui/primitives";
import { byId, CATEGORIES, FEATURED, GAMES, type Game, playersLabel, TOP_PICKS } from "./games";
import { MiniGame } from "./MiniGames";

type View =
  | { kind: "play" }
  | { kind: "notifications" }
  | { kind: "yours" }
  | { kind: "category"; name: string };

/** Per-viewer "Your games" shortcuts and best scores (a browser convenience). */
function useLocalJSON<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable: keep the value for this session only.
      }
    },
    [key],
  );
  return [value, set] as const;
}

/** /gaming and /gaming/play — Facebook's Games home. */
export function GamingPage() {
  const viewer = useViewer();
  const [view, setView] = useState<View>({ kind: "play" });
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Game | null>(null);
  const [saved, setSaved] = useLocalJSON<string[]>(`fb-clone:games:${viewer._id}`, []);
  const [best, setBest] = useLocalJSON<Record<string, number>>(
    `fb-clone:game-best:${viewer._id}`,
    {},
  );
  const savedGames = saved.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  const toggleSave = (id: string) =>
    setSaved(saved.includes(id) ? saved.filter((x) => x !== id) : [id, ...saved]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return GAMES.filter(
      (x) => x.name.toLowerCase().includes(needle) || x.category.toLowerCase().includes(needle),
    );
  }, [q]);

  const isCat = (name: string) => view.kind === "category" && view.name === name;

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <AppRail title="Games" label="Games" action={<RailGear label="Edit notification settings" />}>
        <RailSearch value={q} onChange={setQ} placeholder="Search games" />
        <AppRailItem
          large
          icon={<ControllerFilled />}
          label="Play games"
          selected={view.kind === "play" && !results}
          onClick={() => {
            setQ("");
            setView({ kind: "play" });
          }}
        />
        <AppRailItem large icon={<MonitorPlay size={20} />} label="Gaming video" to="/watch" />
        <AppRailItem
          large
          icon={<BellFilled />}
          label="Notifications"
          selected={view.kind === "notifications" && !results}
          onClick={() => {
            setQ("");
            setView({ kind: "notifications" });
          }}
        />
        <AppRailDivider />
        <AppRailHeading
          action={
            <button
              type="button"
              onClick={() => setView({ kind: "yours" })}
              className="rounded-md px-1 text-[15px] text-link hover:underline"
            >
              See all
            </button>
          }
        >
          Your games
        </AppRailHeading>
        {savedGames.length === 0 && (
          <p className="px-2 pb-2 text-[13px] text-secondary leading-5">
            Save a game to your games to create a shortcut for it here.
          </p>
        )}
        {savedGames.slice(0, 5).map((x) => (
          <AppRailItem
            key={x.id}
            large
            bare
            icon={<GameIcon game={x} size={36} />}
            label={x.name}
            onClick={() => setPlaying(x)}
          />
        ))}
        <AppRailItem
          large
          icon={<BookmarkFilled />}
          label="Save games"
          selected={view.kind === "yours" && !results}
          onClick={() => setView({ kind: "yours" })}
        />
        <AppRailDivider />
        <AppRailHeading>Categories</AppRailHeading>
        {CATEGORIES.map((c) => (
          <AppRailItem
            key={c}
            large
            icon={<CategoryGlyph name={c} />}
            label={c}
            selected={isCat(c) && !results}
            onClick={() => {
              setQ("");
              setView({ kind: "category", name: c });
            }}
          />
        ))}
      </AppRail>

      <main className="min-w-0 flex-1 px-[27px] pt-[11px] pb-10">
        {results ? (
          <Section title={`Results for "${q.trim()}"`}>
            {results.length === 0 ? (
              <EmptyCard title="No games found" body="Check the spelling or try another search." />
            ) : (
              <TileGrid games={results} onPlay={setPlaying} />
            )}
          </Section>
        ) : view.kind === "play" ? (
          <PlayHome onPlay={setPlaying} best={best} />
        ) : view.kind === "notifications" ? (
          <Section title="Notifications">
            <EmptyCard
              title="No notifications"
              body="When games you play send you updates, you'll see them here."
            />
          </Section>
        ) : view.kind === "yours" ? (
          <Section title="Your games">
            {savedGames.length === 0 ? (
              <EmptyCard
                title="No saved games"
                body="Open a game and select Save to add it to your games."
              />
            ) : (
              <TileGrid games={savedGames} onPlay={setPlaying} />
            )}
          </Section>
        ) : (
          <Section title={view.name}>
            <TileGrid
              games={
                view.name === "All games" ? GAMES : GAMES.filter((x) => x.category === view.name)
              }
              onPlay={setPlaying}
            />
          </Section>
        )}
      </main>

      {playing && (
        <GameModal
          game={playing}
          saved={saved.includes(playing.id)}
          best={best[playing.id] ?? 0}
          onSave={() => toggleSave(playing.id)}
          onScore={(s) => {
            if (s > (best[playing.id] ?? 0)) setBest({ ...best, [playing.id]: s });
          }}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

/* ---------- Home sections ---------- */

function PlayHome({ onPlay, best }: { onPlay: (g: Game) => void; best: Record<string, number> }) {
  const featured = FEATURED.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  const picks = TOP_PICKS.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  const mostPlayed = [...GAMES].sort((a, b) => b.players - a.players).slice(0, 6);
  const recent = GAMES.filter((x) => best[x.id] !== undefined);
  return (
    <>
      <Section title="Featured Games">
        <Carousel step={346}>
          {featured.map((x) => (
            <FeaturedCard key={x.id} game={x} onPlay={() => onPlay(x)} />
          ))}
        </Carousel>
      </Section>
      {recent.length > 0 && (
        <Section title="Recently played">
          <Carousel step={172}>
            {recent.map((x) => (
              <PickTile key={x.id} game={x} onPlay={() => onPlay(x)} />
            ))}
          </Carousel>
        </Section>
      )}
      <Section title="Top picks for you">
        <Carousel step={172} rows={2}>
          {picks.map((x) => (
            <PickTile key={x.id} game={x} onPlay={() => onPlay(x)} />
          ))}
        </Carousel>
      </Section>
      <Section title="Most played games">
        <div className="grid grid-cols-2 gap-3 min-[1200px]:grid-cols-3">
          {mostPlayed.map((x, i) => (
            <Card key={x.id} className="flex items-center gap-3 rounded-xl p-3">
              <span className="w-6 text-center font-bold text-[17px] text-secondary">{i + 1}</span>
              <GameIcon game={x} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[15px] text-primary">{x.name}</p>
                <p className="truncate text-[13px] text-secondary">
                  {x.category} · {playersLabel(x.players)}
                </p>
              </div>
              <Button variant="soft" onClick={() => onPlay(x)}>
                Play
              </Button>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Instant games">
        <TileGrid games={GAMES} onPlay={onPlay} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-6">
      <h2 className="px-1 pt-1 pb-3 font-bold text-[24px] text-primary leading-7">{title}</h2>
      {children}
    </section>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-xl">
      <EmptyState title={title} body={body} />
    </Card>
  );
}

/** Horizontal scroller with Facebook's round prev/next arrows. */
function Carousel({
  children,
  step,
  rows = 1,
}: {
  children: ReactNode;
  step: number;
  rows?: 1 | 2;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);
  const by = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: d * n * step, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className={cn(
          "overflow-x-auto [scrollbar-width:none]",
          rows === 2
            ? "grid grid-flow-col grid-rows-2 justify-start gap-x-2 gap-y-2"
            : "flex gap-3",
        )}
      >
        {children}
      </div>
      {!edges.start && <Arrow side="left" onClick={() => by(-1)} />}
      {!edges.end && <Arrow side="right" onClick={() => by(1)} />}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card text-icon shadow-[0_2px_8px_var(--shadow-1),0_0_0_1px_var(--shadow-1)] hover:bg-[color-mix(in_srgb,var(--card),#000_5%)]",
        side === "left" ? "-left-4" : "-right-4",
      )}
    >
      {side === "left" ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  );
}

/* ---------- Art ---------- */

/** Generated cover art: the game's gradient, soft light blobs and its emoji mark. */
export function GameArt({
  game,
  className,
  mark = 64,
}: {
  game: Game;
  className?: string;
  mark?: number;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${game.from}, ${game.to})` }}
      aria-hidden
    >
      <span className="absolute -top-1/4 -left-1/4 h-3/4 w-3/4 rounded-full bg-white/20 blur-2xl" />
      <span className="absolute -right-1/4 -bottom-1/3 h-3/4 w-3/4 rounded-full bg-black/15 blur-2xl" />
      <span
        className="absolute inset-0 flex items-center justify-center drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]"
        style={{ fontSize: mark }}
      >
        {game.emoji}
      </span>
    </div>
  );
}

function GameIcon({ game, size }: { game: Game; size: number }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-lg"
      style={{ width: size, height: size }}
    >
      <GameArt game={game} className="h-full w-full" mark={size * 0.55} />
    </span>
  );
}

function FeaturedCard({ game, onPlay }: { game: Game; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group w-[334px] shrink-0 overflow-hidden rounded-xl bg-card text-left shadow-base"
    >
      <div className="relative h-[188px]">
        <GameArt game={game} className="h-full w-full" mark={96} />
        <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden>
            <path d="M3 1.8v8.4c0 .5.5.8 1 .5l6.6-4.2a.6.6 0 0 0 0-1L4 1.3c-.5-.3-1 0-1 .5Z" />
          </svg>
        </span>
        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      </div>
      <div className="flex h-[67px] items-center gap-3 px-3" style={{ background: game.band }}>
        <GameIcon game={game} size={40} />
        <div className="min-w-0 text-white">
          <p className="truncate font-semibold text-[17px] leading-5">{game.name}</p>
          <p className="truncate text-[13px] leading-4">{game.tagline}</p>
          <p className="truncate text-[12px] leading-4">
            {game.category} · {playersLabel(game.players)}
          </p>
        </div>
      </div>
    </button>
  );
}

function PickTile({ game, onPlay }: { game: Game; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative h-[208px] w-[164px] shrink-0 overflow-hidden rounded-xl text-left shadow-base"
    >
      <GameArt game={game} className="absolute inset-0 scale-125 blur-xl" mark={0} />
      <span className="absolute inset-0 bg-[rgba(44,44,44,0.6)]" />
      <GameArt game={game} className="relative h-[95px]" mark={52} />
      <div className="relative flex h-[113px] flex-col justify-between p-2">
        <p className="line-clamp-2 font-semibold text-[17px] text-white leading-5">{game.name}</p>
        <span className="self-start rounded-2xl bg-black/80 px-2 py-1.5 font-semibold text-[13px] text-white/80 leading-4">
          {game.category}
        </span>
      </div>
      <span className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
    </button>
  );
}

function TileGrid({ games, onPlay }: { games: Game[]; onPlay: (g: Game) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,164px)] gap-2">
      {games.map((x) => (
        <PickTile key={x.id} game={x} onPlay={() => onPlay(x)} />
      ))}
    </div>
  );
}

function CategoryGlyph({ name }: { name: string }) {
  const map: Record<string, string> = {
    "All games": "🎮",
    Action: "💥",
    Adventure: "🗺️",
    Arcade: "🕹️",
    Battle: "⚔️",
    Board: "♟️",
    Builder: "🏗️",
    Card: "🃏",
    "Match 3": "🍬",
    Puzzle: "🧩",
    Simulation: "🏙️",
    Solitaire: "♠️",
    Sports: "🏀",
    Strategy: "🏰",
    Word: "🔤",
  };
  return <span className="text-[18px] leading-none opacity-80 grayscale">{map[name] ?? "🎮"}</span>;
}

/* ---------- Player ---------- */

function GameModal({
  game,
  saved,
  best,
  onSave,
  onScore,
  onClose,
}: {
  game: Game;
  saved: boolean;
  best: number;
  onSave: () => void;
  onScore: (s: number) => void;
  onClose: () => void;
}) {
  const [score, setScore] = useState(0);
  const report = useCallback(
    (s: number) => {
      setScore(s);
      onScore(s);
    },
    [onScore],
  );
  // `onScore` changes identity each render of the page; keep the latest in a ref.
  const latest = useRef(report);
  latest.current = report;
  const stable = useCallback((s: number) => latest.current(s), []);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Instant Games" width={420}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <GameIcon game={game} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[17px] text-primary">{game.name}</p>
          <p className="truncate text-[13px] text-secondary">
            {game.category} · {playersLabel(game.players)}
          </p>
        </div>
        <Button
          variant={saved ? "secondary" : "soft"}
          icon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          onClick={onSave}
        >
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-[13px] text-secondary">
        <span>
          Score <span className="font-semibold text-primary">{Math.max(0, score)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Trophy size={14} /> Best <span className="font-semibold text-primary">{best}</span>
        </span>
      </div>
      <div className="px-4 pb-5">
        <MiniGame game={game} onScore={stable} />
      </div>
    </Modal>
  );
}

import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Trophy,
  X,
} from "lucide-react";
import { Dialog as D } from "radix-ui";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQ, useViewer } from "@/app/viewer";
import {
  AppRail,
  AppRailDivider,
  AppRailHeading,
  AppRailItem,
  RailGear,
  RailSearch,
} from "@/features/misc/AppRail";
import { CATEGORY_GLYPH_CLASS, GAME_CATEGORY_GLYPHS } from "@/features/misc/glyphs";
import { BellFilled, BookmarkFilled, ControllerFilled } from "@/features/misc/icons";
import { usePref } from "@/features/misc/settings/controls";
import { cn } from "@/lib/format";
import { Avatar, Button, Card, EmptyState, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { GameCover } from "./GameCover";
import { GameSettingsDialog } from "./GameSettingsDialog";
import {
  byId,
  CATEGORIES,
  FEATURED,
  friendPlays,
  GAMES,
  type Game,
  MOST_PLAYED,
  playersLabel,
  RECENTLY_RELEASED,
  TOP_PICKS,
} from "./games";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameNotifications, setGameNotifications] = usePref("games-notifications");
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
      <AppRail
        title="Games"
        label="Games"
        action={
          <RailGear label="Edit notification settings" onClick={() => setSettingsOpen(true)} />
        }
      >
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
            icon={<CategoryGlyph name={c} selected={isCat(c) && !results} />}
            label={c}
            selected={isCat(c) && !results}
            onClick={() => {
              setQ("");
              setView({ kind: "category", name: c });
            }}
          />
        ))}
      </AppRail>

      <main className="min-w-0 flex-1 px-[27px] pt-[6px] pb-10">
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
            {gameNotifications === "Off" ? (
              <Card className="rounded-xl">
                <EmptyState
                  title="Notifications from games are off"
                  body="Turn them on to hear when it's your turn or a friend beats your score."
                  action={
                    <Button variant="primary" onClick={() => setGameNotifications("On")}>
                      Turn on
                    </Button>
                  }
                />
              </Card>
            ) : (
              <EmptyCard
                title="No notifications"
                body="When games you play send you updates, you'll see them here."
              />
            )}
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
        <GamePlayer
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
      <GameSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ---------- Home sections ---------- */

function PlayHome({ onPlay, best }: { onPlay: (g: Game) => void; best: Record<string, number> }) {
  const featured = FEATURED.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  const picks = TOP_PICKS.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  const recent = GAMES.filter((x) => best[x.id] !== undefined);
  const released = RECENTLY_RELEASED.map((id) => byId.get(id)).filter((x): x is Game => !!x);
  return (
    <>
      <Section title="Featured Games">
        <Carousel step={346} arrows="grey">
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
          {MOST_PLAYED.map((x, i) => (
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
      <Section title="Recently released">
        <Carousel step={172}>
          {released.map((x) => (
            <PickTile key={x.id} game={x} onPlay={() => onPlay(x)} />
          ))}
        </Carousel>
      </Section>
      <FriendsPlaySection onPlay={onPlay} />
    </>
  );
}

/** "Games your friends play": tiles with a facepile of the viewer's friends who play. */
function FriendsPlaySection({ onPlay }: { onPlay: (g: Game) => void }) {
  const viewer = useViewer();
  const friends = useQ(api.friends.list, { userId: viewer._id });
  const rows = useMemo(() => {
    if (!friends?.length) return [];
    // Recently released sits right above: keep the two shelves distinct.
    return GAMES.filter((game) => !RECENTLY_RELEASED.includes(game.id))
      .map((game) => ({
        game,
        players: friends.filter((f) => friendPlays(game.id, f._id)),
      }))
      .filter((r) => r.players.length > 0)
      .sort((a, b) => b.players.length - a.players.length || b.game.players - a.game.players)
      .slice(0, 10);
  }, [friends]);
  if (rows.length === 0) return null;
  return (
    <Section title="Games your friends play">
      <Carousel step={172}>
        {rows.map(({ game, players }) => (
          <PickTile
            key={game.id}
            game={game}
            onPlay={() => onPlay(game)}
            footer={
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="flex shrink-0">
                  {players.slice(0, 3).map((f, i) => (
                    <Avatar
                      key={f._id}
                      src={f.avatar}
                      size={20}
                      className={cn("rounded-full ring-2 ring-[#2c2c2c]", i > 0 && "-ml-1.5")}
                    />
                  ))}
                </span>
                <span className="truncate text-[13px] text-white/80 leading-4">
                  {players.length === 1
                    ? `${players[0]?.name.split(" ")[0]} plays`
                    : `${players.length} friends play`}
                </span>
              </span>
            }
          />
        ))}
      </Carousel>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-[30px]">
      <h2 className="px-1 pt-1 pb-2 font-bold text-[24px] text-primary leading-7">{title}</h2>
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
  arrows = "white",
}: {
  children: ReactNode;
  step: number;
  rows?: 1 | 2;
  /** Featured Games uses grey arrows; tile carousels white floating ones. */
  arrows?: "white" | "grey";
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
      {!edges.start && <Arrow side="left" tone={arrows} onClick={() => by(-1)} />}
      {!edges.end && <Arrow side="right" tone={arrows} onClick={() => by(1)} />}
    </div>
  );
}

function Arrow({
  side,
  tone,
  onClick,
}: {
  side: "left" | "right";
  tone: "white" | "grey";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-icon",
        tone === "grey"
          ? "bg-btn hover:brightness-95 dark:hover:brightness-125"
          : "bg-card shadow-[0_2px_8px_var(--shadow-1),0_0_0_1px_var(--shadow-1)] hover:bg-[color-mix(in_srgb,var(--card),#000_5%)]",
        side === "left" ? "-left-4" : "-right-4",
      )}
    >
      {side === "left" ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  );
}

/* ---------- Art ---------- */

function GameIcon({ game, size }: { game: Game; size: number }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
      style={{ width: size, height: size }}
    >
      <GameCover game={game} variant="icon" className="block h-full w-full" />
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
        <GameCover game={game} className="block h-full w-full" />
        <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden>
            <path d="M3 1.8v8.4c0 .5.5.8 1 .5l6.6-4.2a.6.6 0 0 0 0-1L4 1.3c-.5-.3-1 0-1 .5Z" />
          </svg>
        </span>
        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      </div>
      <div className="flex h-[66px] items-center gap-3 px-3" style={{ background: game.band }}>
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

function PickTile({
  game,
  onPlay,
  footer,
}: {
  game: Game;
  onPlay: () => void;
  /** Replaces the genre pill (e.g. a friends facepile). */
  footer?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative h-[208px] w-[164px] shrink-0 overflow-hidden rounded-xl text-left shadow-base"
    >
      <GameCover
        game={game}
        variant="thumb"
        className="absolute inset-0 h-full w-full scale-150 blur-xl"
      />
      <span className="absolute inset-0 bg-[rgba(44,44,44,0.6)]" />
      <GameCover game={game} variant="thumb" className="relative block h-[95px] w-full" />
      <div className="relative flex h-[113px] flex-col justify-between p-2">
        <p className="line-clamp-2 font-semibold text-[17px] text-white leading-5">{game.name}</p>
        {footer ?? (
          <span className="self-start rounded-2xl bg-black/80 px-2 py-1.5 font-semibold text-[13px] text-white/80 leading-4">
            {game.category}
          </span>
        )}
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

function CategoryGlyph({ name, selected }: { name: string; selected: boolean }) {
  const G = GAME_CATEGORY_GLYPHS[name];
  if (!G) return null;
  // "All games" is a dark glyph on Facebook; the rest are faint white art.
  return <G className={selected || name === "All games" ? undefined : CATEGORY_GLYPH_CLASS} />;
}

/* ---------- Player ---------- */

/**
 * Facebook's instant-game player: a near full-height dark panel over a dark
 * backdrop, with a slim header (game, score, Save, full screen, close) and
 * the game scaled to fill the stage.
 */
function GamePlayer({
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

  const panel = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === panel.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panel.current?.requestFullscreen?.();
  };

  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <D.Content
          ref={panel}
          aria-describedby={undefined}
          // Focus the panel, not the first button (no stray focus ring on Save).
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            panel.current?.focus();
          }}
          className="dark fixed top-1/2 left-1/2 z-[61] flex h-[90vh] w-[min(1200px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-[#18191a] text-primary shadow-elevated outline-none [&:fullscreen]:rounded-none"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-white/10 border-b bg-[#242526] px-3">
            <GameIcon game={game} size={36} />
            <div className="min-w-0 flex-1">
              <D.Title className="truncate font-semibold text-[15px] leading-5">
                {game.name}
              </D.Title>
              <p className="truncate text-[12px] text-secondary leading-4">
                {game.category} · {playersLabel(game.players)}
              </p>
            </div>
            <span className="text-[13px] text-secondary">
              Score <span className="font-semibold text-primary">{Math.max(0, score)}</span>
            </span>
            <span className="mr-1 flex items-center gap-1 text-[13px] text-secondary">
              <Trophy size={14} /> Best <span className="font-semibold text-primary">{best}</span>
            </span>
            <Button
              variant={saved ? "secondary" : "soft"}
              icon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              onClick={onSave}
            >
              {saved ? "Saved" : "Save"}
            </Button>
            <IconButton
              label={fullscreen ? "Exit full screen" : "Full screen"}
              variant="ghost"
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </IconButton>
            <D.Close asChild>
              <IconButton label="Close" variant="ghost">
                <X size={22} strokeWidth={2.2} />
              </IconButton>
            </D.Close>
          </div>
          <GameStage>
            <MiniGame game={game} onScore={stable} />
          </GameStage>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * Scales the game's fixed-size frame to fit the stage (engines read the scale
 * from `data-game-scale` for pointer math).
 */
function GameStage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ k: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const measure = () => {
      const w = i.offsetWidth;
      const h = i.offsetHeight;
      if (!w || !h) return;
      const k = Math.min((b.clientWidth - 48) / w, (b.clientHeight - 32) / h, 2.5);
      setFit({ k: Math.max(0.5, k), w, h });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(i);
    measure();
    return () => ro.disconnect();
  }, []);
  const k = fit?.k ?? 1;
  return (
    <div ref={box} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      <div className="relative" style={fit ? { width: fit.w * k, height: fit.h * k } : undefined}>
        <div
          ref={inner}
          data-game-scale={k}
          className="absolute top-0 left-0 w-max origin-top-left"
          style={{ transform: `scale(${k})`, visibility: fit ? undefined : "hidden" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

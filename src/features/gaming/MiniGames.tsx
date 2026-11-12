import { type ComponentType, lazy, Suspense } from "react";
import { Spinner } from "@/ui/primitives";
import type { EngineProps } from "./engines/kit";
import type { Engine } from "./games";

/**
 * The instant-game player: each catalog game runs the engine for its genre.
 * Engines load on demand so the Games page stays light.
 */
const ENGINES: Record<Engine, ComponentType<EngineProps>> = {
  klondike: lazy(() => import("./engines/Klondike")),
  tripeaks: lazy(() => import("./engines/TriPeaks")),
  blackjack: lazy(() => import("./engines/Blackjack")),
  match3: lazy(() => import("./engines/Match3")),
  merge: lazy(() => import("./engines/MergeBoard")),
  arrows: lazy(() => import("./engines/Arrows")),
  maze: lazy(() => import("./engines/Maze")),
  jigsaw: lazy(() => import("./engines/Jigsaw")),
  word: lazy(() => import("./engines/Word")),
  snake: lazy(() => import("./engines/Snake")),
  breakout: lazy(() => import("./engines/Breakout")),
  hockey: lazy(() => import("./engines/Hockey")),
  defense: lazy(() => import("./engines/Defense")),
  checkers: lazy(() => import("./engines/Checkers")),
  arena: lazy(() => import("./engines/Arena")),
  bubbles: lazy(() => import("./engines/Bubbles")),
  tower: lazy(() => import("./engines/TowerBattle")),
};

export function MiniGame(props: EngineProps) {
  const Game = ENGINES[props.game.engine];
  return (
    <Suspense
      fallback={
        <div className="flex h-[420px] w-[388px] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Game key={props.game.id} {...props} />
    </Suspense>
  );
}

import { cn } from "@/lib/format";
import type { Game } from "./games";

/**
 * Key art for a game, pre-rendered to public/seed/games by
 * `bun scripts/game-art/build.ts`: `cover` is the 1280×720 painting with the
 * game's wordmark, `thumb` the same at 480×270 for small tiles, and `icon` the
 * square app icon cropped around the hero.
 */
export function GameCover({
  game,
  variant = "cover",
  className,
}: {
  game: Game;
  variant?: "cover" | "thumb" | "icon";
  className?: string;
}) {
  return (
    <img
      src={`/seed/games/${game.id}${variant === "cover" ? "" : `-${variant}`}.webp`}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("object-cover", className)}
    />
  );
}

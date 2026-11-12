import { cn } from "@/lib/format";
import type { Game } from "./games";

/**
 * Key art for a game: `cover` is the 16:9 painting (some with the game's
 * wordmark, as on Facebook), `icon` its square app icon. Both are pre-rendered
 * to public/seed/games by `bun scripts/game-art/build.ts`.
 */
export function GameCover({
  game,
  variant = "cover",
  className,
}: {
  game: Game;
  variant?: "cover" | "icon";
  className?: string;
}) {
  return (
    <img
      src={`/seed/games/${game.id}${variant === "icon" ? "-icon" : ""}.jpg`}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("object-cover", className)}
    />
  );
}

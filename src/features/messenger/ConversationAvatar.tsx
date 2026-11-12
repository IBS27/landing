import { cn } from "@/lib/format";
import { Avatar } from "@/ui/primitives";

type Props = {
  kind: "dm" | "group" | "marketplace";
  photo: string | null;
  others: { avatar: string; online?: boolean }[];
  online?: boolean;
  size: number;
  className?: string;
};

/**
 * DM: the person's photo with an online dot. Group: its photo, or two
 * overlapping member photos. Marketplace: the listing photo with the other
 * person's small avatar in the corner.
 */
export function ConversationAvatar({ kind, photo, others, online, size, className }: Props) {
  const dot = Math.max(10, Math.round(size * 0.25));
  if (kind === "marketplace") {
    const small = Math.round(size * 0.5);
    return (
      <span
        className={cn("relative inline-block shrink-0", className)}
        style={{ width: size, height: size }}
      >
        <img
          src={photo ?? others[0]?.avatar ?? ""}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
        {others[0] && size >= 40 && (
          <img
            src={others[0].avatar}
            alt=""
            className="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-card object-cover"
            style={{ width: small, height: small }}
          />
        )}
      </span>
    );
  }
  if (kind === "group" && !photo && others.length >= 2) {
    const inner = Math.round(size * 0.68);
    return (
      <span
        className={cn("relative inline-block shrink-0", className)}
        style={{ width: size, height: size }}
      >
        <img
          src={others[0].avatar}
          alt=""
          className="absolute top-0 right-0 rounded-full object-cover"
          style={{ width: inner, height: inner }}
        />
        <img
          src={others[1].avatar}
          alt=""
          className="absolute bottom-0 left-0 rounded-full border-2 border-card object-cover"
          style={{ width: inner + 4, height: inner + 4, margin: -2 }}
        />
        {online && <OnlineDot size={dot} />}
      </span>
    );
  }
  return (
    <Avatar
      src={photo ?? others[0]?.avatar ?? ""}
      size={size}
      online={online}
      className={className}
    />
  );
}

function OnlineDot({ size }: { size: number }) {
  return (
    <span
      className="absolute rounded-full border-2 border-card bg-online"
      style={{ width: size + 2, height: size + 2, right: 0, bottom: 0 }}
    />
  );
}

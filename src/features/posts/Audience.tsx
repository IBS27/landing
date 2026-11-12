import { ChevronDown } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { FriendsAudienceIcon, GlobeIcon, LockIcon } from "./icons";

export type Audience = "public" | "friends" | "only_me";

export const AUDIENCES: { value: Audience; label: string; sub: string }[] = [
  { value: "public", label: "Public", sub: "Anyone on or off Facebook" },
  { value: "friends", label: "Friends", sub: "Your friends on Facebook" },
  { value: "only_me", label: "Only me", sub: "Only you can see this post" },
];

export function AudienceIcon({ value, size = 12 }: { value: Audience; size?: number }) {
  if (value === "public") return <GlobeIcon size={size} />;
  if (value === "friends") return <FriendsAudienceIcon size={size} />;
  return <LockIcon size={size} />;
}

export const audienceLabel = (v: Audience) => AUDIENCES.find((a) => a.value === v)!.label;

/** The small grey audience button under the author's name (Create post, Share). */
export function AudienceChip({
  value,
  onChange,
}: {
  value: Audience;
  onChange: (v: Audience) => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-md bg-btn px-2 font-semibold text-[13px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
        >
          <AudienceIcon value={value} />
          {audienceLabel(value)}
          <ChevronDown size={12} strokeWidth={3} />
        </button>
      </MenuTrigger>
      <MenuContent align="start" width={320}>
        {AUDIENCES.map((a) => (
          <MenuItem
            key={a.value}
            onSelect={() => onChange(a.value)}
            icon={<AudienceIcon value={a.value} size={18} />}
            label={
              <span className="flex items-center justify-between">
                {a.label}
                {a.value === value && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
              </span>
            }
            sub={a.sub}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

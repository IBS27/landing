import { Check, Search, Settings2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { FriendsAudienceIcon, GlobeIcon } from "@/features/posts/icons";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type StoryAudience = "public" | "friends" | "custom";

const OPTIONS: { value: StoryAudience; label: string; sub: string; icon: ReactNode }[] = [
  {
    value: "public",
    label: "Public",
    sub: "Anyone on Facebook or Messenger",
    icon: <GlobeIcon size={20} />,
  },
  {
    value: "friends",
    label: "Friends",
    sub: "Only your Facebook friends",
    icon: <FriendsAudienceIcon size={20} />,
  },
  {
    value: "custom",
    label: "Custom",
    sub: "Only the friends you choose",
    icon: <Settings2 size={20} />,
  },
];

/** Stories → Settings: story privacy (saved on the user) and the people you've muted. */
export function StorySettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const viewer = useViewer();
  const setPrivacy = useM(api.stories.setPrivacy);
  const setMuted = useM(api.stories.setMuted);
  const muted = useQ(api.stories.mutedAuthors, open ? {} : "skip");
  const friends = useQ(api.posts.friendPicker, open ? {} : "skip");

  const [audience, setAudience] = useState<StoryAudience>("friends");
  const [chosen, setChosen] = useState<Set<Id<"users">>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  // Start from the saved setting each time the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-seed on open.
  useEffect(() => {
    if (!open) return;
    setAudience(viewer.storyAudience ?? "friends");
    setChosen(new Set(viewer.storyAudienceIds ?? []));
    setQ("");
  }, [open]);

  const canSave = audience !== "custom" || chosen.size > 0;
  const save = async () => {
    setSaving(true);
    try {
      await setPrivacy({ audience, audienceIds: audience === "custom" ? [...chosen] : undefined });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const shown = (friends ?? []).filter((f) =>
    f.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Story privacy" width={548}>
      <div className="px-4 pt-4 pb-2">
        <p className="font-semibold text-[17px] text-primary">Who can see your story?</p>
        <p className="mt-1 text-[15px] text-secondary leading-5">
          Your story will be visible for 24 hours on Facebook and Messenger.
        </p>
      </div>
      <div role="radiogroup" aria-label="Story privacy" className="px-2">
        {OPTIONS.map((o) => {
          const on = audience === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAudience(o.value)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
            >
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-btn text-primary">
                {o.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[17px] text-primary">{o.label}</span>
                <span className="block text-[15px] text-secondary">{o.sub}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  on ? "border-fb" : "border-[var(--secondary-icon)]",
                )}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
              </span>
            </button>
          );
        })}
      </div>

      {audience === "custom" && (
        <div className="mx-4 mt-2 rounded-lg border border-divider">
          <label className="m-2 flex h-9 items-center gap-2 rounded-full bg-input px-3">
            <Search size={16} className="text-secondary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a friend"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
          <div className="max-h-[240px] overflow-y-auto px-2 pb-2">
            {friends === undefined ? (
              <div className="flex justify-center py-6">
                <Spinner size={24} />
              </div>
            ) : shown.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-secondary">No friends found</p>
            ) : (
              shown.map((f) => {
                const on = chosen.has(f._id);
                return (
                  <button
                    key={f._id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(chosen);
                      if (on) next.delete(f._id);
                      else next.add(f._id);
                      setChosen(next);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
                  >
                    <Avatar src={f.avatar} size={36} />
                    <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary">
                      {f.name}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-[4px] border-2",
                        on ? "border-fb bg-fb text-white" : "border-[var(--secondary-icon)]",
                      )}
                    >
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <p className="border-divider border-t px-3 py-2 text-[13px] text-secondary">
            {chosen.size === 0
              ? "Choose at least one friend"
              : `${chosen.size} ${chosen.size === 1 ? "friend" : "friends"} selected`}
          </p>
        </div>
      )}

      <div className="mt-3 border-divider border-t px-4 pt-3 pb-1">
        <p className="font-semibold text-[17px] text-primary">Stories you've muted</p>
        {muted === undefined ? null : muted.length === 0 ? (
          <p className="py-2 text-[15px] text-secondary">
            When you mute someone, you won't see their stories at the top of Feed.
          </p>
        ) : (
          <div className="py-1">
            {muted.map((u) => (
              <div key={u._id} className="flex items-center gap-3 py-2">
                <Avatar src={u.avatar} size={36} />
                <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary">
                  {u.name}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => void setMuted({ authorId: u._id, muted: false })}
                >
                  Unmute
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-4">
        <Button variant="link" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="min-w-[100px]"
          disabled={!canSave || saving}
          onClick={() => void save()}
        >
          {saving ? <Spinner size={16} className="text-white" /> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

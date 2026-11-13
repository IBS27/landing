import {
  ArrowLeft,
  Bell,
  Cake,
  CalendarDays,
  CircleUser,
  Clapperboard,
  Flag,
  HandHeart,
  House,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  Smartphone,
  Store,
  Tag,
  UserPlus,
  UserRoundSearch,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useM } from "@/app/viewer";
import { api } from "../../../../convex/_generated/api";
import { NOTIFICATION_CATEGORIES } from "../../../../convex/lib/settings";
import type { NotificationCategory } from "../../../../convex/validators";
import { Group, LinkRow, PrefToggle, ToggleRow, useOptimistic, useSettings } from "./controls";

const ICONS: Record<NotificationCategory, LucideIcon> = {
  comments: MessageSquare,
  tags: Tag,
  reminders: Bell,
  activity: CircleUser,
  friend_updates: Users,
  friend_requests: UserPlus,
  people_you_may_know: UserRoundSearch,
  birthdays: Cake,
  groups: UsersRound,
  video: Clapperboard,
  events: CalendarDays,
  pages: Flag,
  marketplace: Store,
  fundraisers: HandHeart,
  landing: House,
};

const CHANNELS = [
  { id: "push", label: "Push", Icon: Smartphone },
  { id: "email", label: "Email", Icon: Mail },
  { id: "sms", label: "SMS", Icon: MessageCircle },
] as const;

/** Settings → Notifications: one row per category, each opening its own page. */
export function NotificationsPane() {
  const settings = useSettings();
  const [open, setOpen] = useState<NotificationCategory | null>(null);
  if (open) return <CategoryDetail id={open} onBack={() => setOpen(null)} />;
  return (
    <>
      <p className="px-2 pb-2 text-[15px] text-secondary leading-5">
        Facebook may still send you notifications about your account and important updates outside
        of these settings.
      </p>
      <Group title="What notifications you receive">
        {NOTIFICATION_CATEGORIES.map((c) => {
          const off = settings?.notificationsOff.includes(c.id);
          const channels = CHANNELS.filter(
            (ch) => settings?.prefs[`notify-${c.id}-${ch.id}`] === "On",
          ).map((ch) => ch.label);
          return (
            <LinkRow
              key={c.id}
              Icon={ICONS[c.id]}
              title={c.label}
              sub={
                settings === undefined
                  ? " "
                  : off
                    ? "Off"
                    : channels.length
                      ? channels.join(", ")
                      : "On Facebook only"
              }
              onClick={() => setOpen(c.id)}
            />
          );
        })}
      </Group>
    </>
  );
}

function CategoryDetail({ id, onBack }: { id: NotificationCategory; onBack: () => void }) {
  const settings = useSettings();
  const setNotification = useM(api.settings.setNotification);
  const meta = NOTIFICATION_CATEGORIES.find((c) => c.id === id);
  const [allowed, setAllowed] = useOptimistic(
    settings ? !settings.notificationsOff.includes(id) : undefined,
    (on) => setNotification({ category: id, on }),
  );
  if (!meta) return null;
  return (
    <>
      <div className="flex items-center gap-2 px-1 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover"
        >
          <ArrowLeft size={20} className="text-icon" />
        </button>
        <h3 className="font-bold text-[20px] text-primary leading-6">{meta.label}</h3>
      </div>
      <p className="px-2 pb-2 text-[15px] text-secondary leading-5">{meta.description}</p>
      <Group>
        <ToggleRow
          title="Allow notifications on Facebook"
          on={allowed}
          onChange={setAllowed}
          Icon={ICONS[id]}
        />
      </Group>
      <Group title="Where you receive these notifications">
        {CHANNELS.map((ch) =>
          allowed === false ? (
            <ToggleRow
              key={ch.id}
              title={ch.label}
              Icon={ch.Icon}
              on={false}
              onChange={() => {}}
              disabled
            />
          ) : (
            <PrefToggle key={ch.id} id={`notify-${id}-${ch.id}`} title={ch.label} Icon={ch.Icon} />
          ),
        )}
      </Group>
    </>
  );
}

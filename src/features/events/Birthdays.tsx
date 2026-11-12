import { Link } from "@tanstack/react-router";
import { CircleCheck, Gift, SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { UserSummary } from "../../../convex/lib/users";
import { EventsLayout, EventsRail } from "./EventsRail";
import { todayStart } from "./format";

const DAY = 86_400_000;
type Entry = { user: UserSummary; birthday: string; wroteToday: boolean; days: number; date: Date };

/** Days from today (local) to the nearest occurrence of "MM-DD"; recent ones are negative. */
function place(mmdd: string, today: number) {
  const [m, d] = mmdd.split("-").map(Number);
  const y = new Date(today).getFullYear();
  let date = new Date(y, m - 1, d);
  let days = Math.round((date.getTime() - today) / DAY);
  if (days < -7) {
    date = new Date(y + 1, m - 1, d);
    days = Math.round((date.getTime() - today) / DAY);
  }
  return { date, days };
}

const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "long" });
const fmtShort = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

/** /events/birthdays — today's, recent and upcoming friends' birthdays. */
export function Birthdays() {
  const today = todayStart();
  const rows = useQ(api.events.birthdays, { since: today });
  const groups = useMemo(() => {
    if (!rows) return null;
    const all: Entry[] = rows.map((r) => ({ ...r, ...place(r.birthday, today) }));
    all.sort((a, b) => a.days - b.days || a.user.name.localeCompare(b.user.name));
    const months = new Map<string, Entry[]>();
    const now = new Date(today);
    const horizon = new Date(now.getFullYear() + 1, now.getMonth(), 1).getTime();
    for (const e of all.filter((x) => x.days > 7 && x.date.getTime() < horizon)) {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
      months.set(key, [...(months.get(key) ?? []), e]);
    }
    return {
      today: all.filter((e) => e.days === 0),
      recent: all.filter((e) => e.days < 0).reverse(),
      upcoming: all.filter((e) => e.days > 0 && e.days <= 7),
      months: [...months.values()],
    };
  }, [rows, today]);

  return (
    <EventsLayout rail={<EventsRail section="birthdays" />}>
      <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-4 pt-4 pb-10">
        {!groups ? (
          <Card className="space-y-3 rounded-xl p-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-16 w-full" />
          </Card>
        ) : (
          <>
            <Card className="rounded-xl p-4">
              <h2 className="font-bold text-[20px] text-primary leading-6">Today's birthdays</h2>
              {groups.today.length === 0 ? (
                <p className="mt-2 text-[15px] text-secondary">No friends have birthdays today.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-4">
                  {groups.today.map((e) => (
                    <TodayRow key={e.user._id} entry={e} />
                  ))}
                </div>
              )}
            </Card>
            {groups.recent.length > 0 && (
              <ListCard title="Recent birthdays" entries={groups.recent} />
            )}
            {groups.upcoming.length > 0 && (
              <ListCard title="Upcoming birthdays" entries={groups.upcoming} />
            )}
            {groups.months.map((m) => (
              <Card key={m[0].date.toISOString()} className="rounded-xl p-4">
                <h2 className="font-bold text-[20px] text-primary leading-6">
                  {fmtMonth.format(m[0].date)}
                </h2>
                <p className="mt-0.5 text-[15px] text-secondary">
                  {m.length === 1
                    ? `${m[0].user.name}`
                    : `${m[0].user.name} and ${m.length - 1} other${m.length === 2 ? "" : "s"}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.map((e) => (
                    <Tooltip
                      key={e.user._id}
                      content={`${e.user.name} (${fmtShort.format(e.date)})`}
                      side="top"
                    >
                      <Link
                        to="/$username"
                        params={{ username: e.user.username }}
                        className="hover:brightness-95"
                      >
                        <Avatar src={e.user.avatar} size={60} alt={e.user.name} />
                      </Link>
                    </Tooltip>
                  ))}
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </EventsLayout>
  );
}

function TodayRow({ entry }: { entry: Entry }) {
  const create = useM(api.posts.create);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = entry;
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await create({ text, timelineUserId: user._id, privacy: "friends" });
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-3">
      <Link
        to="/$username"
        params={{ username: user.username }}
        className="shrink-0 hover:brightness-95"
      >
        <Avatar src={user.avatar} size={60} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/$username"
          params={{ username: user.username }}
          className="font-semibold text-[17px] text-primary leading-5 hover:underline"
        >
          {user.name}
        </Link>
        <p className="flex items-center gap-1 text-[13px] text-secondary leading-4">
          <Gift size={13} /> Birthday today
        </p>
        {entry.wroteToday && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-positive">
            <CircleCheck size={14} /> You wrote on {user.firstName}'s timeline
          </p>
        )}
        <form
          className="mt-2 flex h-9 items-center rounded-full bg-input pr-1 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Write on ${user.firstName === user.name ? user.name : `${user.firstName}'s`} timeline...`}
            aria-label={`Write on ${user.firstName}'s timeline`}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
          <button
            type="submit"
            aria-label="Post"
            disabled={!text.trim() || busy}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fb hover:bg-hover disabled:text-disabled"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ListCard({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <Card className="rounded-xl p-4">
      <h2 className="mb-2 font-bold text-[20px] text-primary leading-6">{title}</h2>
      {entries.map((e) => (
        <Link
          key={e.user._id}
          to="/$username"
          params={{ username: e.user.username }}
          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
        >
          <Avatar src={e.user.avatar} size={60} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-[17px] text-primary leading-5">
              {e.user.name}
            </span>
            <span className="block text-[13px] text-secondary leading-4">
              {e.days < 0
                ? `${fmtDay.format(e.date)}`
                : e.days === 1
                  ? `Tomorrow · ${fmtShort.format(e.date)}`
                  : fmtDay.format(e.date)}
            </span>
          </span>
        </Link>
      ))}
    </Card>
  );
}

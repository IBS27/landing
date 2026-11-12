import { Search, Share2 } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { PeopleGlyph } from "@/features/misc/glyphs";
import { BellFilled } from "@/features/misc/icons";
import { RadioList, usePref } from "@/features/misc/settings/controls";
import { PostCard, PostSkeleton, type PostView } from "@/features/posts";
import { FloatingField, floatingInputCls } from "@/features/saved/FloatingField";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RailDivider, RailHeading, RailItem, SideRail } from "./SideRail";

export const MEMORY_VIEWS = ["home", "notifications", "people", "dates"] as const;
export type MemoryView = (typeof MEMORY_VIEWS)[number];

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const fmtDay = (day: string) => shortDate.format(new Date(`${day}T00:00:00Z`));

/** /memories: "On this day" plus the Notifications / Hide People / Hide Dates settings. */
export function MemoriesPage({
  view,
  onView,
}: {
  view: MemoryView;
  onView: (v: MemoryView) => void;
}) {
  const hidden = useQ(api.memories.hidden, {});
  const count = (n: number | undefined) => `${n ?? 0} Hidden`;

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <SideRail title="Memories" label="Memories Settings">
        <RailItem
          icon={<HomeGlyph />}
          label="Memories Home"
          selected={view === "home"}
          onClick={() => onView("home")}
        />
        <RailDivider />
        <RailHeading>Settings</RailHeading>
        <RailItem
          icon={<BellFilled />}
          label="Notifications"
          selected={view === "notifications"}
          onClick={() => onView("notifications")}
        />
        <RailItem
          icon={<PeopleGlyph />}
          label="Hide People"
          sub={count(hidden?.people.length)}
          selected={view === "people"}
          onClick={() => onView("people")}
        />
        <RailItem
          icon={<HideDatesGlyph />}
          label="Hide Dates"
          sub={count(hidden?.dates.length)}
          selected={view === "dates"}
          onClick={() => onView("dates")}
        />
      </SideRail>
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-8">
        <div className="flex w-full max-w-[680px] flex-col gap-3">
          {view === "home" && <MemoriesHome />}
          {view === "notifications" && <NotificationsPane />}
          {view === "people" && <HidePeoplePane people={hidden?.people} />}
          {view === "dates" && <HideDatesPane dates={hidden?.dates} />}
        </div>
      </main>
    </div>
  );
}

function MemoriesHome() {
  const [now] = useState(() => new Date());
  const memories = useQ(api.memories.list, {
    month: now.getMonth() + 1,
    day: now.getDate(),
    year: now.getFullYear(),
    tzOffset: now.getTimezoneOffset(),
  });
  if (memories === undefined) return <PostSkeleton />;
  if (memories.length === 0)
    return (
      <Card className="overflow-hidden pb-6 text-center">
        <MemoriesBanner />
        <h2 className="mt-3 px-6 font-bold text-[20px] text-primary leading-6">
          No memories today
        </h2>
        <p className="mx-auto mt-1 max-w-[600px] px-6 text-[17px] text-secondary leading-5">
          There aren't any Memories to see or share today, but we'll let you know when you have some
          to look back on.
        </p>
      </Card>
    );
  return (
    <>
      <Card className="overflow-hidden pb-5 text-center">
        <MemoriesBanner />
        <h2 className="mt-3 px-6 font-bold text-[20px] text-primary leading-6">
          Your memories on Facebook
        </h2>
        <p className="mx-auto mt-1 max-w-[600px] px-6 text-[17px] text-secondary leading-5">
          We hope you enjoy looking back and sharing your memories on Facebook, from the most recent
          to those long ago.
        </p>
      </Card>
      {memories.map((post) => (
        <Memory key={post._id} post={post} now={now} />
      ))}
    </>
  );
}

function Memory({ post, now }: { post: PostView; now: Date }) {
  const share = useM(api.posts.create);
  const [shared, setShared] = useState(false);
  const years = now.getFullYear() - new Date(post.createdAt).getFullYear();
  return (
    <div className="flex flex-col gap-0">
      <Card className="mb-[-8px] flex items-center justify-between rounded-b-none px-4 pt-3 pb-5">
        <div>
          <p className="font-semibold text-[17px] text-primary leading-5">
            {years} {years === 1 ? "year" : "years"} ago
          </p>
          <p className="text-[13px] text-secondary">{dateFmt.format(post.createdAt)}</p>
        </div>
        <Button
          variant={shared ? "secondary" : "primary"}
          disabled={shared}
          icon={<Share2 size={16} />}
          onClick={() => {
            setShared(true);
            void share({ sharedPostId: post._id, privacy: "friends" }).catch(() =>
              setShared(false),
            );
          }}
        >
          {shared ? "Shared" : "Share"}
        </Button>
      </Card>
      <PostCard post={post} hideable={false} />
    </div>
  );
}

/* ---------------- Settings panes ---------------- */

function Pane({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
      <p className="mt-1 text-[15px] text-secondary leading-5">{description}</p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

const NOTIFICATION_OPTIONS = [
  {
    value: "All memories",
    label: "All memories",
    sub: "We'll notify you about all of your memories.",
  },
  {
    value: "Highlights",
    label: "Highlights",
    sub: "We'll only notify you about memories we think you'll want to see.",
  },
  { value: "None", label: "None", sub: "We won't notify you about your memories." },
];

function NotificationsPane() {
  const [value, set] = usePref("memories-notifications");
  return (
    <Pane
      title="Notifications"
      description="Choose which memories you'd like to be notified about."
    >
      <div className="-mx-2">
        <RadioList
          name="Memories notifications"
          options={NOTIFICATION_OPTIONS}
          value={value}
          onChange={set}
        />
      </div>
    </Pane>
  );
}

type HiddenPerson = {
  _id: Id<"memoryHides">;
  user: { _id: Id<"users">; name: string; avatar: string };
};

function HidePeoplePane({ people }: { people: HiddenPerson[] | undefined }) {
  const friends = useQ(api.posts.friendPicker, {});
  const hide = useM(api.memories.hidePerson);
  const unhide = useM(api.memories.unhide);
  const [q, setQ] = useState("");
  const hiddenIds = new Set(people?.map((p) => p.user._id));
  const term = q.trim().toLowerCase();
  const matches = term
    ? (friends ?? [])
        .filter((f) => !hiddenIds.has(f._id) && f.name.toLowerCase().includes(term))
        .slice(0, 6)
    : [];

  return (
    <Pane
      title="Hide People"
      description="We won't show you memories that include the people you hide."
    >
      <div className="relative">
        <label className="flex h-9 items-center gap-2 rounded-full bg-input px-3">
          <Search size={16} className="shrink-0 text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a name"
            aria-label="Search for a friend to hide"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
        {term && (
          <div className="absolute inset-x-0 top-11 z-10 rounded-lg bg-card p-2 shadow-elevated">
            {friends === undefined ? (
              <div className="flex justify-center py-4">
                <Spinner size={20} />
              </div>
            ) : matches.length === 0 ? (
              <p className="p-2 text-[15px] text-secondary">No friends found</p>
            ) : (
              matches.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => {
                    setQ("");
                    void hide({ personId: f._id });
                  }}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-hover"
                >
                  <Avatar src={f.avatar} size={36} />
                  <span className="font-medium text-[15px] text-primary">{f.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col">
        {people === undefined ? (
          <div className="flex justify-center py-4">
            <Spinner size={20} />
          </div>
        ) : people.length === 0 ? (
          <p className="py-4 text-center text-[15px] text-secondary">
            You haven't hidden anyone from your memories.
          </p>
        ) : (
          people.map((p) => (
            <div key={p._id} className="-mx-2 flex items-center gap-3 rounded-lg p-2">
              <Avatar src={p.user.avatar} size={40} />
              <span className="min-w-0 flex-1 truncate font-medium text-[15px] text-primary">
                {p.user.name}
              </span>
              <Button variant="secondary" onClick={() => void unhide({ hideId: p._id })}>
                Unhide
              </Button>
            </div>
          ))
        )}
      </div>
    </Pane>
  );
}

type HiddenDates = { _id: Id<"memoryHides">; start: string; end: string };

function HideDatesPane({ dates }: { dates: HiddenDates[] | undefined }) {
  const unhide = useM(api.memories.unhide);
  const [adding, setAdding] = useState(false);
  return (
    <Pane title="Hide Dates" description="We won't show you memories from the dates you choose.">
      <Button variant="soft" onClick={() => setAdding(true)}>
        Add dates
      </Button>
      <div className="mt-3 flex flex-col">
        {dates === undefined ? (
          <div className="flex justify-center py-4">
            <Spinner size={20} />
          </div>
        ) : dates.length === 0 ? (
          <p className="py-4 text-center text-[15px] text-secondary">
            You haven't hidden any dates from your memories.
          </p>
        ) : (
          dates.map((d) => (
            <div key={d._id} className="-mx-2 flex items-center gap-3 rounded-lg p-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                <HideDatesGlyph />
              </span>
              <span className="min-w-0 flex-1 font-medium text-[15px] text-primary">
                {d.start === d.end ? fmtDay(d.start) : `${fmtDay(d.start)} – ${fmtDay(d.end)}`}
              </span>
              <Button variant="secondary" onClick={() => void unhide({ hideId: d._id })}>
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
      {adding && <HideDatesDialog onClose={() => setAdding(false)} />}
    </Pane>
  );
}

function HideDatesDialog({ onClose }: { onClose: () => void }) {
  const hideDates = useM(api.memories.hideDates);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = start !== "" && end !== "" && start <= end;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await hideDates({ start, end });
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Hide dates" width={548}>
      <form onSubmit={submit} className="p-4">
        <p className="text-[15px] text-secondary leading-5">
          Choose the dates you don't want to see in your memories.
        </p>
        <div className="mt-3 flex gap-3">
          <FloatingField label="Start date" value={start} pinned className="flex-1">
            {(id) => (
              <input
                id={id}
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (!end || e.target.value > end) setEnd(e.target.value);
                }}
                className={floatingInputCls}
              />
            )}
          </FloatingField>
          <FloatingField label="End date" value={end} pinned className="flex-1">
            {(id) => (
              <input
                id={id}
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                className={floatingInputCls}
              />
            )}
          </FloatingField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" className="text-link!" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="min-w-[96px]"
            disabled={!valid || busy}
          >
            {busy ? <Spinner size={16} className="text-white" /> : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Glyphs ---------------- */

function HomeGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M9.08 1.9a1.4 1.4 0 0 1 1.84 0l7.2 6.3c.6.53.23 1.52-.57 1.52H16.5v6.78c0 .97-.78 1.75-1.75 1.75H12.5v-4.5a1.25 1.25 0 0 0-1.25-1.25h-2.5A1.25 1.25 0 0 0 7.5 13.75v4.5H5.25c-.97 0-1.75-.78-1.75-1.75V9.72h-1.05c-.8 0-1.17-1-.57-1.52l7.2-6.3Z" />
    </svg>
  );
}

/** Filled calendar square with an X cut out, Facebook's Hide Dates icon. */
function HideDatesGlyph() {
  const id = useId();
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <mask id={id}>
        <rect width="20" height="20" fill="#fff" />
        <rect x="6" y="5.25" width="8" height="1.6" rx=".8" fill="#000" />
        <path
          d="m7.25 9.5 5.5 5.5m0-5.5-5.5 5.5"
          stroke="#000"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </mask>
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="3.5"
        fill="currentColor"
        mask={`url(#${id})`}
      />
    </svg>
  );
}

/** Coral photo-frames banner from Facebook's Memories empty state. */
function MemoriesBanner() {
  return (
    <svg
      viewBox="0 0 680 128"
      className="block h-[128px] w-full"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="680" height="108" fill="#FF7A6B" />
      <rect y="108" width="680" height="20" fill="var(--card)" />
      {/* pencil */}
      <path d="M12 26 L52 116" stroke="#1877F2" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 112 L56 124" stroke="#FFB4AB" strokeWidth="6" strokeLinecap="round" />
      {/* mug frame */}
      <rect x="44" y="16" width="86" height="64" fill="#fff" />
      <rect x="52" y="22" width="70" height="52" fill="#1877F2" />
      <path d="M62 34h22v20a11 11 0 0 1-22 0Z" fill="#fff" />
      <circle cx="96" cy="50" r="10" fill="#E8412F" />
      {/* portrait frame */}
      <rect x="168" y="30" width="100" height="92" fill="#FFB4AB" />
      <rect x="162" y="26" width="100" height="90" fill="#fff" />
      <rect x="170" y="34" width="84" height="70" fill="#E8412F" />
      <circle cx="226" cy="66" r="26" fill="#111" />
      <circle cx="194" cy="76" r="14" fill="#FFDBD5" />
      <path d="M178 70a16 14 0 0 1 32-6Z" fill="#1877F2" />
      <circle cx="226" cy="80" r="14" fill="#C2402F" />
      {/* heart */}
      <path
        d="M286 96c-8-8-20-14-14-24 4-6 11-4 14 1 3-5 10-7 14-1 6 10-6 16-14 24Z"
        fill="#C9271B"
      />
      {/* hand + dog frame */}
      <rect x="320" y="0" width="100" height="74" fill="#fff" />
      <rect x="328" y="6" width="84" height="62" fill="#FFB4AB" />
      <path d="M352 6c10 16 24 30 40 40l-6 8c-18-8-32-24-44-44Z" fill="#B23A2B" />
      <rect x="372" y="62" width="60" height="58" fill="#FFB4AB" />
      <rect x="366" y="58" width="58" height="56" fill="#fff" />
      <path d="M374 66h40v40h-34c4-8 2-20-6-26Z" fill="#E8412F" />
      <path d="M380 72c8 4 14 16 12 30h-12Z" fill="#1877F2" />
      {/* flower */}
      <path d="M450 50c6 18 10 34 4 52" stroke="#111" strokeWidth="3" fill="none" />
      <circle cx="450" cy="46" r="7" fill="#fff" />
      <path d="M454 76c10-6 18-4 20 4-8 4-14 2-20-4Z" fill="#111" />
      {/* bird frame */}
      <rect x="492" y="0" width="64" height="48" fill="#fff" />
      <rect x="498" y="4" width="52" height="40" fill="#FFB4AB" />
      <path d="M504 18c14-6 26 0 34 16l10 2-12 4c-12 0-22-8-32-22Z" fill="#111" />
      {/* landscape frame */}
      <rect x="548" y="44" width="124" height="84" fill="#FFB4AB" />
      <rect x="540" y="38" width="124" height="82" fill="#fff" />
      <rect x="548" y="46" width="108" height="66" fill="#1877F2" />
      <circle cx="616" cy="86" r="16" fill="#FFB4AB" />
      <path d="M548 90c20-16 40-10 56 4 18-14 36-12 52-4v22H548Z" fill="#C9271B" />
      <path d="M584 60l6 6 6-6M640 18l6 4 6-4" stroke="#111" strokeWidth="2" fill="none" />
    </svg>
  );
}

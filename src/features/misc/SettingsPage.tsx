import { Link, useNavigate } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronRight,
  CircleUser,
  Clapperboard,
  Clock,
  Cookie,
  CreditCard,
  FileText,
  Film,
  Globe,
  Image,
  KeyRound,
  Languages,
  LayoutGrid,
  Lock,
  type LucideIcon,
  Megaphone,
  Moon,
  Newspaper,
  Puzzle,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  SmilePlus,
  Tag,
  UserRoundSearch,
  Users,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { type ThemeSetting, useTheme } from "@/app/theme";
import { useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Avatar, Card } from "@/ui/primitives";
import { MetaInfinity } from "./icons";
import {
  ActivityLogArt,
  BlockingArt,
  DarkModeArt,
  HelpCenterArt,
  PrivacyCenterArt,
} from "./settingsIllustrations";

/* ---------- Navigation model ---------- */

type Item = { id: string; label: string; Icon: LucideIcon; description: string };
type Section = { title: string; description?: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Tools and resources",
    description: "Our tools help you control and manage your privacy.",
    items: [
      {
        id: "privacy-checkup",
        label: "Privacy Checkup",
        Icon: ShieldCheck,
        description:
          "Review important privacy settings to make sure you're sharing with who you want.",
      },
      {
        id: "family-center",
        label: "Family Center",
        Icon: UsersRound,
        description: "Supervision tools and expert resources for parents and teens.",
      },
      {
        id: "default-audience",
        label: "Default audience settings",
        Icon: Users,
        description: "Choose who can see what you share by default.",
      },
    ],
  },
  {
    title: "Preferences",
    description: "Customize your experience on Facebook.",
    items: [
      {
        id: "reaction-preferences",
        label: "Reaction preferences",
        Icon: SmilePlus,
        description: "Choose whether to see the number of reactions on posts.",
      },
      {
        id: "notifications",
        label: "Notifications",
        Icon: Bell,
        description: "Choose which notifications you get and how you get them.",
      },
      {
        id: "accessibility",
        label: "Accessibility",
        Icon: Accessibility,
        description: "Adjust settings that make Facebook easier to use.",
      },
      {
        id: "language",
        label: "Language and region",
        Icon: Languages,
        description: "Choose the language Facebook uses and how translations work.",
      },
      {
        id: "media",
        label: "Media",
        Icon: Image,
        description: "Control video quality and autoplay.",
      },
      {
        id: "dark-mode",
        label: "Dark mode",
        Icon: Moon,
        description:
          "Adjust the appearance of Facebook to reduce glare and give your eyes a break.",
      },
    ],
  },
  {
    title: "Audience and visibility",
    description: "Control who can see what you share on Facebook.",
    items: [
      {
        id: "profile-details",
        label: "Profile details",
        Icon: CircleUser,
        description: "Choose who can see details on your profile.",
      },
      {
        id: "find-contact",
        label: "How people find and contact you",
        Icon: UserRoundSearch,
        description: "Choose who can send you friend requests and look you up.",
      },
      {
        id: "posts",
        label: "Posts",
        Icon: Newspaper,
        description: "Control who can see and share your posts.",
      },
      {
        id: "stories",
        label: "Stories",
        Icon: Clock,
        description: "Choose who can see and reply to your stories.",
      },
      {
        id: "reels",
        label: "Reels",
        Icon: Clapperboard,
        description: "Choose who can remix and download your reels.",
      },
      {
        id: "followers",
        label: "Followers and public content",
        Icon: Globe,
        description: "Choose who can follow you and comment on your public posts.",
      },
      {
        id: "tagging",
        label: "Profile and tagging",
        Icon: Tag,
        description: "Review tags before they appear and choose who can post on your profile.",
      },
      {
        id: "blocking",
        label: "Blocking",
        Icon: Ban,
        description: "Review people you've previously blocked or add someone to your blocked list.",
      },
    ],
  },
  {
    title: "Payments",
    description: "Manage your payment info and activity.",
    items: [
      {
        id: "ads-payments",
        label: "Ads payments",
        Icon: CreditCard,
        description: "Manage payment methods and billing for ads.",
      },
    ],
  },
  {
    title: "Your activity",
    description: "Review your activity and content you're tagged in.",
    items: [
      {
        id: "activity-log",
        label: "Activity log",
        Icon: CalendarDays,
        description: "View and manage your activity on Facebook.",
      },
      {
        id: "apps",
        label: "Apps and websites",
        Icon: LayoutGrid,
        description:
          "Manage the info you share with apps and websites you've logged into with Facebook.",
      },
      {
        id: "business",
        label: "Business integrations",
        Icon: Briefcase,
        description: "Manage business integrations connected to your account.",
      },
      {
        id: "learn",
        label: "Learn how to manage your information",
        Icon: BookOpen,
        description: "Find out how to download, transfer and delete your information.",
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        id: "journalist",
        label: "Journalist resources",
        Icon: Megaphone,
        description: "Safety and security tools for journalists.",
      },
      {
        id: "standards-legal",
        label: "Community Standards and legal policies",
        Icon: Scale,
        description: "Our policies and the terms you agreed to.",
      },
      {
        id: "terms",
        label: "Terms of Service",
        Icon: FileText,
        description: "The terms that govern your use of Facebook.",
      },
      {
        id: "privacy-policy",
        label: "Privacy Policy",
        Icon: Lock,
        description: "How we collect, use and share your information.",
      },
      {
        id: "cookies",
        label: "Cookies policy",
        Icon: Cookie,
        description: "How we use cookies and similar technologies.",
      },
      {
        id: "standards",
        label: "Community Standards",
        Icon: Shield,
        description: "What is and isn't allowed on Facebook.",
      },
    ],
  },
];

const ALL_ITEMS: Item[] = [
  {
    id: "accounts-center",
    label: "Meta Account",
    Icon: KeyRound,
    description:
      "Password, security, personal details, cross-profile experiences, ad preferences, verification",
  },
  ...SECTIONS.flatMap((s) => s.items),
];
export const SETTINGS_TABS = ALL_ITEMS.map((i) => i.id);
const byId = new Map(ALL_ITEMS.map((i) => [i.id, i]));

/* ---------- Page ---------- */

/** /settings — Settings & privacy. `tab` picks the pane; none shows the landing. */
export function SettingsPage({ tab }: { tab?: string }) {
  const navigate = useNavigate();
  const [railQ, setRailQ] = useState("");
  const open = (id?: string) => void navigate({ to: "/settings", search: { tab: id } });
  const current = tab ? byId.get(tab) : undefined;

  const filtered = useMemo(() => {
    const q = railQ.trim().toLowerCase();
    if (!q) return null;
    return ALL_ITEMS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }, [railQ]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <nav
        aria-label="Navigation within settings"
        className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_0_var(--shadow-1)] min-[900px]:flex"
      >
        <div className="px-4 pt-[11px] pb-2">
          <h1 className="font-bold text-[24px] text-primary leading-7">Settings &amp; privacy</h1>
        </div>
        <label className="mx-4 mb-2 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-input pr-2 pl-2.5">
          <Search size={16} strokeWidth={2.5} className="text-icon-secondary" />
          <input
            value={railQ}
            onChange={(e) => setRailQ(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-4 pb-6">
          {filtered ? (
            filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[15px] text-secondary">No results found</p>
            ) : (
              filtered.map((i) => (
                <RailRow key={i.id} item={i} active={tab === i.id} onClick={() => open(i.id)} />
              ))
            )
          ) : (
            <>
              <h2 className="px-3 pb-3 font-bold text-[20px] text-primary leading-6">
                Settings &amp; privacy
              </h2>
              <h2 className="px-3 font-bold text-[20px] text-primary leading-6">Your account</h2>
              <button
                type="button"
                onClick={() => open("accounts-center")}
                className={cn(
                  "mt-1 mb-4 flex w-full gap-3 rounded-lg px-3 py-2 text-left",
                  tab === "accounts-center" ? "bg-wash dark:bg-hover" : "hover:bg-hover",
                )}
              >
                <MetaInfinity className="mt-0.5 shrink-0 text-icon" />
                <span>
                  <span className="block text-[17px] text-primary leading-5">Meta Account</span>
                  <span className="block text-[15px] text-primary leading-5">
                    Password, security, personal details, cross-profile experiences, ad preferences,
                    verification
                  </span>
                </span>
              </button>
              {SECTIONS.map((s) => (
                <div key={s.title} className="pb-4">
                  <h2 className="px-3 font-bold text-[20px] text-primary leading-6">{s.title}</h2>
                  {s.description && (
                    <p className="px-3 pt-1 pb-2 text-[17px] text-secondary leading-5">
                      {s.description}
                    </p>
                  )}
                  {s.items.map((i) => (
                    <RailRow key={i.id} item={i} active={tab === i.id} onClick={() => open(i.id)} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </nav>

      <main className="flex min-w-0 flex-1 justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-[930px]">
          {current ? (
            <Pane item={current} onBack={() => open(undefined)} />
          ) : (
            <Landing onOpen={open} />
          )}
        </div>
      </main>
    </div>
  );
}

function RailRow({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
        active ? "bg-wash dark:bg-hover" : "hover:bg-hover",
      )}
    >
      <item.Icon size={24} strokeWidth={1.8} className="shrink-0 text-icon" />
      <span className="font-medium text-[17px] text-primary leading-5">{item.label}</span>
    </button>
  );
}

/* ---------- Landing ---------- */

function Landing({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const results = q.trim()
    ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  return (
    <>
      <Card className="rounded-xl px-10 py-4">
        <h2 className="pt-6 pb-1 font-bold text-[20px] text-primary leading-6">
          Find the setting you need
        </h2>
        <label className="relative flex h-9 items-center gap-2 rounded-full bg-input px-2">
          <Search size={24} strokeWidth={2} className="text-icon" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
        {results.length > 0 && (
          <div className="mt-2 flex flex-col">
            {results.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onOpen(i.id)}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
              >
                <i.Icon size={20} className="text-icon" />
                <span className="font-medium text-[15px] text-primary">{i.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="h-4" />
      </Card>

      <div className="mt-4 rounded-xl bg-card px-10 py-4">
        <h2 className="pt-6 pb-3 font-bold text-[20px] text-primary leading-6">
          Most visited settings
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Tile
            art={<BlockingArt />}
            title="Blocking"
            body="Review people you've previously blocked or add someone to your blocked list."
            onClick={() => onOpen("blocking")}
          />
          <Tile
            art={<ActivityLogArt />}
            title="Activity log"
            body="View and manage your activity on Facebook."
            onClick={() => onOpen("activity-log")}
          />
          <Tile art={<DarkModeArt />} title="Dark mode" onClick={() => onOpen("dark-mode")} />
        </div>
        <h2 className="pt-8 pb-3 font-bold text-[20px] text-primary leading-6">
          Looking for something else?
        </h2>
        <div className="flex flex-col gap-4 pb-6">
          <WideRow
            art={<PrivacyCenterArt />}
            title="Privacy Center"
            body="Learn how to manage and control your privacy across Meta products."
            onClick={() => onOpen("privacy-checkup")}
          />
          <WideRow
            art={<HelpCenterArt />}
            title="Facebook Help Center"
            body="Learn more about our updated settings experience on Facebook."
            onClick={() => onOpen("learn")}
          />
        </div>
      </div>
    </>
  );
}

function Tile({
  art,
  title,
  body,
  onClick,
}: {
  art: ReactNode;
  title: string;
  body?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[282px] flex-col rounded-xl bg-wash px-4 pt-6 text-left transition-[filter] hover:brightness-[0.97] dark:hover:brightness-125"
    >
      <span className="mx-auto">{art}</span>
      <span className="mt-12 block font-semibold text-[17px] text-primary leading-5">{title}</span>
      {body && <span className="mt-1 block text-[15px] text-secondary leading-5">{body}</span>}
    </button>
  );
}

function WideRow({
  art,
  title,
  body,
  onClick,
}: {
  art: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[140px] items-center gap-8 rounded-xl bg-wash px-8 text-left transition-[filter] hover:brightness-[0.97] dark:hover:brightness-125"
    >
      {art}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[17px] text-primary leading-5">{title}</span>
        <span className="block text-[15px] text-primary leading-5">{body}</span>
      </span>
      <ArrowRight size={24} className="mr-8 shrink-0 text-icon" />
    </button>
  );
}

/* ---------- Panes ---------- */

function Pane({ item, onBack }: { item: Item; onBack: () => void }) {
  return (
    <Card className="rounded-xl px-10 py-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-3 flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[15px] text-secondary hover:bg-hover"
      >
        <ArrowLeft size={18} /> Settings &amp; privacy
      </button>
      <h2 className="font-bold text-[24px] text-primary leading-7">{item.label}</h2>
      <p className="mt-1 mb-6 text-[15px] text-secondary leading-5">{item.description}</p>
      <PaneBody id={item.id} />
    </Card>
  );
}

function PaneBody({ id }: { id: string }) {
  switch (id) {
    case "accounts-center":
      return <AccountsCenter />;
    case "dark-mode":
      return <DarkModePane />;
    case "notifications":
      return (
        <Toggles
          group="notifications"
          rows={[
            ["Comments", "Notifications for comments on your posts and replies to your comments."],
            ["Tags", "Notifications when you're tagged by a friend."],
            ["Reminders", "Notifications to remind you of updates you may have missed."],
            [
              "Activity about you",
              "Notifications for posts on your profile, likes and other reactions.",
            ],
            ["Updates from friends", "Notifications about updates from friends."],
            ["Friend requests", "Notifications when someone sends you a friend request."],
            ["People you may know", "Notifications about people you may know."],
            ["Birthdays", "Notifications about friends' birthdays."],
            ["Groups", "Notifications about activity in groups you're in."],
            ["Video", "Notifications about videos from people and Pages you follow."],
            ["Events", "Notifications about events you're invited to or interested in."],
            ["Pages you follow", "Notifications about updates from Pages you follow."],
            ["Marketplace", "Notifications about listings, messages and saved items."],
            ["Fundraisers and crises", "Notifications about fundraisers and crisis response."],
          ]}
        />
      );
    case "reaction-preferences":
      return (
        <Toggles
          group="reactions"
          defaultOff
          rows={[
            ["On posts from others", "Hide the number of reactions on posts from other people."],
            ["On your posts", "Hide the number of reactions on your own posts."],
          ]}
        />
      );
    case "accessibility":
      return (
        <Choice
          group="accessibility-compact"
          title="Compact mode"
          options={["Off", "On"]}
          hint="Make your font size smaller so more content can fit on the screen."
        />
      );
    case "language":
      return (
        <div className="flex flex-col gap-5">
          <Choice
            group="language"
            title="Facebook language"
            options={[
              "English (US)",
              "English (UK)",
              "Español",
              "Français (France)",
              "Tiếng Việt",
              "中文(简体)",
            ]}
            select
          />
          <Choice
            group="translate"
            title="Posts from friends and Pages"
            options={["Translate posts into English (US)", "Don't translate"]}
          />
          <Choice
            group="region"
            title="Region format"
            options={["English (US)", "English (UK)"]}
            select
          />
        </div>
      );
    case "media":
      return (
        <div className="flex flex-col gap-5">
          <Choice
            group="video-quality"
            title="Video default quality"
            options={["Default", "SD only", "HD if available"]}
          />
          <Choice
            group="autoplay"
            title="Autoplay videos"
            options={["On", "Off", "On Wi-Fi only"]}
          />
        </div>
      );
    case "default-audience":
    case "posts":
      return (
        <div className="flex flex-col gap-5">
          <Choice
            group="future-posts"
            title="Who can see your future posts?"
            options={["Public", "Friends", "Friends except...", "Only me"]}
            select
            initial="Friends"
          />
          <Choice
            group="share-posts"
            title="Allow others to share your posts to their stories?"
            options={["On", "Off"]}
          />
        </div>
      );
    case "profile-details":
    case "find-contact":
      return (
        <div className="flex flex-col gap-5">
          <Choice
            group="friend-requests"
            title="Who can send you friend requests?"
            options={["Everyone", "Friends of friends"]}
            select
          />
          <Choice
            group="friends-list"
            title="Who can see your friends list?"
            options={["Public", "Friends", "Only me"]}
            select
            initial="Friends"
          />
          <Choice
            group="lookup-email"
            title="Who can look you up using the email address you provided?"
            options={["Everyone", "Friends of friends", "Friends", "Only me"]}
            select
          />
        </div>
      );
    case "stories":
      return (
        <Choice
          group="stories"
          title="Who can see your stories?"
          options={["Public", "Friends", "Custom"]}
          select
          initial="Friends"
        />
      );
    case "reels":
      return (
        <Toggles
          group="reels"
          rows={[
            ["Allow people to remix your reels", "People can use your reels in their own remixes."],
            ["Allow people to download your reels", "People can download your public reels."],
          ]}
        />
      );
    case "followers":
      return (
        <div className="flex flex-col gap-5">
          <Choice
            group="who-follow"
            title="Who can follow me"
            options={["Public", "Friends"]}
            select
            initial="Public"
          />
          <Choice
            group="public-comments"
            title="Who can comment on your public posts?"
            options={["Public", "Friends of friends", "Friends"]}
            select
          />
        </div>
      );
    case "tagging":
      return (
        <Toggles
          group="tagging"
          defaultOff
          rows={[
            [
              "Review posts you're tagged in before they appear on your profile",
              "Tag review lets you approve or dismiss tags.",
            ],
            [
              "Review tags people add to your posts",
              "When this is on, you can approve tags before they appear.",
            ],
          ]}
        />
      );
    case "blocking":
      return <BlockingPane />;
    case "activity-log":
      return <ActivityPane />;
    default:
      return (
        <p className="rounded-lg bg-wash px-4 py-6 text-[15px] text-secondary">
          There's nothing to change here right now.
        </p>
      );
  }
}

/** Settings choices are remembered per browser (a convenience, not account data). */
function useStoredChoice(key: string, initial: string) {
  const full = `fb-clone:setting:${key}`;
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(full) ?? initial;
    } catch {
      return initial;
    }
  });
  return [
    value,
    (v: string) => {
      setValue(v);
      try {
        localStorage.setItem(full, v);
      } catch {
        // Not persisted; applies for this visit.
      }
    },
  ] as const;
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-fb" : "bg-[#8f9297]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function ToggleRow({
  group,
  title,
  sub,
  defaultOff,
}: {
  group: string;
  title: string;
  sub: string;
  defaultOff?: boolean;
}) {
  const [v, set] = useStoredChoice(`${group}:${title}`, defaultOff ? "off" : "on");
  return (
    <div className="flex items-center gap-4 border-divider border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[15px] text-primary">{title}</p>
        <p className="text-[13px] text-secondary">{sub}</p>
      </div>
      <Switch on={v === "on"} onChange={(on) => set(on ? "on" : "off")} label={title} />
    </div>
  );
}

function Toggles({
  group,
  rows,
  defaultOff,
}: {
  group: string;
  rows: [string, string][];
  defaultOff?: boolean;
}) {
  return (
    <div className="rounded-lg border border-divider px-4">
      {rows.map(([t, s]) => (
        <ToggleRow key={t} group={group} title={t} sub={s} defaultOff={defaultOff} />
      ))}
    </div>
  );
}

function Choice({
  group,
  title,
  options,
  hint,
  select,
  initial,
}: {
  group: string;
  title: string;
  options: string[];
  hint?: string;
  select?: boolean;
  initial?: string;
}) {
  const [v, set] = useStoredChoice(group, initial ?? options[0]);
  return (
    <div>
      <p className="font-semibold text-[17px] text-primary">{title}</p>
      {hint && <p className="text-[13px] text-secondary">{hint}</p>}
      {select ? (
        <select
          value={v}
          onChange={(e) => set(e.target.value)}
          aria-label={title}
          className="mt-2 h-9 rounded-md bg-btn px-3 font-semibold text-[15px] text-primary outline-none"
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <div className="mt-1 flex flex-col">
          {options.map((o) => (
            <label
              key={o}
              className="-mx-2 flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-hover"
            >
              <span className="font-medium text-[15px] text-primary">{o}</span>
              <input
                type="radio"
                name={group}
                checked={v === o}
                onChange={() => set(o)}
                className="h-5 w-5 accent-[var(--fb-blue)]"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function DarkModePane() {
  const { setting, setSetting } = useTheme();
  const options: [ThemeSetting, string, string?][] = [
    ["light", "Off"],
    ["dark", "On"],
    [
      "auto",
      "Automatic",
      "We'll automatically adjust the display based on your device's system settings.",
    ],
  ];
  return (
    <div role="radiogroup" aria-label="Dark mode" className="flex flex-col">
      {options.map(([value, label, sub]) => (
        <label
          key={value}
          className="-mx-2 flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-hover"
        >
          <span>
            <span className="block font-medium text-[15px] text-primary">{label}</span>
            {sub && <span className="block text-[13px] text-secondary">{sub}</span>}
          </span>
          <input
            type="radio"
            name="settings-theme"
            checked={setting === value}
            onChange={() => setSetting(value)}
            className="h-5 w-5 accent-[var(--fb-blue)]"
          />
        </label>
      ))}
    </div>
  );
}

function AccountsCenter() {
  const viewer = useViewer();
  const [open, setOpen] = useState<string | null>(null);
  const rows: { id: string; label: string; Icon: LucideIcon; body: ReactNode }[] = [
    {
      id: "personal",
      label: "Personal details",
      Icon: CircleUser,
      body: (
        <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-[15px]">
          <dt className="text-secondary">Name</dt>
          <dd className="text-primary">{viewer.name}</dd>
          <dt className="text-secondary">Username</dt>
          <dd className="text-primary">{viewer.username}</dd>
          <dt className="text-secondary">Birthday</dt>
          <dd className="text-primary">
            {viewer.birthday ? formatBirthday(viewer.birthday) : "Not added"}
          </dd>
          <dt className="text-secondary">Current city</dt>
          <dd className="text-primary">{viewer.city ?? "Not added"}</dd>
        </dl>
      ),
    },
    {
      id: "password",
      label: "Password and security",
      Icon: KeyRound,
      body: (
        <div className="flex flex-col">
          <ToggleRow
            group="security"
            title="Two-factor authentication"
            sub="Require a code when logging in from an unrecognized device."
            defaultOff
          />
          <ToggleRow
            group="security"
            title="Login alerts"
            sub="Get an alert when someone logs into your account from a new place."
          />
        </div>
      ),
    },
    {
      id: "info",
      label: "Your information and permissions",
      Icon: FileText,
      body: (
        <p className="text-[15px] text-secondary">
          Access, download or transfer your information, and manage how it's used to personalize
          your experience.
        </p>
      ),
    },
    {
      id: "ads",
      label: "Ad preferences",
      Icon: Megaphone,
      body: (
        <Toggles
          group="ad-prefs"
          rows={[
            [
              "Ads about topics you've shown interest in",
              "Use your activity to show more relevant ads.",
            ],
            ["Ads from partners", "Use info from partners about your activity."],
          ]}
        />
      ),
    },
    {
      id: "payments",
      label: "Payments",
      Icon: CreditCard,
      body: <p className="text-[15px] text-secondary">No payment methods added.</p>,
    },
    {
      id: "verified",
      label: "Meta Verified",
      Icon: ShieldCheck,
      body: (
        <p className="text-[15px] text-secondary">
          Get a verified badge, account protection and direct support.
        </p>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="pb-2 font-semibold text-[17px] text-primary">Profiles</p>
        <Link
          to="/$username"
          params={{ username: viewer.username }}
          className="flex items-center gap-3 rounded-lg border border-divider px-4 py-3 hover:bg-hover"
        >
          <Avatar src={viewer.avatar} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[15px] text-primary">{viewer.name}</span>
            <span className="block text-[13px] text-secondary">Facebook</span>
          </span>
          <ChevronRight size={20} className="text-icon-secondary" />
        </Link>
      </div>
      <div>
        <p className="pb-2 font-semibold text-[17px] text-primary">Account settings</p>
        <div className="overflow-hidden rounded-lg border border-divider">
          {rows.map((r) => (
            <div key={r.id} className="border-divider border-b last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
                aria-expanded={open === r.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover"
              >
                <r.Icon size={20} className="text-icon" />
                <span className="flex-1 font-medium text-[15px] text-primary">{r.label}</span>
                <ChevronRight
                  size={20}
                  className={cn(
                    "text-icon-secondary transition-transform",
                    open === r.id && "rotate-90",
                  )}
                />
              </button>
              {open === r.id && <div className="px-4 pt-1 pb-4">{r.body}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatBirthday(mmdd: string) {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function BlockingPane() {
  const [q, setQ] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-divider p-4">
        <p className="font-semibold text-[17px] text-primary">Blocked profiles and Pages</p>
        <p className="mt-1 text-[15px] text-secondary">
          Once you block someone, they can no longer see things you post on your profile, tag you,
          invite you to events or groups, start a conversation with you, or add you as a friend.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name"
          aria-label="Search people to block"
          className="mt-3 h-9 w-full rounded-full bg-input px-4 text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
        <p className="mt-4 text-center text-[15px] text-secondary">You haven't blocked anyone.</p>
      </div>
    </div>
  );
}

function ActivityPane() {
  const viewer = useViewer();
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: "Your posts", Icon: Newspaper, to: "/$username" as const },
        { label: "Photos and videos", Icon: Film, to: "/$username/photos" as const },
        { label: "Saved items", Icon: Puzzle, to: "/saved" as const },
      ].map(({ label, Icon, to }) => (
        <Link
          key={label}
          to={to}
          params={{ username: viewer.username }}
          className="flex items-center gap-3 rounded-lg border border-divider px-4 py-3 hover:bg-hover"
        >
          <Icon size={20} className="text-icon" />
          <span className="flex-1 font-medium text-[15px] text-primary">{label}</span>
          <ChevronRight size={20} className="text-icon-secondary" />
        </Link>
      ))}
    </div>
  );
}

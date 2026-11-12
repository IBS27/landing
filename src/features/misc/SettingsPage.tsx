import { useNavigate } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  CircleUser,
  Clapperboard,
  Clock,
  Cookie,
  CreditCard,
  FileText,
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
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { MetaInfinity } from "./icons";
import { PaneBody } from "./settings/panes";
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

  // Keep the selected row in view inside the rail's own scroller (never the window), like
  // Facebook does when a setting is opened from a link further down the list.
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = rail.current;
    if (!box || !tab || filtered) return;
    const row = box.querySelector<HTMLElement>("[aria-current=page]");
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) return;
    box.scrollTop = top - (box.clientHeight - row.offsetHeight) / 2;
  }, [tab, filtered]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <nav
        aria-label="Navigation within settings"
        className="sticky top-14 hidden h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_0_var(--shadow-1)] min-[900px]:flex"
      >
        <div className="px-4 pt-[15px] pb-[19px]">
          <h1 className="font-bold text-[24px] text-primary leading-7">Settings &amp; privacy</h1>
        </div>
        {/* Opaque strip below the box so scrolled rail rows never butt against or peek under it. */}
        <div className="relative z-[1] shrink-0 bg-card px-4 pb-2">
          <label className="flex h-9 items-center gap-1.5 rounded-full bg-input pr-2 pl-2.5">
            <Search size={16} strokeWidth={2.5} className="text-icon-secondary" />
            <input
              value={railQ}
              onChange={(e) => setRailQ(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
        </div>
        <div ref={rail} className="relative min-h-0 flex-1 overflow-y-auto px-2 pt-[31px] pb-6">
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
              <h2 className="px-3 pb-[15px] font-bold text-[20px] text-primary leading-6">
                Settings &amp; privacy
              </h2>
              <h2 className="px-3 font-bold text-[20px] text-primary leading-6">Your account</h2>
              <button
                type="button"
                onClick={() => open("accounts-center")}
                aria-current={tab === "accounts-center" ? "page" : undefined}
                className={cn(
                  "mb-[15px] flex w-full gap-3 rounded-lg px-3 pt-[7px] pb-2 text-left",
                  tab === "accounts-center" ? "bg-wash dark:bg-hover" : "hover:bg-hover",
                )}
              >
                <MetaInfinity className="mt-0.5 shrink-0 text-icon" />
                <span>
                  <span className="block text-[17px] text-primary leading-5">Meta Account</span>
                  <span className="mt-[2px] block text-[15px] text-primary leading-5">
                    Password, security, personal details, cross-profile experiences, ad preferences,
                    verification
                  </span>
                </span>
              </button>
              {SECTIONS.map((s) => (
                <div key={s.title} className="pb-[15px]">
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
        {/* The landing spans 930px; individual settings sit in Facebook's narrower 700px card. */}
        <div className={cn("w-full", current ? "max-w-[700px]" : "max-w-[930px]")}>
          {current ? (
            <Pane item={current} onBack={() => open(undefined)} onOpen={open} />
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
        "flex min-h-11 w-full items-center rounded-lg py-2 pr-3 pl-12 text-left",
        active ? "bg-wash dark:bg-hover" : "hover:bg-hover",
      )}
    >
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
      <Card className="rounded-xl px-10 pt-8 pb-[19px]">
        <h2 className="px-4 pb-[7px] font-bold text-[20px] text-primary leading-6">
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
      </Card>

      <div className="mt-[17px] rounded-xl bg-card px-10 pt-[27px] pb-4">
        <h2 className="px-4 pb-3 font-bold text-[20px] text-primary leading-6">
          Most visited settings
        </h2>
        <div className="grid grid-cols-3 gap-4 px-4">
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
        <h2 className="px-4 pt-8 pb-[19px] font-bold text-[20px] text-primary leading-6">
          Looking for something else?
        </h2>
        <div className="flex flex-col gap-4 px-4 pb-6">
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
      className="flex h-[282px] flex-col rounded-xl bg-wash px-4 pt-[31px] text-left transition-[filter] hover:brightness-[0.97] dark:hover:brightness-125"
    >
      <span className="mx-auto">{art}</span>
      <span className="mt-[35px] block font-semibold text-[17px] text-primary leading-5">
        {title}
      </span>
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

function Pane({
  item,
  onBack,
  onOpen,
}: {
  item: Item;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Card className="rounded-xl px-8 pt-6 pb-6">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-3 flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[15px] text-secondary hover:bg-hover min-[900px]:hidden"
      >
        <ArrowLeft size={18} /> Settings &amp; privacy
      </button>
      <div className="px-2 pb-3">
        <h2 className="font-bold text-[20px] text-primary leading-6">{item.label}</h2>
        {item.id !== "notifications" && item.id !== "reaction-preferences" && (
          <p className="pt-1 text-[15px] text-secondary leading-5">{item.description}</p>
        )}
      </div>
      <PaneBody key={item.id} id={item.id} onOpen={onOpen} />
    </Card>
  );
}

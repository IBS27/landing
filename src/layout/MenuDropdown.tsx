import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarPlus,
  Clapperboard,
  Flag,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  Search,
  ShoppingBag,
  SquarePen,
  Star,
  Users,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import {
  BmGamingVideo,
  BmInstagram,
  BmMessengerKids,
  BmNewsFeed,
  BmOrders,
  BmQuest,
  BmSupport,
  BmWhatsApp,
} from "@/features/misc/menuIcons";
import { CreatePostModal } from "@/features/posts";
import {
  BmAdsManager,
  BmEvents,
  BmFeeds,
  BmFriends,
  BmGaming,
  BmGroups,
  BmMarketplace,
  BmMemories,
  BmMetaAI,
  BmPages,
  BmRecent,
  BmReels,
  BmSaved,
  MenuGridIcon,
} from "@/icons";
import { PopoverPanel } from "@/ui/overlays";
import { HeaderButton } from "./HeaderButton";

type Entry = {
  title: string;
  description: string;
  Icon: ComponentType<{ size?: number }>;
  to?: string;
  /** Opens a Settings pane. */
  settingsTab?: string;
  href?: string;
};

/** Facebook's menu, in its 2025-26 order and copy. */
const SECTIONS: { title: string; items: Entry[] }[] = [
  {
    title: "Social",
    items: [
      {
        title: "Events",
        description: "Organize or find events and other things to do online and nearby.",
        Icon: BmEvents,
        to: "/events",
      },
      {
        title: "Friends",
        description: "Search for friends or people you may know.",
        Icon: BmFriends,
        to: "/friends",
      },
      {
        title: "Groups",
        description: "Connect with people who share your interests.",
        Icon: BmGroups,
        to: "/groups/feed",
      },
      {
        title: "News Feed",
        description: "See relevant posts from people and Pages you follow.",
        Icon: BmNewsFeed,
        to: "/",
      },
      {
        title: "Feeds",
        description: "See the most recent posts from your friends, groups, Pages and more.",
        Icon: BmFeeds,
        to: "/feeds",
      },
      {
        title: "Pages",
        description: "Discover and connect with businesses on Facebook.",
        Icon: BmPages,
        to: "/pages",
      },
    ],
  },
  {
    title: "Entertainment",
    items: [
      {
        title: "Reels",
        description: "A Reels destination personalized to your interests and connections.",
        Icon: BmReels,
        to: "/reel",
      },
      {
        title: "Gaming Video",
        description: "Watch and connect with your favorite games and streamers.",
        Icon: BmGamingVideo,
        to: "/watch",
      },
      {
        title: "Play games",
        description: "Play your favorite games.",
        Icon: BmGaming,
        to: "/gaming/play",
      },
    ],
  },
  {
    title: "Shopping",
    items: [
      {
        title: "Orders and payments",
        description: "A seamless, secure way to pay on the apps you already use.",
        Icon: BmOrders,
        settingsTab: "ads-payments",
      },
      {
        title: "Marketplace",
        description: "Buy and sell in your community.",
        Icon: BmMarketplace,
        to: "/marketplace",
      },
    ],
  },
  {
    title: "Personal",
    items: [
      {
        title: "Your Ad Activity",
        description: "See all the ads you interacted with on Facebook.",
        Icon: BmRecent,
        to: "/ads/activity",
      },
      {
        title: "Memories",
        description: "Browse your old photos, videos and posts on Facebook.",
        Icon: BmMemories,
        to: "/memories",
      },
      {
        title: "Saved",
        description: "Find posts, photos and videos that you saved for later.",
        Icon: BmSaved,
        to: "/saved",
      },
      {
        title: "Support",
        description: "Everything you need to identify issues and fix them faster.",
        Icon: BmSupport,
        settingsTab: "learn",
      },
    ],
  },
  {
    title: "Professional",
    items: [
      {
        title: "Ads Manager",
        description: "Create, manage and track the performance of your ads.",
        Icon: BmAdsManager,
        to: "/ads-manager",
      },
    ],
  },
  {
    title: "More from Meta",
    items: [
      {
        title: "Meta AI",
        description: "Ask questions, brainstorm ideas, create any image you can imagine and more.",
        Icon: BmMetaAI,
        to: "/meta-ai",
      },
      {
        title: "Messenger Kids",
        description: "Let kids message with close friends and family.",
        Icon: BmMessengerKids,
        href: "https://www.messengerkids.com/",
      },
      {
        title: "Meta Quest 3S",
        description: "Meta Quest 3 is now here",
        Icon: BmQuest,
        href: "https://www.meta.com/quest/",
      },
      {
        title: "WhatsApp",
        description: "Message and call people privately on your computer.",
        Icon: BmWhatsApp,
        href: "https://www.whatsapp.com/",
      },
      {
        title: "Instagram",
        description: "See everyday moments from people you love.",
        Icon: BmInstagram,
        href: "https://www.instagram.com/",
      },
    ],
  },
];

type CreateItem = { label: string; icon: ReactNode; to?: string; composer?: boolean };
const ic = { size: 20, strokeWidth: 2.2 };
const CREATE: CreateItem[] = [
  { label: "Post", icon: <SquarePen {...ic} />, composer: true },
  { label: "Story", icon: <BookOpen {...ic} />, to: "/stories/create" },
  { label: "Reel", icon: <Clapperboard {...ic} />, to: "/reel" },
  { label: "Life update", icon: <Star {...ic} />, composer: true },
  { label: "Note", icon: <MessageCircle {...ic} />, to: "/messages" },
];
const CREATE_MORE: CreateItem[] = [
  { label: "Page", icon: <Flag {...ic} />, to: "/pages" },
  { label: "Ad", icon: <Megaphone {...ic} />, to: "/ads-manager" },
  { label: "Group", icon: <Users {...ic} />, to: "/groups/create" },
  { label: "Event", icon: <CalendarPlus {...ic} />, to: "/events/create" },
  { label: "Marketplace listing", icon: <ShoppingBag {...ic} />, to: "/marketplace/create" },
  { label: "Fundraiser", icon: <HeartHandshake {...ic} />, to: "/fundraisers" },
];

const ITEM = "flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-hover";

export function MenuDropdown() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [composer, setComposer] = useState(false);
  const needle = q.trim().toLowerCase();
  const match = (e: Entry) =>
    !needle ||
    e.title.toLowerCase().includes(needle) ||
    e.description.toLowerCase().includes(needle);
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter(match) })).filter(
    (s) => s.items.length > 0,
  );
  const close = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <PopoverPanel
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        width={608}
        // Header popovers share a right edge 16px from the viewport (the account button's edge).
        alignOffset={-144}
        trigger={
          <HeaderButton label="Menu" active={open}>
            <MenuGridIcon size={20} />
          </HeaderButton>
        }
      >
        <div className="flex h-[calc(100vh-72px)] max-h-[828px] min-h-0 flex-col bg-wash">
          <h2 className="px-4 pt-4 pb-[18px] font-bold text-[24px] text-primary leading-7">Menu</h2>
          <div className="flex min-h-0 flex-1 items-start gap-4 overflow-y-auto px-4 pb-4">
            <div className="w-[360px] shrink-0 rounded-xl bg-card px-2 pt-4 pb-2 shadow-base">
              <label className="mx-2 mb-2 flex h-9 items-center gap-2 rounded-full bg-input px-3">
                <Search size={16} strokeWidth={2.5} className="shrink-0 text-icon-secondary" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search menu"
                  aria-label="Search menu"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
                />
              </label>
              {sections.length === 0 && (
                <p className="px-2 py-6 text-center text-[15px] text-secondary">No results</p>
              )}
              {sections.map((sec, i) => (
                <section key={sec.title}>
                  {i > 0 && <div className="mx-2 my-2 h-px bg-divider" />}
                  <h3 className="px-2 pt-3 pb-2 font-semibold text-[17px] text-primary leading-5">
                    {sec.title}
                  </h3>
                  {sec.items.map((e) => {
                    const inner = (
                      <>
                        <span className="shrink-0">
                          <e.Icon size={36} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-[15px] text-primary leading-5">
                            {e.title}
                          </span>
                          <span className="block text-[13px] text-primary leading-4">
                            {e.description}
                          </span>
                        </span>
                      </>
                    );
                    return e.href ? (
                      <a
                        key={e.title}
                        href={e.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={close}
                        className={ITEM}
                      >
                        {inner}
                      </a>
                    ) : e.settingsTab ? (
                      <Link
                        key={e.title}
                        to="/settings"
                        search={{ tab: e.settingsTab }}
                        onClick={close}
                        className={ITEM}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <Link key={e.title} to={e.to} onClick={close} className={ITEM}>
                        {inner}
                      </Link>
                    );
                  })}
                </section>
              ))}
            </div>
            <div className="sticky top-0 w-[200px] shrink-0 rounded-xl bg-card p-2 shadow-base">
              <h3 className="px-2 pt-2 pb-2 font-bold text-[20px] text-primary leading-6">
                Create
              </h3>
              {CREATE.map((c) => (
                <CreateRow
                  key={c.label}
                  item={c}
                  onDone={close}
                  onComposer={() => setComposer(true)}
                />
              ))}
              <div className="mx-2 my-2 h-px bg-divider" />
              {CREATE_MORE.map((c) => (
                <CreateRow
                  key={c.label}
                  item={c}
                  onDone={close}
                  onComposer={() => setComposer(true)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverPanel>
      {composer && <CreatePostModal open onOpenChange={(o) => !o && setComposer(false)} />}
    </>
  );
}

function CreateRow({
  item,
  onDone,
  onComposer,
}: {
  item: CreateItem;
  onDone: () => void;
  onComposer: () => void;
}) {
  const cls =
    "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover";
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {item.icon}
      </span>
      <span className="font-medium text-[15px] text-primary leading-5">{item.label}</span>
    </>
  );
  if (item.composer)
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          onDone();
          onComposer();
        }}
      >
        {inner}
      </button>
    );
  return (
    <Link to={item.to ?? "/"} onClick={onDone} className={cls}>
      {inner}
    </Link>
  );
}

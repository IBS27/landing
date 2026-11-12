import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type ComponentType, type ReactNode, useCallback, useId, useState } from "react";
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
  ReelsIcon,
} from "@/icons";
import { cn } from "@/lib/format";
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

/* ---------- Create column glyphs (Facebook draws these solid, 20px) ---------- */

/** 20px solid glyph; `cut` draws see-through details via a mask. */
function Glyph({
  children,
  cut,
  after,
}: {
  children: ReactNode;
  cut?: ReactNode;
  /** Drawn on top, outside the mask. */
  after?: ReactNode;
}) {
  const id = useId();
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      {cut && (
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
          <rect width="20" height="20" fill="#fff" />
          <g fill="#000" stroke="#000" strokeLinecap="round" strokeLinejoin="round">
            {cut}
          </g>
        </mask>
      )}
      <g mask={cut ? `url(#${id})` : undefined}>{children}</g>
      {after}
    </svg>
  );
}

const PostGlyph = () => (
  <Glyph>
    <path
      d="M9 3H6.2A3.2 3.2 0 0 0 3 6.2v7.6A3.2 3.2 0 0 0 6.2 17h7.6a3.2 3.2 0 0 0 3.2-3.2V11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M15.2 2a1.95 1.95 0 0 1 2.8 2.8l-6.8 6.8-3.4.9a.4.4 0 0 1-.5-.5l.9-3.4Z" />
  </Glyph>
);

const StoryGlyph = () => (
  <Glyph>
    <path d="M.8 3.8c0-.8.6-1.4 1.4-1.4h4.2a3 3 0 0 1 3 3v12.8c-.7-.7-1.6-1-2.6-1H2.2a1.4 1.4 0 0 1-1.4-1.4Z" />
    <path d="M19.2 3.8c0-.8-.6-1.4-1.4-1.4h-4.2a3 3 0 0 0-3 3v12.8c.7-.7 1.6-1 2.6-1h4.6a1.4 1.4 0 0 0 1.4-1.4Z" />
  </Glyph>
);

const ReelGlyph = () => <ReelsIcon active size={20} />;

const LifeUpdateGlyph = () => (
  <Glyph>
    <path
      d="M10 1 12 5.85 17.23 6.25 13.23 9.65 14.47 14.75 10 12 5.53 14.75 6.77 9.65 2.77 6.25 8 5.85Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M10 14v3.2M4.2 18.2h11.6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Glyph>
);

const NoteGlyph = () => (
  <Glyph>
    <path d="M4.6 1.5h10.8A4 4 0 0 1 19.4 5.5v4.2a4 4 0 0 1-4 4h-3c-.8 0-1.5.4-1.9 1.1l-.5.9-.5-.9c-.4-.7-1.1-1.1-1.9-1.1h-3a4 4 0 0 1-4-4V5.5a4 4 0 0 1 4-4Z" />
    <circle cx="14" cy="17.4" r="1.5" />
  </Glyph>
);

const PageGlyph = () => (
  <Glyph>
    <path d="M3.6 1.6c.6 0 1.1.4 1.1 1l1.4 15.6a1 1 0 1 1-2 .2L2.6 2.7c-.1-.6.4-1.1 1-1.1Z" />
    <path d="M4.7 2.4c3.2-.6 5.6.7 8.2.6 1.4 0 2.8-.3 4.2-.8.6-.2 1.1.4.9 1L16.6 7.6l1.6 4.4c.2.6-.2 1.1-.8 1.2-1.6.3-3 .4-4.4.3-2.6-.1-4.9-1.3-7.6-.8Z" />
  </Glyph>
);

const AdGlyph = () => (
  <Glyph>
    <path
      d="M15.6 2.4v13.2c0 .6-.6.9-1.1.6l-5.3-3H5a3.6 3.6 0 0 1-3.6-3.6V8.4A3.6 3.6 0 0 1 5 4.8h4.2l5.3-3c.5-.3 1.1 0 1.1.6Z"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <path d="M5.4 13.6h3.1l.9 4a1 1 0 0 1-1 1.2H7.6a1 1 0 0 1-1-.8Z" />
    <rect x="16.8" y="6.6" width="2.4" height="4.8" rx="1.2" />
  </Glyph>
);

const GroupGlyph = () => (
  <Glyph
    cut={
      <>
        <circle cx="10" cy="7.4" r="2.1" stroke="none" />
        <path d="M6.3 14.2c0-2 1.6-3.5 3.7-3.5s3.7 1.5 3.7 3.5Z" strokeWidth="0.6" />
        <circle cx="5.4" cy="8.8" r="1.5" stroke="none" />
        <circle cx="14.6" cy="8.8" r="1.5" stroke="none" />
        <path
          d="M2.9 13.2c0-1.3 1-2.3 2.5-2.3.5 0 .9.1 1.2.3a5 5 0 0 0-1 2Zm14.2 0c0-1.3-1-2.3-2.5-2.3-.5 0-.9.1-1.2.3a5 5 0 0 1 1 2Z"
          strokeWidth="0.6"
        />
      </>
    }
  >
    <circle cx="10" cy="10" r="9.6" />
  </Glyph>
);

const EventGlyph = () => (
  <Glyph
    cut={
      <g fill="none" strokeWidth="1.7">
        <path d="M6.2 5h7.6M10 8.6v6M7 11.6h6" />
      </g>
    }
  >
    <rect x="1.5" y="1" width="17" height="18" rx="4" />
  </Glyph>
);

const ListingGlyph = () => (
  <Glyph cut={<path d="M7.2 9.4a2.8 2.8 0 0 0 5.6 0" fill="none" strokeWidth="1.7" />}>
    <path d="M2.9 6.4h14.2c.7 0 1.2.6 1.1 1.3l-.9 8.4a2.4 2.4 0 0 1-2.4 2.1H5.1a2.4 2.4 0 0 1-2.4-2.1l-.9-8.4c-.1-.7.4-1.3 1.1-1.3Z" />
    <path
      d="M6.8 6.6V5a3.2 3.2 0 0 1 6.4 0v1.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </Glyph>
);

const BOWL = "M1.3 12.2c1.4 3.8 4.8 6.3 8.7 6.3s7.3-2.5 8.7-6.3";
const FundraiserGlyph = () => (
  <Glyph
    cut={
      <>
        <path d="M10 12.6 7 9.7a2.1 2.1 0 0 1 3-3 2.1 2.1 0 0 1 3 3Z" strokeWidth="0.5" />
        <path d={BOWL} fill="none" strokeWidth="4.6" />
      </>
    }
    after={
      <path d={BOWL} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    }
  >
    <circle cx="10" cy="9" r="8" />
  </Glyph>
);

type CreateItem = { label: string; icon: ReactNode; to?: string; composer?: boolean };
const CREATE: CreateItem[] = [
  { label: "Post", icon: <PostGlyph />, composer: true },
  { label: "Story", icon: <StoryGlyph />, to: "/stories/create" },
  { label: "Reel", icon: <ReelGlyph />, to: "/reel" },
  { label: "Life update", icon: <LifeUpdateGlyph />, composer: true },
  { label: "Note", icon: <NoteGlyph />, to: "/messages" },
];
const CREATE_MORE: CreateItem[] = [
  { label: "Page", icon: <PageGlyph />, to: "/pages" },
  { label: "Ad", icon: <AdGlyph />, to: "/ads-manager" },
  { label: "Group", icon: <GroupGlyph />, to: "/groups/create" },
  { label: "Event", icon: <EventGlyph />, to: "/events/create" },
  { label: "Marketplace listing", icon: <ListingGlyph />, to: "/marketplace/create" },
  { label: "Fundraiser", icon: <FundraiserGlyph />, to: "/fundraisers" },
];

const ITEM =
  "flex min-h-14 items-center gap-3 rounded-lg px-2 py-[9px] transition-colors hover:bg-hover";

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
  // Facebook opens the menu without a caret in "Search menu": focus the panel itself on mount
  // (ahead of the popover's first-control auto-focus); Tab still reaches the search field.
  const focusPanel = useCallback((el: HTMLDivElement | null) => {
    el?.focus({ preventScroll: true });
  }, []);

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
        <div
          ref={focusPanel}
          tabIndex={-1}
          className="flex h-[calc(100vh-72px)] max-h-[828px] min-h-0 flex-col bg-wash outline-none"
        >
          <h2 className="px-4 pt-3 pb-2.5 font-bold text-[24px] text-primary leading-7">Menu</h2>
          <div className="flex min-h-0 flex-1 items-start gap-4 overflow-y-auto px-4 pb-4">
            <div className="w-[360px] shrink-0 rounded-xl bg-card px-2 pt-4 pb-2 shadow-base">
              <label className="mx-2 mb-2.5 flex h-9 items-center gap-2 rounded-full bg-input px-3">
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
                  {i > 0 && <div className="mx-2 mt-5 mb-2 h-px bg-divider" />}
                  <h3
                    className={cn(
                      "px-2 pb-2 font-semibold text-[17px] text-primary leading-5",
                      i > 0 ? "pt-[7px]" : "pt-3",
                    )}
                  >
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
              <h3 className="px-2 pt-1 pb-[15px] font-bold text-[20px] text-primary leading-6">
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

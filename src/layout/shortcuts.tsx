import type { ComponentType } from "react";
import {
  BmAdsManager,
  BmBirthdays,
  BmClimate,
  BmEvents,
  BmFeeds,
  BmFriends,
  BmFundraisers,
  BmGaming,
  BmGroups,
  BmMarketplace,
  BmMemories,
  BmMessenger,
  BmMetaAI,
  BmPages,
  BmRecent,
  BmReels,
  BmSaved,
  BmVideo,
} from "@/icons";

export type Shortcut = {
  label: string;
  to: string;
  Icon: ComponentType<{ size?: number }>;
  description?: string;
};

/** Home left rail, in Facebook's order. The first `PRIMARY_COUNT` show before "See more". */
export const SHORTCUTS: Shortcut[] = [
  { label: "Meta AI", to: "/meta-ai", Icon: BmMetaAI, description: "Ask Meta AI anything." },
  {
    label: "Friends",
    to: "/friends",
    Icon: BmFriends,
    description: "Search for friends or people you may know.",
  },
  {
    label: "Memories",
    to: "/memories",
    Icon: BmMemories,
    description: "Browse your old photos, videos and posts on Facebook.",
  },
  {
    label: "Saved",
    to: "/saved",
    Icon: BmSaved,
    description: "Find posts, photos and videos that you've saved for later.",
  },
  {
    label: "Groups",
    to: "/groups/feed",
    Icon: BmGroups,
    description: "Connect with people who share your interests.",
  },
  {
    label: "Reels",
    to: "/reel",
    Icon: BmReels,
    description: "Watch and create short, entertaining videos.",
  },
  {
    label: "Marketplace",
    to: "/marketplace",
    Icon: BmMarketplace,
    description: "Buy and sell in your community.",
  },
  {
    label: "Feeds",
    to: "/feeds",
    Icon: BmFeeds,
    description: "See the most recent posts from your friends, groups, Pages and more.",
  },
  {
    label: "Events",
    to: "/events",
    Icon: BmEvents,
    description: "Organize or find events and other things to do online and nearby.",
  },
  {
    label: "Ads Manager",
    to: "/ads-manager",
    Icon: BmAdsManager,
    description: "Create, manage and track the performance of your ads.",
  },
  {
    label: "Birthdays",
    to: "/events/birthdays",
    Icon: BmBirthdays,
    description: "See your friends' upcoming birthdays.",
  },
  {
    label: "Climate Science Center",
    to: "/climate",
    Icon: BmClimate,
    description: "Learn about climate change and its effects.",
  },
  {
    label: "Fundraisers",
    to: "/fundraisers",
    Icon: BmFundraisers,
    description: "Donate and raise money for nonprofits and personal causes.",
  },
  {
    label: "Gaming Video",
    to: "/gaming",
    Icon: BmGaming,
    description: "Watch and connect with your favorite games and streamers.",
  },
  {
    label: "Messenger",
    to: "/messages",
    Icon: BmMessenger,
    description: "Chat instantly with friends and contacts.",
  },
  {
    label: "Pages",
    to: "/pages",
    Icon: BmPages,
    description: "Discover and connect with businesses on Facebook.",
  },
  {
    label: "Play games",
    to: "/gaming/play",
    Icon: BmGaming,
    description: "Play your favorite games.",
  },
  {
    label: "Recent ad activity",
    to: "/ads/activity",
    Icon: BmRecent,
    description: "See all of the ads you interacted with on Facebook.",
  },
  {
    label: "Video",
    to: "/watch",
    Icon: BmVideo,
    description: "A video destination personalized to your interests and connections.",
  },
];

export const PRIMARY_COUNT = 10;

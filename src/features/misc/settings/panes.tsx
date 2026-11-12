import { Link, useNavigate } from "@tanstack/react-router";
import {
  CircleUser,
  CreditCard,
  Eye,
  FileText,
  Film,
  KeyRound,
  Megaphone,
  Newspaper,
  Puzzle,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { type ThemeSetting, useTheme } from "@/app/theme";
import { useM, useViewer } from "@/app/viewer";
import { AUDIENCES } from "@/features/posts/Audience";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import { LANGUAGES } from "../../../../convex/lib/settings";
import { BlockingPane } from "./BlockingPane";
import {
  ChoiceRow,
  Group,
  LinkRow,
  type Option,
  PrefChoice,
  PrefToggle,
  RadioList,
  ToggleRow,
  useOptimistic,
  useSettings,
} from "./controls";
import { NotificationsPane } from "./NotificationsPane";

/* ---------- Typed settings with real effects ---------- */

type Patch = Parameters<ReturnType<typeof useUpdate>>[0];
function useUpdate() {
  return useM(api.settings.update);
}

/** One typed field of `userSettings`, optimistic. */
function useSetting<K extends "defaultAudience" | "friendRequests" | "friendsList" | "language">(
  key: K,
) {
  const settings = useSettings();
  const update = useUpdate();
  return useOptimistic(settings?.[key], (v) => update({ [key]: v } as Patch));
}

function useFlag(key: "hideReactionCountsOthers" | "hideReactionCountsOwn") {
  const settings = useSettings();
  const update = useUpdate();
  return useOptimistic(settings?.[key], (v) => update({ [key]: v } as Patch));
}

function DefaultAudienceRow({ title }: { title: string }) {
  const [value, set] = useSetting("defaultAudience");
  return (
    <ChoiceRow
      title={title}
      description="Your default audience is used when you create a new post. You can still change the audience of each post."
      options={AUDIENCES.map((a) => ({ value: a.value, label: a.label, sub: a.sub }))}
      value={value}
      onChange={set}
    />
  );
}

const FRIEND_REQUEST_OPTIONS: Option<"everyone" | "friends_of_friends">[] = [
  { value: "everyone", label: "Everyone" },
  { value: "friends_of_friends", label: "Friends of friends" },
];

const FRIENDS_LIST_OPTIONS: Option<"public" | "friends" | "only_me">[] = [
  { value: "public", label: "Public", sub: "Anyone on or off Facebook" },
  { value: "friends", label: "Friends", sub: "Your friends on Facebook" },
  { value: "only_me", label: "Only me" },
];

function FriendRequestsRow() {
  const [value, set] = useSetting("friendRequests");
  return (
    <ChoiceRow
      title="Who can send you friend requests?"
      options={FRIEND_REQUEST_OPTIONS}
      value={value}
      onChange={set}
    />
  );
}

function FriendsListRow() {
  const [value, set] = useSetting("friendsList");
  return (
    <ChoiceRow
      title="Who can see your friends list?"
      description="Remember, your friends control who can see their friendships on their own profiles. People who can't see your friends list will still see mutual friends."
      options={FRIENDS_LIST_OPTIONS}
      value={value}
      onChange={set}
    />
  );
}

function ReactionPreferences() {
  const [others, setOthers] = useFlag("hideReactionCountsOthers");
  const [own, setOwn] = useFlag("hideReactionCountsOwn");
  return (
    <>
      <p className="px-2 pb-2 text-[15px] text-secondary leading-5">
        Choose whether to see the total number of reactions on posts. You'll still see the reactions
        themselves.
      </p>
      <Group title="On posts from others">
        <ToggleRow title="Hide number of reactions" on={others} onChange={setOthers} />
      </Group>
      <Group title="On your posts">
        <ToggleRow title="Hide number of reactions" on={own} onChange={setOwn} />
      </Group>
    </>
  );
}

function LanguagePane() {
  const [language, setLanguage] = useSetting("language");
  return (
    <>
      <Group title="Facebook language">
        <ChoiceRow
          title="Language for buttons, titles and other text from Facebook on this account"
          description="Facebook is shown in English (US) in this preview; your choice is saved to your account."
          options={LANGUAGES.map((l) => ({ value: l, label: l }))}
          value={language}
          onChange={setLanguage}
        />
      </Group>
      <Group title="Translations">
        <PrefChoice id="translations" title="Posts from friends and Pages" />
      </Group>
      <Group title="Region format">
        <PrefChoice
          id="region-format"
          title="Format for dates, times and numbers"
          description="Applies to dates, times and numbers on Facebook."
        />
      </Group>
    </>
  );
}

function DarkModePane() {
  const { setting, setSetting } = useTheme();
  const options: Option<ThemeSetting>[] = [
    { value: "light", label: "Off" },
    { value: "dark", label: "On" },
    {
      value: "auto",
      label: "Automatic",
      sub: "We'll automatically adjust the display based on your device's system settings.",
    },
  ];
  return (
    <Group>
      <RadioList name="Dark mode" options={options} value={setting} onChange={setSetting} />
    </Group>
  );
}

/* ---------- Pane bodies ---------- */

export function PaneBody({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  switch (id) {
    case "accounts-center":
      return <AccountsCenter />;
    case "privacy-checkup":
      return <PrivacyCheckup onOpen={onOpen} />;
    case "default-audience":
      return (
        <Group>
          <DefaultAudienceRow title="Posts" />
          <PrefChoice id="stories-audience" title="Stories" />
          <PrefChoice id="reels-audience" title="Reels" />
        </Group>
      );
    case "reaction-preferences":
      return <ReactionPreferences />;
    case "notifications":
      return <NotificationsPane />;
    case "accessibility":
      return (
        <Group>
          <PrefToggle
            id="compact-mode"
            title="Compact mode"
            sub="Make your font size smaller so more content can fit on the screen."
          />
        </Group>
      );
    case "language":
      return <LanguagePane />;
    case "media":
      return (
        <Group>
          <PrefChoice id="video-quality" title="Video default quality" />
          <PrefChoice id="autoplay" title="Autoplay videos" />
        </Group>
      );
    case "dark-mode":
      return <DarkModePane />;
    case "profile-details":
      return (
        <Group description="Choose who can see each of these details on your profile.">
          <PrefChoice id="audience-work" title="Work" />
          <PrefChoice id="audience-education" title="Education" />
          <PrefChoice id="audience-city" title="Current city" />
          <PrefChoice id="audience-hometown" title="Hometown" />
          <PrefChoice id="audience-relationship" title="Relationship status" />
          <PrefChoice id="audience-birthday" title="Birthday" />
        </Group>
      );
    case "find-contact":
      return (
        <Group>
          <FriendRequestsRow />
          <FriendsListRow />
          <PrefChoice
            id="lookup-email"
            title="Who can look you up using the email address you provided?"
          />
          <PrefChoice
            id="lookup-phone"
            title="Who can look you up using the phone number you provided?"
          />
          <PrefToggle
            id="search-engines"
            title="Do you want search engines outside of Facebook to link to your profile?"
          />
        </Group>
      );
    case "posts":
      return (
        <Group>
          <DefaultAudienceRow title="Who can see your future posts?" />
          <PrefToggle
            id="share-to-stories"
            title="Allow others to share your posts to their stories?"
            sub="Only public posts can be shared to stories."
          />
        </Group>
      );
    case "stories":
      return (
        <Group>
          <PrefChoice id="stories-audience" title="Who can see your stories?" />
          <PrefToggle
            id="stories-sharing"
            title="Allow others to share your public stories to their own story?"
          />
        </Group>
      );
    case "reels":
      return (
        <Group>
          <PrefChoice id="reels-audience" title="Default audience for reels" />
          <PrefToggle id="reels-remix" title="Allow people to remix your reels" />
          <PrefToggle id="reels-download" title="Allow people to download your reels" />
        </Group>
      );
    case "followers":
      return (
        <Group>
          <PrefChoice id="who-can-follow" title="Who can follow me" />
          <PrefChoice id="public-comments" title="Who can comment on your public posts?" />
          <PrefChoice
            id="public-profile-info"
            title="Who can like or comment on your public profile pictures and other profile info?"
          />
        </Group>
      );
    case "tagging":
      return (
        <>
          <Group title="Viewing and sharing">
            <PrefChoice id="who-can-post-on-profile" title="Who can post on your profile?" />
            <PrefChoice
              id="who-can-see-profile-posts"
              title="Who can see what others post on your profile?"
            />
          </Group>
          <Group title="Reviewing">
            <PrefToggle
              id="review-tags-profile"
              title="Review posts you're tagged in before they appear on your profile"
            />
            <PrefToggle
              id="review-tags-posts"
              title="Review tags people add to your posts before the tags appear on Facebook"
            />
          </Group>
        </>
      );
    case "blocking":
      return <BlockingPane />;
    case "activity-log":
      return <ActivityPane />;
    default:
      return (
        <p className="mx-2 rounded-lg bg-wash px-4 py-6 text-[15px] text-secondary">
          {EMPTY[id] ?? "There's nothing to change here right now."}
        </p>
      );
  }
}

const EMPTY: Record<string, string> = {
  "family-center": "You aren't supervising any accounts, and no one is supervising yours.",
  "ads-payments": "You haven't added a payment method or made any ad payments.",
  apps: "You don't have any active apps or websites to review.",
  business: "You haven't connected any business integrations.",
};

function PrivacyCheckup({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <Group description="We'll guide you through some settings so you can make the right choices for your account. What topic do you want to start with?">
      <LinkRow
        Icon={Eye}
        title="Who can see what you share"
        sub="Posts, profile details and friends list"
        onClick={() => onOpen("posts")}
      />
      <LinkRow
        Icon={KeyRound}
        title="How to keep your account secure"
        sub="Password and login alerts"
        onClick={() => onOpen("accounts-center")}
      />
      <LinkRow
        Icon={Search}
        title="How people can find you on Facebook"
        sub="Friend requests and look-up"
        onClick={() => onOpen("find-contact")}
      />
      <LinkRow
        Icon={UserCog}
        title="Your data settings on Facebook"
        sub="Apps and websites"
        onClick={() => onOpen("apps")}
      />
    </Group>
  );
}

function AccountsCenter() {
  const viewer = useViewer();
  const navigate = useNavigate();
  return (
    <>
      <Group title="Profiles">
        <Link
          to="/$username"
          params={{ username: viewer.username }}
          className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
        >
          <Avatar src={viewer.avatar} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-[15px] text-primary leading-5">
              {viewer.name}
            </span>
            <span className="block text-[13px] text-secondary leading-4">Facebook</span>
          </span>
        </Link>
      </Group>
      <Group title="Personal details">
        <Detail Icon={CircleUser} title="Name" value={viewer.name} />
        <Detail Icon={FileText} title="Username" value={viewer.username} />
        <Detail
          Icon={CircleUser}
          title="Birthday"
          value={viewer.birthday ? formatBirthday(viewer.birthday) : "Not added"}
        />
        <LinkRow
          Icon={UserCog}
          title="Edit profile details"
          sub="Bio, work, education and places"
          onClick={() =>
            void navigate({ to: "/$username/about", params: { username: viewer.username } })
          }
        />
      </Group>
      <Group title="Password and security">
        <PrefToggle
          id="two-factor"
          title="Two-factor authentication"
          sub="Require a code when logging in from an unrecognized device."
        />
        <PrefToggle
          id="login-alerts"
          title="Login alerts"
          sub="Get an alert when someone logs into your account from a new place."
        />
      </Group>
      <Group title="Ad preferences">
        <PrefToggle
          id="ads-interests"
          title="Ads about topics you've shown interest in"
          sub="Use your activity to show more relevant ads."
        />
        <PrefToggle
          id="ads-partners"
          title="Ads from partners"
          sub="Use info from partners about your activity."
        />
      </Group>
      <Group title="More">
        <Detail Icon={CreditCard} title="Payments" value="No payment methods added" />
        <Detail
          Icon={ShieldCheck}
          title="Meta Verified"
          value="Get a verified badge, account protection and direct support."
        />
        <Detail
          Icon={Megaphone}
          title="Your information and permissions"
          value="Access, download or transfer your information."
        />
      </Group>
    </>
  );
}

function Detail({ Icon, title, value }: { Icon: typeof CircleUser; title: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-2 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn">
        <Icon size={20} className="text-icon" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px] text-primary leading-5">{title}</span>
        <span className="block text-[13px] text-secondary leading-4">{value}</span>
      </span>
    </div>
  );
}

function formatBirthday(mmdd: string) {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function ActivityPane() {
  const viewer = useViewer();
  return (
    <Group>
      {[
        { label: "Your posts", Icon: Newspaper, to: "/$username" as const },
        { label: "Photos and videos", Icon: Film, to: "/$username/photos" as const },
        { label: "Saved items", Icon: Puzzle, to: "/saved" as const },
      ].map(({ label, Icon, to }) => (
        <Link
          key={label}
          to={to}
          params={{ username: viewer.username }}
          className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn">
            <Icon size={20} className="text-icon" />
          </span>
          <span className="flex-1 font-medium text-[15px] text-primary">{label}</span>
        </Link>
      ))}
    </Group>
  );
}

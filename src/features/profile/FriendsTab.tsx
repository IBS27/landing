import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ } from "@/app/viewer";
import { FriendButton, PersonXGlyph, UnfriendDialog, useFriendActions } from "@/features/friends";
import { MessengerIcon } from "@/icons";
import { plural } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { IconButton, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CardEmpty, CardMoreButton, CheckinsCard, ProfileCard, ReelsCard, SubTabs } from "./cards";
import { useProfile } from "./context";
import { PhotosCard } from "./PhotosTab";

type Friend = FunctionReturnType<typeof api.friends.list>[number];
export type FriendsFilter = "all" | "mutual" | "recent" | "birthdays" | "city" | "hometown";

const MONTH = 30 * 24 * 60 * 60 * 1000;

/** Friends tab: the Friends card (search, sub-tabs, 2-column grid), then Photos, Reels, Check-ins. */
export function FriendsTab({
  filter,
  onFilter,
}: {
  filter: FriendsFilter;
  onFilter: (f: FriendsFilter) => void;
}) {
  const { profile } = useProfile();
  const overview = useQ(api.profiles.overview, { userId: profile.user._id });
  return (
    <div className="flex flex-col gap-4">
      <FriendsCard filter={filter} onFilter={onFilter} />
      <PhotosCard />
      <ReelsCard />
      <CheckinsCard checkins={overview?.checkins} />
    </div>
  );
}

function FriendsCard({
  filter,
  onFilter,
}: {
  filter: FriendsFilter;
  onFilter: (f: FriendsFilter) => void;
}) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const friends = useQ(api.friends.list, { userId: user._id });
  const [q, setQ] = useState("");

  const tabs: { key: FriendsFilter; label: string }[] = isSelf
    ? [
        { key: "all", label: "All friends" },
        { key: "recent", label: "Recently added" },
        { key: "birthdays", label: "Birthdays" },
        { key: "city", label: "Current city" },
        { key: "hometown", label: "Hometown" },
      ]
    : [
        { key: "all", label: "All friends" },
        ...(profile.mutualCount > 0 ? [{ key: "mutual" as const, label: "Mutual friends" }] : []),
        { key: "recent", label: "Recently added" },
        { key: "city", label: "Current city" },
        { key: "hometown", label: "Hometown" },
      ];

  const shown = useMemo(() => {
    if (!friends) return undefined;
    let list = [...friends];
    const now = Date.now();
    if (filter === "mutual") list = list.filter((f) => f.relation === "friend");
    if (filter === "recent")
      list = list
        .filter((f) => now - f.friendsSince < 3 * MONTH)
        .sort((a, b) => b.friendsSince - a.friendsSince);
    if (filter === "birthdays")
      list = list
        .filter((f) => f.birthday)
        .sort((a, b) => birthdayOrder(a.birthday) - birthdayOrder(b.birthday));
    if (filter === "city") list = list.filter((f) => f.city && f.city === user.city);
    if (filter === "hometown")
      list = list.filter((f) => f.hometown && f.hometown === user.hometown);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((f) => f.name.toLowerCase().includes(needle));
    return list;
  }, [friends, filter, q, user.city, user.hometown]);

  return (
    <ProfileCard
      title="Friends"
      action={
        <div className="flex items-center gap-1">
          <label className="flex h-9 w-[205px] items-center gap-2 rounded-full bg-input px-3">
            <Search size={16} strokeWidth={2.4} className="shrink-0 text-secondary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search in profile section"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
            />
          </label>
          {isSelf && (
            <>
              <Link
                to="/friends/requests"
                className="rounded-md px-4 py-2 font-semibold text-[15px] text-link hover:bg-hover"
              >
                Friend requests
              </Link>
              <Link
                to="/friends/suggestions"
                className="rounded-md px-4 py-2 font-semibold text-[15px] text-link hover:bg-hover"
              >
                Find Friends
              </Link>
            </>
          )}
          <CardMoreButton
            label="More options for friends list"
            items={[
              { label: "All friends", onSelect: () => onFilter("all") },
              { label: "Recently added", onSelect: () => onFilter("recent") },
              ...(isSelf
                ? [
                    {
                      label: "Find friends",
                      onSelect: () => void navigate({ to: "/friends/suggestions" }),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      }
    >
      {friends && friends.length > 0 && <SubTabs tabs={tabs} value={filter} onChange={onFilter} />}
      {shown === undefined ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-lg" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <CardEmpty>{q ? `No results for: ${q}` : "No friends to show"}</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 min-[900px]:grid-cols-2">
          {shown.map((f) => (
            <FriendItem key={f._id} friend={f} filter={filter} />
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

function birthdayOrder(mmdd: string | null) {
  if (!mmdd) return 9999;
  const now = new Date();
  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const [m, d] = mmdd.split("-").map(Number);
  const v = m * 100 + d;
  return v >= today ? v - today : v + 1300 - today;
}

const bdayFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

function subline(f: Friend, filter: FriendsFilter) {
  if (filter === "birthdays" && f.birthday) {
    const [m, d] = f.birthday.split("-").map(Number);
    return bdayFmt.format(new Date(2000, m - 1, d));
  }
  if (filter === "city" && f.city) return f.city;
  if (filter === "hometown" && f.hometown) return f.hometown;
  if (f.mutualCount > 0) return plural(f.mutualCount, "mutual friend");
  if (f.work) return f.work.company;
  if (f.school) return f.school;
  return null;
}

/** One friend: 80px rounded thumbnail, name, a meta line and a "…" menu or friend button. */
function FriendItem({ friend: f, filter }: { friend: Friend; filter: FriendsFilter }) {
  const sub = subline(f, filter);
  return (
    <div className="flex items-center gap-4 rounded-lg border border-divider-soft p-4">
      <Link to="/$username" params={{ username: f.username }} className="shrink-0">
        <img
          src={f.avatar}
          alt=""
          className="h-20 w-20 rounded-lg object-cover hover:brightness-95"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/$username"
          params={{ username: f.username }}
          className="block truncate font-semibold text-[17px] text-primary leading-5 hover:underline"
        >
          {f.name}
        </Link>
        {sub && <div className="mt-1 truncate text-[13px] text-secondary">{sub}</div>}
      </div>
      {f.relation === "friend" ? (
        <FriendMenu friend={f} />
      ) : f.relation !== "self" ? (
        <FriendButton userId={f._id} name={f.name} relation={f.relation} variant="secondary" />
      ) : null}
    </div>
  );
}

function FriendMenu({ friend: f }: { friend: Friend }) {
  const actions = useFriendActions();
  const { openChat } = useChatDock();
  const getOrCreateDm = useM(api.conversations.getOrCreateDm);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`More options for ${f.name}`} variant="ghost">
            <MoreHorizontal size={20} className="text-secondary" />
          </IconButton>
        </MenuTrigger>
        <MenuContent width={300}>
          <MenuItem
            icon={<MessengerIcon size={20} />}
            label={`Message ${f.firstName}`}
            onSelect={async () => openChat(await getOrCreateDm({ userId: f._id }))}
          />
          <MenuItem
            label={`See ${f.firstName}'s friends`}
            onSelect={() =>
              void navigate({ to: "/$username/friends", params: { username: f.username } })
            }
          />
          <MenuItem
            icon={<PersonXGlyph size={20} />}
            label="Unfriend"
            onSelect={() => setConfirm(true)}
          />
        </MenuContent>
      </Menu>
      <UnfriendDialog
        open={confirm}
        onOpenChange={setConfirm}
        name={f.name}
        onConfirm={() => void actions.unfriend(f._id)}
      />
    </>
  );
}

import { Link } from "@tanstack/react-router";
import { useQ } from "@/app/viewer";
import { compactCount, plural } from "@/lib/format";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CardEmpty, CheckinsCard, ProfileCard, ReelsCard } from "./cards";
import { possessive, useProfile } from "./context";
import type { SectionKey } from "./ProfileTabs";

export const SECTION_KEYS: SectionKey[] = ["checkins", "groups", "likes", "followers"];

/** Reels tab. */
export function ReelsTab() {
  const { profile } = useProfile();
  const overview = useQ(api.profiles.overview, { userId: profile.user._id });
  return (
    <div className="flex flex-col gap-4">
      <ReelsCard />
      <CheckinsCard checkins={overview?.checkins} />
    </div>
  );
}

/** "More" sections: Check-ins, Groups, Likes and (Pages) Followers. */
export function SectionTab({ section }: { section: SectionKey }) {
  const { profile } = useProfile();
  const overview = useQ(
    api.profiles.overview,
    section === "checkins" ? { userId: profile.user._id } : "skip",
  );
  if (section === "checkins") return <CheckinsCard checkins={overview?.checkins} />;
  if (section === "groups") return <GroupsCard />;
  if (section === "likes") return <LikesCard />;
  return <FollowersCard />;
}

function GroupsCard() {
  const { profile } = useProfile();
  const groups = useQ(api.profiles.groups, { userId: profile.user._id });
  return (
    <ProfileCard title="Groups">
      {groups === undefined ? (
        <div className="h-24" />
      ) : groups.length === 0 ? (
        <CardEmpty>No groups to show</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g._id}
              to="/groups/$groupId"
              params={{ groupId: g.slug }}
              className="flex items-center gap-4 rounded-lg border border-divider-soft p-4 hover:bg-hover"
            >
              <img src={g.cover} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[17px] text-primary">
                  {g.name}
                </span>
                <span className="block text-[13px] text-secondary">
                  {g.privacy === "private" ? "Private" : "Public"} group ·{" "}
                  {compactCount(g.memberCount)} members
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

function LikesCard() {
  const { profile } = useProfile();
  const pages = useQ(api.profiles.following, { userId: profile.user._id });
  return (
    <ProfileCard title="Likes">
      {pages === undefined ? (
        <div className="h-24" />
      ) : pages.length === 0 ? (
        <CardEmpty>No likes to show</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {pages.map((p) => (
            <Link
              key={p._id}
              to="/$username"
              params={{ username: p.username }}
              className="flex items-center gap-4 rounded-lg border border-divider-soft p-4 hover:bg-hover"
            >
              <img src={p.avatar} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[17px] text-primary">
                  {p.name}
                </span>
                {p.category && (
                  <span className="block text-[13px] text-secondary">{p.category}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

function FollowersCard() {
  const { profile } = useProfile();
  const people = useQ(api.profiles.followers, { userId: profile.user._id });
  return (
    <ProfileCard title="Followers">
      <p className="text-[15px] text-secondary">
        {profile.isPage
          ? `${plural(profile.followerCount, "person", "people")} follow ${profile.user.name}`
          : `People who follow ${possessive(profile.user.firstName)} public posts`}
      </p>
      {people === undefined ? (
        <div className="h-24" />
      ) : people.length === 0 ? (
        <CardEmpty>No followers to show</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {people.map((u) => (
            <Link
              key={u._id}
              to="/$username"
              params={{ username: u.username }}
              className="flex items-center gap-4 rounded-lg border border-divider-soft p-4 hover:bg-hover"
            >
              <Avatar src={u.avatar} size={80} square />
              <span className="truncate font-semibold text-[17px] text-primary">{u.name}</span>
            </Link>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

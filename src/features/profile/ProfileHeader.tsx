import { Link } from "@tanstack/react-router";
import { Camera, ChevronDown, MapPin, Pencil, Plus, Search, Tag } from "lucide-react";
import { useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM } from "@/app/viewer";
import { FriendButton } from "@/features/friends";
import { MessengerIcon } from "@/icons";
import { cn, compactCount, plural } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/ui/overlays";
import { Avatar, Button, Spinner, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { columnPad, useProfile } from "./context";
import { EditProfileModal } from "./EditProfileModal";
import { NoteBubble } from "./NoteBubble";
import { ChoosePhotoDialog, ImageLightbox, pickImage, useSetProfilePhoto } from "./photos";
import { Recommendations } from "./Recommendations";

const RECS_KEY = "fb-clone:profileRecs";

/**
 * People You May Know under your own header starts open, as on Facebook;
 * the chevron toggles it and the choice is remembered per browser.
 */
function useRecsOpen(defaultOpen: boolean) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(RECS_KEY);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(RECS_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  return [open, toggle] as const;
}

/**
 * Facebook's 2026 profile header: full-width cover (1250 max, bottom corners
 * rounded), the 168px picture under it beside the name block, and the action
 * buttons on the right. A blurred copy of the cover tints the page edges.
 */
export function ProfileHeader() {
  const { profile, embedded } = useProfile();
  const { user, isSelf } = profile;
  const [recsOpen, toggleRecs] = useRecsOpen(true);
  // Remembered state applies to your own profile; others' start collapsed.
  const [othersRecs, setOthersRecs] = useState(false);
  const showRecs = isSelf && !embedded ? recsOpen : othersRecs;
  const onToggleRecs = isSelf && !embedded ? toggleRecs : () => setOthersRecs((s) => !s);

  return (
    <div className="relative overflow-hidden bg-card">
      {user.cover && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[533px] overflow-hidden"
        >
          <img
            src={user.cover}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-90 blur-[40px]"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[463px]"
            style={{
              background:
                "linear-gradient(to top, var(--card), var(--card), color-mix(in srgb, var(--card) 70%, transparent), color-mix(in srgb, var(--card) 40%, transparent), transparent)",
            }}
          />
        </div>
      )}
      <Cover />
      <div className={cn("relative mx-auto w-full max-w-[1186px]", columnPad(embedded))}>
        <div className="flex items-center gap-[18px] pt-6 pr-[2px] pl-[10px]">
          <ProfilePicture />
          {/* Facebook centres the name block on the picture (~4.5px above its midline) with the buttons level with the name. Bio and work live in the Intro card. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-3 pb-[9px]">
            <NameBlock />
            <Actions showRecs={showRecs} onToggleRecs={onToggleRecs} />
          </div>
        </div>
        {showRecs && <Recommendations />}
        <div className="mt-[26px] h-px bg-divider" />
      </div>
    </div>
  );
}

function Cover() {
  const { profile, embedded } = useProfile();
  const { user, isSelf } = profile;
  const photo = useSetProfilePhoto();
  const [viewing, setViewing] = useState(false);
  const [choosing, setChoosing] = useState(false);

  return (
    // In the Friends preview pane the cover is inset and centred like a full profile's.
    <div className={cn("relative mx-auto w-full max-w-[1250px]", embedded && "px-10")}>
      <div className="relative aspect-[1250/463] max-h-[463px] w-full overflow-hidden rounded-b-lg bg-wash">
        {user.cover ? (
          <button
            type="button"
            aria-label={isSelf ? "Edit cover photo" : "Cover photo"}
            onClick={() => setViewing(true)}
            className="block h-full w-full"
          >
            <img src={user.cover} alt="" className="h-full w-full object-cover" />
          </button>
        ) : null}
        {isSelf && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-black/60" />
        )}
        {photo.busy === "cover" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Spinner size={40} className="text-white" />
          </div>
        )}
        {isSelf && (
          <div className="absolute right-8 bottom-4">
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="floating"
                  icon={<Camera size={16} strokeWidth={2.4} />}
                  className="shadow-none"
                >
                  {user.cover ? "Edit cover photo" : "Add cover photo"}
                </Button>
              </MenuTrigger>
              <MenuContent width={300}>
                <MenuItem label="Choose cover photo" onSelect={() => setChoosing(true)} />
                <MenuItem
                  label="Upload photo"
                  onSelect={() => pickImage((f) => void photo.upload("cover", f))}
                />
                {user.cover && (
                  <>
                    <MenuSeparator />
                    <MenuItem label="Remove" onSelect={() => void photo.removeCover()} />
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
        )}
      </div>
      {viewing && user.cover && (
        <ImageLightbox src={user.cover} onClose={() => setViewing(false)} />
      )}
      <ChoosePhotoDialog
        open={choosing}
        onOpenChange={setChoosing}
        userId={user._id}
        title="Choose cover photo"
        onPick={(url) => void photo.pick("cover", url)}
      />
    </div>
  );
}

function ProfilePicture() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const photo = useSetProfilePhoto();
  const [viewing, setViewing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const upload = () => pickImage((f) => void photo.upload("avatar", f));

  return (
    <div className="relative shrink-0">
      <NoteBubble />
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Profile picture actions"
            className="block rounded-full bg-card p-1 outline-none"
          >
            <span className="relative block">
              <Avatar src={user.avatar} size={168} className="align-top" />
              <span className="absolute inset-0 rounded-full transition-colors hover:bg-black/5" />
              {photo.busy === "avatar" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                  <Spinner size={32} className="text-white" />
                </span>
              )}
            </span>
          </button>
        </MenuTrigger>
        <MenuContent width={344} align="start">
          <MenuItem label="See profile picture" onSelect={() => setViewing(true)} />
          {isSelf && (
            <>
              <MenuItem label="Choose profile picture" onSelect={() => setChoosing(true)} />
              <MenuItem label="Upload photo" onSelect={upload} />
            </>
          )}
        </MenuContent>
      </Menu>
      {isSelf && (
        <Tooltip content="Update profile picture">
          <button
            type="button"
            aria-label="Update profile picture"
            onClick={upload}
            className="absolute right-[10px] bottom-[14px] flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon transition-[filter] hover:brightness-95 dark:hover:brightness-125"
          >
            <Camera size={20} strokeWidth={2.2} />
          </button>
        </Tooltip>
      )}
      {viewing && <ImageLightbox src={user.avatar} onClose={() => setViewing(false)} />}
      <ChoosePhotoDialog
        open={choosing}
        onOpenChange={setChoosing}
        userId={user._id}
        title="Choose profile picture"
        onPick={(url) => void photo.pick("avatar", url)}
      />
    </div>
  );
}

function NameBlock() {
  const { profile } = useProfile();
  const { user, isPage } = profile;
  const details: { icon: typeof MapPin; text: string }[] = [];
  if (isPage && user.pageCategory) details.push({ icon: Tag, text: user.pageCategory });
  // Facebook only shows the location line when there is no friend count/facepile to show.
  if (user.city && (isPage || profile.friendCount === 0))
    details.push({ icon: MapPin, text: user.city });

  return (
    <div className="min-w-0 flex-1">
      <h1 className="flex items-center gap-1.5 font-bold text-[32px] text-primary leading-[38px]">
        <span className="min-w-0 break-words">{user.name}</span>
        {user.verified && <VerifiedBadge size={24} />}
      </h1>
      {isPage ? (
        <Link
          to="/$username/$section"
          params={{ username: user.username, section: "followers" }}
          className="mt-[2px] inline-block font-semibold text-[15px] text-primary leading-5 hover:underline"
        >
          {compactCount(profile.followerCount)} followers
        </Link>
      ) : profile.friendCount > 0 ? (
        <div className="mt-[2px] font-semibold text-[15px] text-secondary leading-5">
          <Link
            to="/$username/friends"
            params={{ username: user.username }}
            className="hover:underline"
          >
            {plural(profile.friendCount, "friend")}
          </Link>
          {profile.mutualCount > 0 && (
            <>
              {" · "}
              <Link
                to="/$username/friends"
                params={{ username: user.username }}
                search={{ tab: "mutual" }}
                className="hover:underline"
              >
                {profile.mutualCount} mutual
              </Link>
            </>
          )}
        </div>
      ) : null}
      {details.length > 0 && (
        <div className="mt-[3px] flex flex-wrap items-center text-[15px] text-primary leading-5">
          {details.map((d, i) => (
            <span key={d.text} className="flex items-center font-medium">
              {i > 0 && <span className="px-1">·</span>}
              <d.icon size={12} strokeWidth={2.6} className="mr-1 shrink-0" />
              {d.text}
            </span>
          ))}
        </div>
      )}
      {!isPage && profile.facepile.length > 0 && (
        <div className="mt-2 flex pl-2">
          {profile.facepile.map((f, i) => (
            <Tooltip key={f._id} content={f.name}>
              <Link
                to="/$username"
                params={{ username: f.username }}
                className="-ml-2 flex rounded-full ring-2 ring-card hover:brightness-95"
                style={{ zIndex: 10 - i }}
              >
                <Avatar src={f.avatar} size={32} />
              </Link>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

function Actions({ showRecs, onToggleRecs }: { showRecs: boolean; onToggleRecs: () => void }) {
  const { profile } = useProfile();
  const { user, isSelf, isPage, relation } = profile;
  const { openChat } = useChatDock();
  const getOrCreateDm = useM(api.conversations.getOrCreateDm);
  const setFollow = useM(api.profiles.setFollow);
  const [editing, setEditing] = useState(false);

  const message = async () => openChat(await getOrCreateDm({ userId: user._id }));
  const messageBtn = (primary: boolean) => (
    <Button
      variant={primary ? "primary" : "secondary"}
      icon={<MessengerIcon size={16} />}
      onClick={() => void message()}
    >
      Message
    </Button>
  );
  const chevron = (
    <Button
      variant="secondary"
      aria-label="See recommendations"
      aria-expanded={showRecs}
      onClick={onToggleRecs}
      className="w-12 px-4"
    >
      <ChevronDown
        size={16}
        strokeWidth={2.8}
        className={cn("transition-transform", showRecs && "rotate-180")}
      />
    </Button>
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isSelf ? (
        <>
          <Link
            to="/stories/create"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white transition-colors hover:bg-btn-primary-hover"
          >
            <Plus size={16} strokeWidth={3} />
            Add to story
          </Link>
          <Button
            variant="secondary"
            icon={<Pencil size={16} strokeWidth={2.6} />}
            onClick={() => setEditing(true)}
          >
            Edit profile
          </Button>
          {chevron}
          <EditProfileModal open={editing} onOpenChange={setEditing} />
        </>
      ) : isPage ? (
        <>
          {messageBtn(true)}
          <Button
            variant="secondary"
            icon={<FollowGlyph following={profile.viewerFollows} />}
            onClick={() => void setFollow({ targetId: user._id, follow: !profile.viewerFollows })}
          >
            {profile.viewerFollows ? "Following" : "Follow"}
          </Button>
          <Link
            to="/$username/search"
            params={{ username: user.username }}
            search={{ q: "" }}
            resetScroll={false}
            aria-label={`Search ${user.name}'s profile`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-btn px-3 font-semibold text-[15px] text-btn-text transition-[filter] hover:brightness-95 dark:hover:brightness-125"
          >
            <Search size={16} strokeWidth={2.6} />
            Search
          </Link>
        </>
      ) : (
        <>
          <FriendButton userId={user._id} name={user.name} relation={relation} />
          {messageBtn(relation === "friend")}
          {chevron}
        </>
      )}
    </div>
  );
}

function FollowGlyph({ following }: { following: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden>
      {following ? (
        <path d="M13.7 3.3a1 1 0 0 1 0 1.4l-6.5 6.5a1 1 0 0 1-1.4 0L2.3 7.7a1 1 0 1 1 1.4-1.4l2.8 2.79 5.8-5.8a1 1 0 0 1 1.4 0Z" />
      ) : (
        <path d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 13 1.5H3ZM8 4a.9.9 0 0 1 .9.9v2.2h2.2a.9.9 0 1 1 0 1.8H8.9v2.2a.9.9 0 1 1-1.8 0V8.9H4.9a.9.9 0 0 1 0-1.8h2.2V4.9A.9.9 0 0 1 8 4Z" />
      )}
    </svg>
  );
}

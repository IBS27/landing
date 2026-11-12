import { Link, useNavigate } from "@tanstack/react-router";
import {
  Cake,
  Clock,
  Heart,
  Home,
  Info,
  Link2,
  MapPin,
  MoreHorizontal,
  Pencil,
  X,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { FOOTER_LINKS } from "@/features/misc/AppRail";
import { FooterLink } from "@/features/policies/FooterLink";
import { CreateReelDialog } from "@/features/watch/CreateReel";
import { cn, compactCount, plural } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Card, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AboutSection } from "./AboutTab";
import {
  birthdayLabel,
  joinedLabel,
  possessive,
  schoolDates,
  useProfile,
  workDates,
} from "./context";
import { EditProfileModal } from "./EditProfileModal";
import { ImageLightbox, PhotoOpener } from "./photos";

/* ---------------- Shared bits ---------------- */

/** Profile card: white, radius 12, 16px padding, 20px/700 title row. */
export function ProfileCard({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={cn("rounded-xl px-4 pt-4 pb-4", className)}>
      {(title || action) && (
        <div className="flex min-h-9 items-center justify-between gap-3">
          {title && <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/** "See all photos" style link: 17px/400 blue. */
export function CardLink({
  to,
  section,
  children,
}: {
  to: CardTo;
  section?: string;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  return (
    <Link
      to={to}
      params={{ username: profile.user.username }}
      search={section ? { section } : undefined}
      className="rounded-md px-2 py-1 text-[17px] text-link hover:bg-hover"
    >
      {children}
    </Link>
  );
}
type CardTo = "/$username/about" | "/$username/friends" | "/$username/photos" | "/$username/reels";

/** Underlined sub-tab row inside a card ("Albums", "Your reels"…). */
export function SubTabs<K extends string>({
  tabs,
  value,
  onChange,
  trailing,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div role="tablist" className="flex h-[60px] items-stretch">
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cn(
                "group relative flex items-center",
                active ? "text-link" : "text-secondary",
              )}
            >
              <span
                className={cn(
                  "flex h-12 items-center rounded-md px-4 font-semibold text-[15px] transition-colors",
                  !active && "group-hover:bg-hover",
                )}
              >
                {t.label}
              </span>
              {active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-fb" />}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

/** The grey 48x36 "…" button on profile cards, with its menu. */
export function CardMoreButton({
  label,
  items,
}: {
  label: string;
  items: { label: string; onSelect: () => void }[];
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon transition-[filter] hover:brightness-95 dark:hover:brightness-125"
        >
          <MoreHorizontal size={20} strokeWidth={2.4} />
        </button>
      </MenuTrigger>
      <MenuContent width={260}>
        {items.map((i) => (
          <MenuItem key={i.label} label={i.label} onSelect={i.onSelect} />
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Centered 20px/700 grey empty message ("No friends to show"). */
export function CardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-10 pb-8 text-center font-bold text-[20px] text-secondary leading-6">
      {children}
    </p>
  );
}

/**
 * Left-column stickiness like Facebook: the column scrolls with the page and
 * pins once its bottom (or top, if it fits) reaches the viewport edge.
 */
export function useStickyColumn() {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(120);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(120, window.innerHeight - el.offsetHeight - 16));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return { ref, style: { top } };
}

/* ---------------- Personal details / Intro ---------------- */

type Row = { icon: ComponentType<{ size?: number; strokeWidth?: number }>; text: ReactNode };

function DetailRow({ icon: Icon, text }: Row) {
  return (
    <div className="flex min-h-9 items-center gap-5 py-[6px] pl-2">
      <span className="flex w-6 shrink-0 justify-center text-icon-secondary">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 font-semibold text-[15px] text-primary leading-5">{text}</span>
    </div>
  );
}

/** Section heading inside the intro card ("Work", "Education", "Links"). */
function IntroSection({
  title,
  more,
  children,
}: {
  title: string;
  more?: { label: string; section: AboutSection };
  children: ReactNode;
}) {
  const { profile } = useProfile();
  return (
    <section className="mt-6">
      <h3 className="font-bold text-[20px] text-primary leading-6">{title}</h3>
      <div className="pt-4">{children}</div>
      {more && (
        <Link
          to="/$username/about"
          params={{ username: profile.user.username }}
          search={{ section: more.section }}
          className="mt-3 ml-[52px] inline-block font-semibold text-[13px] text-secondary hover:underline"
        >
          {more.label}
        </Link>
      )}
    </section>
  );
}

export type OrgKind = "work" | "school";

/**
 * Facebook's tile for a workplace or school without a Page logo: a grey circle
 * with a briefcase (work) or graduation cap (school) glyph.
 */
export function OrgTile({ kind, size = 40 }: { kind: OrgKind; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-btn text-icon-secondary"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 20 20" width={size / 2} height={size / 2} fill="currentColor">
        {kind === "school" ? (
          <>
            <path d="M10 3 19 7.5 10 12 1 7.5Z" />
            <path d="M5 10.3 10 12.8 15 10.3v3.3c0 1.6-2.2 2.9-5 2.9s-5-1.3-5-2.9Z" />
            <rect x="16.9" y="8.2" width="1.2" height="5.6" rx=".6" />
          </>
        ) : (
          <>
            <path d="M7 5.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 4v1.5h-1.6V4.3a.2.2 0 0 0-.2-.2H8.8a.2.2 0 0 0-.2.2v1.2Z" />
            <path d="M4 5.5h12a2 2 0 0 1 2 2V10H2V7.5a2 2 0 0 1 2-2Z" />
            <path d="M2 11.2h6.6v.6c0 .5.4.9.9.9h1c.5 0 .9-.4.9-.9v-.6H18V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
          </>
        )}
      </svg>
    </span>
  );
}

/** Company / school row: tile, bold name, role or detail, dates. */
export function OrgEntry({
  kind,
  name,
  lines,
}: {
  kind: OrgKind;
  name: string;
  lines: (string | null | undefined)[];
}) {
  const [first, ...rest] = lines.filter(Boolean);
  return (
    <div className="flex gap-3">
      <OrgTile kind={kind} />
      <div className="min-w-0 pt-[3px]">
        <div className="font-semibold text-[15px] text-primary leading-5">{name}</div>
        {first && <div className="mt-[2px] text-[13px] text-primary leading-4">{first}</div>}
        {rest.map((l) => (
          <div key={l} className="mt-[3px] text-[13px] text-secondary leading-4">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Public groups the person is in, for "Communities" (`null` while loading or when empty). */
export function useCommunities(userId: Id<"users">, skip?: boolean) {
  const groups = useQ(api.profiles.groups, skip ? "skip" : { userId });
  const open = groups?.filter((g) => g.privacy === "public");
  return { all: open, top: open && open.length > 0 ? open.slice(0, 3) : null };
}

type Community = { _id: string; name: string; slug: string; cover: string; memberCount: number };

/** "Communities" rows: group cover tile, name, "Group · 12K members". */
export function CommunityList({ groups }: { groups: Community[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <Link
          key={g._id}
          to="/groups/$groupId"
          params={{ groupId: g.slug }}
          className="group flex items-center gap-3"
        >
          <img
            src={g.cover}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-lg object-cover shadow-[0_0_0_1px_var(--media-inner-border)]"
          />
          <div className="min-w-0">
            <div className="truncate font-semibold text-[15px] text-primary leading-5 group-hover:underline">
              {g.name}
            </div>
            <div className="truncate text-[13px] text-secondary leading-4">
              Group · {compactCount(g.memberCount)} {g.memberCount === 1 ? "member" : "members"}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** "https://www.x.com/a/" → "x.com/a". */
export function linkLabel(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** One "Links" row: link icon (Instagram glyph for instagram.com) and the bare URL. */
export function LinkRow({ url }: { url: string }) {
  const label = linkLabel(url);
  const ig = /^instagram\.com\//i.test(label);
  return (
    <div className="flex min-h-9 items-center gap-5 py-[6px] pl-2">
      <span className="flex w-6 shrink-0 justify-center text-icon-secondary">
        {ig ? <InstagramGlyph /> : <Link2 size={22} strokeWidth={1.8} />}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate font-semibold text-[15px] text-primary leading-5 hover:underline"
      >
        {ig ? label.replace(/^instagram\.com\//i, "") : label}
      </a>
    </div>
  );
}

/** Pages: a "Links" card (website, social links) leads the column, then "Intro", like Facebook. */
function PageIntroCards() {
  const { profile } = useProfile();
  const { user } = profile;
  const hasIntro = !!(user.bio || user.pageCategory || user.city);
  return (
    <>
      {user.links.length > 0 && (
        <ProfileCard title="Links" className="pt-[10px]">
          <div className="pt-1">
            {user.links.map((u) => (
              <LinkRow key={u} url={u} />
            ))}
          </div>
        </ProfileCard>
      )}
      {hasIntro && (
        <ProfileCard title="Intro">
          {user.bio && (
            <p className="pt-2 pb-3 text-center text-[15px] text-primary leading-5">{user.bio}</p>
          )}
          <div className={cn(!user.bio && "pt-2")}>
            {user.pageCategory && (
              <DetailRow
                icon={Info}
                text={
                  <>
                    <span className="font-semibold">Page</span>
                    <span className="font-normal"> · {user.pageCategory}</span>
                  </>
                }
              />
            )}
            {user.city && <DetailRow icon={MapPin} text={user.city} />}
          </div>
        </ProfileCard>
      )}
    </>
  );
}

/**
 * Own profile only: Facebook's "Get more out of Facebook" nudge above the
 * intro. "Update your profile" opens Edit profile; the X hides it for good.
 */
export function GetMoreCard() {
  const { profile } = useProfile();
  const show = profile.isSelf && !profile.isPage;
  const settings = useQ(api.settings.get, show ? {} : "skip");
  const setPref = useM(api.settings.setPref);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (!show || !settings || dismissed || settings.prefs["profile-tips-card"] === "Hidden")
    return null;
  return (
    <Card className="relative rounded-xl px-6 pt-6 pb-4">
      <span className="absolute top-3 right-3">
        <IconButton
          label="Close"
          variant="ghost"
          size={32}
          onClick={() => {
            setDismissed(true);
            void setPref({ key: "profile-tips-card", value: "Hidden" });
          }}
        >
          <X size={20} strokeWidth={2} className="text-secondary" />
        </IconButton>
      </span>
      <div className="flex gap-3 pr-6">
        <svg viewBox="0 0 24 24" width={24} height={24} className="shrink-0 text-fb" aria-hidden>
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="9.25" r="3.75" fill="currentColor" />
          <path
            d="M4.9 19.1C6.3 16.3 8.9 15 12 15s5.7 1.3 7.1 4.1A10 10 0 0 1 12 22a10 10 0 0 1-7.1-2.9Z"
            fill="currentColor"
          />
        </svg>
        <div className="min-w-0">
          <h2 className="font-bold text-[17px] text-primary leading-5">Get more out of Facebook</h2>
          <p className="mt-0.5 text-[15px] text-secondary leading-5">
            We've made it easier to add the stuff you're into, and see which friends like it too.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-4 h-9 w-full rounded-md bg-btn-soft font-semibold text-[15px] text-btn-soft-text transition-[filter] hover:brightness-95 dark:hover:brightness-125"
      >
        Update your profile
      </button>
      <EditProfileModal open={editing} onOpenChange={setEditing} />
    </Card>
  );
}

/**
 * The left intro card (Facebook 2026): "Personal details", then "Communities",
 * "Work" and "Education" sections with logo tiles and dates. Pages get Intro + Links.
 */
export function IntroCard() {
  const { profile } = useProfile();
  const { user, isSelf, isPage } = profile;

  const communities = useCommunities(user._id, isPage);
  if (isPage) return <PageIntroCards />;

  const rows: Row[] = [];
  if (user.city) rows.push({ icon: MapPin, text: `Lives in ${user.city}` });
  if (user.hometown) rows.push({ icon: Home, text: `From ${user.hometown}` });
  if (user.relationship) rows.push({ icon: Heart, text: user.relationship });
  if (user.birthday) rows.push({ icon: Cake, text: birthdayLabel(user.birthday) });
  if (rows.length === 0) rows.push({ icon: Clock, text: joinedLabel(user.joinedAt) });
  const job = user.work[0];
  const school = user.education[0];

  return (
    <ProfileCard
      title="Personal details"
      action={
        isSelf ? (
          <Link
            to="/$username/about"
            params={{ username: user.username }}
            search={{ section: "personal_details" }}
            aria-label="Edit personal details"
            className="flex h-9 w-9 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
          >
            <Pencil size={20} strokeWidth={1.8} />
          </Link>
        ) : undefined
      }
    >
      <div className="pt-2">
        {rows.map((r, i) => (
          <DetailRow key={i} {...r} />
        ))}
        <Link
          to="/$username/about"
          params={{ username: user.username }}
          search={{ section: "personal_details" }}
          className="mt-1 ml-[52px] inline-block font-semibold text-[13px] text-secondary hover:underline"
        >
          See more personal details
        </Link>
      </div>
      {communities.top && (
        <section className="mt-6">
          <h3 className="font-bold text-[20px] text-primary leading-6">Communities</h3>
          <div className="pt-4">
            <CommunityList groups={communities.top} />
          </div>
          {(communities.all?.length ?? 0) > communities.top.length && (
            <Link
              to="/$username/$section"
              params={{ username: user.username, section: "groups" }}
              className="mt-3 ml-[52px] inline-block font-semibold text-[13px] text-secondary hover:underline"
            >
              See more communities
            </Link>
          )}
        </section>
      )}
      {job && (
        <IntroSection title="Work" more={{ label: "See more work", section: "work" }}>
          <OrgEntry kind="work" name={job.company} lines={[job.title, workDates(job)]} />
        </IntroSection>
      )}
      {school && (
        <IntroSection
          title="Education"
          more={{ label: "See more education", section: "education" }}
        >
          <OrgEntry
            kind="school"
            name={school.school}
            lines={[school.detail, schoolDates(school)]}
          />
        </IntroSection>
      )}
    </ProfileCard>
  );
}

/* ---------------- Photos preview ---------------- */

/** `postId` is null for the profile picture / cover photo (opens a plain lightbox). */
type PhotoRef = { postId: Id<"posts"> | null; index: number; url: string };
type VideoRef = { postId: Id<"posts">; index: number; url: string };

/** A square photo tile that opens the photo theater. */
export function PhotoTile({ photo, className }: { photo: PhotoRef; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("relative block aspect-square overflow-hidden bg-wash", className)}
      >
        <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-0 transition-colors hover:bg-black/10" />
      </button>
      {open &&
        (photo.postId ? (
          <PhotoOpener postId={photo.postId} index={photo.index} onClose={() => setOpen(false)} />
        ) : (
          <ImageLightbox src={photo.url} onClose={() => setOpen(false)} />
        ))}
    </>
  );
}

export function PhotosPreviewCard({ photos }: { photos: PhotoRef[] | undefined }) {
  return (
    <ProfileCard title="Photos" action={<CardLink to="/$username/photos">See all photos</CardLink>}>
      {photos && photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
          {photos.map((p) => (
            <PhotoTile key={`${p.postId}-${p.index}`} photo={p} />
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

/* ---------------- Friends preview ---------------- */

type FriendChip = { _id: string; name: string; username: string; avatar: string };

export function FriendsPreviewCard({
  friends,
  count,
  mutual,
}: {
  friends: FriendChip[] | undefined;
  count: number;
  mutual: number;
}) {
  return (
    <ProfileCard
      title={
        <span className="block">
          Friends
          {count > 0 && (
            <span className="mt-0.5 block font-normal text-[17px] text-secondary leading-5">
              {plural(count, "friend")}
              {mutual > 0 && ` (${mutual} mutual)`}
            </span>
          )}
        </span>
      }
      action={<CardLink to="/$username/friends">See all friends</CardLink>}
    >
      {friends && friends.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-[14px]">
          {friends.map((f) => (
            <Link
              key={f._id}
              to="/$username"
              params={{ username: f.username }}
              className="group min-w-0"
            >
              <img
                src={f.avatar}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-lg object-cover group-hover:brightness-95"
              />
              <span className="mt-1 line-clamp-2 font-semibold text-[13px] text-primary leading-4 group-hover:underline">
                {f.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

export function FooterLinks() {
  return (
    <p className="px-0 text-[13px] text-secondary leading-4">
      {FOOTER_LINKS.map((l) => (
        <span key={l}>
          <FooterLink label={l} className="font-semibold hover:underline" />
          {" · "}
        </span>
      ))}
      Meta © 2026
    </p>
  );
}

/* ---------------- Reels / Check-ins (full width) ---------------- */

export function ReelsCard() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const videos = useQ(api.profiles.videos, { userId: user._id });
  const [tab, setTab] = useState<"yours" | "saved">("yours");
  const [open, setOpen] = useState<VideoRef | null>(null);
  const [creating, setCreating] = useState(false);
  const tabs = isSelf
    ? [
        { key: "yours" as const, label: "Your reels" },
        { key: "saved" as const, label: "Saved reels" },
      ]
    : [{ key: "yours" as const, label: `${possessive(user.firstName)} reels` }];

  return (
    <ProfileCard
      title="Reels"
      action={
        isSelf ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md px-2 py-1 font-semibold text-[15px] text-link hover:bg-hover"
          >
            Create reel
          </button>
        ) : undefined
      }
    >
      <SubTabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "saved" ? (
        <CardEmpty>No saved reels</CardEmpty>
      ) : videos === undefined ? (
        <div className="h-24" />
      ) : videos.length === 0 ? (
        <CardEmpty>{isSelf ? "You haven't created any reels yet." : "No reels to show"}</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {videos.map((v) => (
            <button
              key={`${v.postId}-${v.index}`}
              type="button"
              onClick={() => setOpen(v)}
              className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black"
            >
              <video src={v.url} muted preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 transition-colors hover:bg-black/10" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <PhotoOpener postId={open.postId} index={open.index} onClose={() => setOpen(null)} />
      )}
      {isSelf && <CreateReelDialog open={creating} onClose={() => setCreating(false)} />}
    </ProfileCard>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export type Checkin = { place: string; region: string; createdAt: number; postId: Id<"posts"> };

export function CheckinsCard({ checkins }: { checkins: Checkin[] | undefined }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  return (
    <ProfileCard
      title="Check-ins"
      action={
        <CardMoreButton
          label="More options for check-ins"
          items={[
            {
              label: "See all check-ins",
              onSelect: () =>
                void navigate({
                  to: "/$username/$section",
                  params: { username: profile.user.username, section: "checkins" },
                }),
            },
          ]}
        />
      }
    >
      <SubTabs tabs={[{ key: "recent", label: "Recent" }]} value="recent" onChange={() => {}} />
      {checkins === undefined ? (
        <div className="h-24" />
      ) : checkins.length === 0 ? (
        <CardEmpty>No check-ins to show</CardEmpty>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
          {checkins.map((c) => (
            <Link
              key={c.place}
              to="/$username/posts/$postId"
              params={{ username: profile.user.username, postId: c.postId }}
              className="flex items-center gap-4 rounded-[10px] border border-divider p-4 transition-colors hover:bg-hover"
            >
              <PinTile />
              <div className="min-w-0">
                <div className="truncate font-semibold text-[17px] text-primary leading-[22px]">
                  {c.place}
                </div>
                <div className="truncate text-[13px] text-secondary leading-4">{c.region}</div>
                <div className="truncate text-[13px] text-secondary leading-4">
                  Visited on {dateFmt.format(c.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

/** Facebook's place placeholder: a grey-blue tile with a white pin. */
function PinTile() {
  return (
    <span
      aria-hidden
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[#c3cbde] dark:bg-[#4e4f50]"
    >
      <svg viewBox="0 0 24 32" width={30} height={40}>
        <path
          d="M12 0C5.4 0 0 5.2 0 11.7 0 20.3 12 32 12 32s12-11.7 12-20.3C24 5.2 18.6 0 12 0Z"
          className="fill-white dark:fill-[#b0b3b8]"
        />
        <circle cx="12" cy="11.5" r="4.2" className="fill-[#c3cbde] dark:fill-[#4e4f50]" />
      </svg>
    </span>
  );
}

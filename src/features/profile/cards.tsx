import { Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Cake,
  Clock,
  GraduationCap,
  Heart,
  Home,
  Info,
  MapPin,
  MoreHorizontal,
  Pencil,
  Users,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn, compactCount, plural } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { birthdayLabel, joinedLabel, possessive, useProfile } from "./context";
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

function schoolVerb(school: string, isSelf: boolean) {
  const past = /high school|academy|secondary/i.test(school);
  if (past) return "Went to";
  return isSelf ? "Studies at" : "Studied at";
}

/** The left "Personal details" card (pages: "Intro"). */
export function IntroCard() {
  const { profile } = useProfile();
  const { user, isSelf, isPage } = profile;

  if (isPage)
    return (
      <ProfileCard title="Intro">
        {user.bio && <p className="py-3 text-center text-[15px] text-primary">{user.bio}</p>}
        <div className="pt-1">
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
          <DetailRow icon={Users} text={`${compactCount(profile.followerCount)} followers`} />
        </div>
      </ProfileCard>
    );

  const rows: Row[] = [];
  for (const w of user.work)
    rows.push({
      icon: Briefcase,
      text: w.title ? `${w.title} at ${w.company}` : `Works at ${w.company}`,
    });
  for (const e of user.education)
    rows.push({ icon: GraduationCap, text: `${schoolVerb(e.school, isSelf)} ${e.school}` });
  if (user.city) rows.push({ icon: MapPin, text: `Lives in ${user.city}` });
  if (user.hometown) rows.push({ icon: Home, text: `From ${user.hometown}` });
  if (user.relationship) rows.push({ icon: Heart, text: user.relationship });
  if (user.birthday) rows.push({ icon: Cake, text: birthdayLabel(user.birthday) });
  rows.push({ icon: Clock, text: joinedLabel(user.joinedAt) });

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
  const links = ["Privacy", "Terms", "Advertising", "Ad Choices", "Cookies", "More"];
  return (
    <p className="px-0 text-[13px] text-secondary leading-4">
      {links.map((l) => (
        <span key={l}>
          <Link to="/settings" className="font-semibold hover:underline">
            {l}
          </Link>
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
          <Link
            to="/reel"
            className="rounded-md px-2 py-1 font-semibold text-[15px] text-link hover:bg-hover"
          >
            Create reel
          </Link>
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
    </ProfileCard>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function CheckinsCard({
  checkins,
}: {
  checkins: { place: string; createdAt: number; postId: Id<"posts"> }[] | undefined;
}) {
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
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 min-[900px]:grid-cols-2">
          {checkins.map((c) => {
            const [title, ...rest] = c.place.split(",");
            return (
              <Link
                key={c.place}
                to="/$username/posts/$postId"
                params={{ username: profile.user.username, postId: c.postId }}
                className="flex items-center gap-4 rounded-lg p-1 hover:bg-hover"
              >
                <MapThumb />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[17px] text-primary">{title}</div>
                  {rest.length > 0 && (
                    <div className="truncate text-[13px] text-secondary">
                      {rest.join(",").trim()}
                    </div>
                  )}
                  <div className="text-[13px] text-secondary">
                    Visited on {dateFmt.format(c.createdAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ProfileCard>
  );
}

/** Stylized 80px map tile with a pin (stands in for Facebook's static map). */
function MapThumb() {
  return (
    <svg viewBox="0 0 80 80" width={80} height={80} className="shrink-0 rounded-lg" aria-hidden>
      <rect width="80" height="80" fill="#e8eef3" />
      <path d="M0 52 80 34v8L0 60Z" fill="#fff" />
      <path d="M28 0h7l-9 80h-7Z" fill="#fff" />
      <path d="M52 0h4l6 80h-4Z" fill="#fdf1c9" />
      <rect x="40" y="8" width="20" height="16" rx="2" fill="#cfe8c9" />
      <rect x="4" y="64" width="18" height="12" rx="2" fill="#cfe8c9" />
      <path
        d="M40 22c-6 0-10 4.4-10 9.6C30 39 40 48 40 48s10-9 10-16.4C50 26.4 46 22 40 22Z"
        fill="#e41e3f"
      />
      <circle cx="40" cy="31.5" r="3.6" fill="#fff" />
    </svg>
  );
}

import { Link, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { Flag, Link2, Share2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { cn } from "@/lib/format";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Tooltip,
} from "@/ui/overlays";
import { Avatar, Button, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { GroupContext, type GroupView, isMember } from "./context";
import { GroupCard } from "./GroupCard";
import { GroupSearchDialog } from "./GroupSearchDialog";
import { InviteDialog } from "./InviteDialog";
import {
  CalendarGlyph,
  ChevronDownGlyph,
  GlobeGlyph,
  JoinedGlyph,
  JoinGlyph,
  LeaveGlyph,
  LockGlyph,
  PlusGlyph,
  SearchGlyph,
  ShareGlyph,
} from "./icons";
import { membersLabel, privacyLabel } from "./util";

/** Layout for /groups/$groupId/*: hero, header, tabs, then the tab's content. */
export function GroupPage() {
  const { groupId } = useParams({ from: "/groups/$groupId" });
  const group = useQ(api.groups.get, { idOrSlug: groupId });
  const visit = useM(api.groups.visit);
  const gid = group?._id;
  const member = group ? isMember(group) : false;

  useEffect(() => {
    if (gid && member) void visit({ groupId: gid });
  }, [gid, member, visit]);

  useEffect(() => {
    if (group) document.title = `${group.name} | Facebook`;
    return () => {
      document.title = "Facebook";
    };
  }, [group]);

  if (group === undefined) return <HeaderSkeleton />;
  if (group === null) return <GroupNotFound />;

  return (
    <GroupContext.Provider value={group}>
      <div className="min-h-[calc(100vh-56px)]">
        <GroupHeader group={group} />
        <div className="mx-auto w-full max-w-[1250px] px-4 pt-3 pb-10 min-[1250px]:px-8">
          {group.invite && <InviteBanner group={group} />}
          <Outlet />
        </div>
      </div>
    </GroupContext.Provider>
  );
}

/* ---------------- Header ---------------- */

const TABS = [
  { label: "About", to: "/groups/$groupId/about" },
  { label: "Discussion", to: "/groups/$groupId" },
  { label: "Featured", to: "/groups/$groupId/featured" },
  { label: "People", to: "/groups/$groupId/members" },
  { label: "Media", to: "/groups/$groupId/media" },
  { label: "Files", to: "/groups/$groupId/files" },
] as const;

function GroupHeader({ group }: { group: GroupView }) {
  const [showRelated, setShowRelated] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // When the tab row sticks under the top bar, swap tabs for the compact group title.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="relative bg-card shadow-[0_1px_2px_var(--shadow-1)]">
        {/* Blurred cover wash that fades to the card color, like Facebook's hero. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
          aria-hidden
        >
          <img
            src={group.cover}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[40px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-card/0" />
        </div>
        <div className="relative mx-auto w-full max-w-[1250px]">
          <div className="relative aspect-[1250/463] max-h-[463px] w-full overflow-hidden rounded-b-lg bg-btn">
            <img
              src={group.cover}
              alt={`${group.name} cover`}
              className="h-full w-full object-cover"
            />
            {group.creator && (
              <div className="absolute inset-x-0 bottom-0 flex h-[43px] items-center bg-fb px-4 text-[15px] text-white leading-5">
                <span className="font-medium">Group by&nbsp;</span>
                <Link
                  to="/$username"
                  params={{ username: group.creator.username }}
                  className="font-semibold hover:underline"
                >
                  {group.creator.name}
                </Link>
              </div>
            )}
          </div>
          <div className="px-4 min-[1250px]:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 pt-[27px] pb-[25px]">
              <div className="min-w-0">
                <h1 className="font-bold text-[28px] text-primary leading-8">
                  <Link
                    to="/groups/$groupId"
                    params={groupParams(group)}
                    className="hover:underline"
                  >
                    {group.name}
                  </Link>
                </h1>
                <div className="mt-1.5 flex items-center gap-1 text-[15px] text-secondary leading-5">
                  {group.privacy === "public" ? <GlobeGlyph size={12} /> : <LockGlyph size={12} />}
                  <span>{privacyLabel(group.privacy)}</span>
                  <span aria-hidden>·</span>
                  <Link
                    to="/groups/$groupId/members"
                    params={groupParams(group)}
                    className="font-semibold hover:underline"
                  >
                    {membersLabel(group.memberCount, true)}
                  </Link>
                </div>
              </div>
              <HeaderActions
                group={group}
                related={showRelated}
                onToggleRelated={() => setShowRelated((s) => !s)}
              />
            </div>
            {showRelated && <RelatedGroups groupId={group._id} />}
            <div className="h-px bg-divider" />
          </div>
        </div>
      </div>
      <div ref={sentinel} className="h-0" aria-hidden />
      <TabBar group={group} stuck={stuck} />
    </>
  );
}

function HeaderActions({
  group,
  related,
  onToggleRelated,
}: {
  group: GroupView;
  related: boolean;
  onToggleRelated: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {isMember(group) && <MemberFacepile group={group} />}
      {isMember(group) ? (
        <>
          <Button
            variant="primary"
            icon={<PlusGlyph size={16} />}
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </Button>
          <ShareButton group={group} />
          <JoinedMenu group={group} />
        </>
      ) : (
        <>
          <JoinButton group={group} />
          <ShareButton group={group} />
        </>
      )}
      <Tooltip content="See recommended groups">
        <button
          type="button"
          aria-label="See recommended groups"
          aria-expanded={related}
          onClick={onToggleRelated}
          className={cn(
            "flex h-9 w-12 items-center justify-center rounded-md transition-colors",
            related
              ? "bg-highlight text-link"
              : "bg-btn text-icon hover:brightness-95 dark:hover:brightness-125",
          )}
        >
          <ChevronDownGlyph
            size={16}
            className={cn("transition-transform", related && "rotate-180")}
          />
        </button>
      </Tooltip>
      {inviteOpen && <InviteDialog group={group} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

/** Overlapping member avatars beside the header buttons (kept on the button row so the header height matches Facebook's). */
function MemberFacepile({ group }: { group: GroupView }) {
  if (group.memberPreview.length === 0) return null;
  return (
    <Link
      to="/groups/$groupId/members"
      params={groupParams(group)}
      className="mr-2 hidden min-[1100px]:flex"
      aria-label="See members"
    >
      {group.memberPreview.slice(0, 8).map((u, i) => (
        <Tooltip key={u._id} content={u.name}>
          <span
            className={cn("rounded-full ring-2 ring-card", i > 0 && "-ml-2")}
            style={{ zIndex: 20 - i }}
          >
            <Avatar src={u.avatar} size={32} />
          </span>
        </Tooltip>
      ))}
    </Link>
  );
}

export function JoinButton({ group, className }: { group: GroupView; className?: string }) {
  const join = useM(api.groups.join);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="primary"
      className={className}
      icon={<JoinGlyph size={16} />}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void join({ groupId: group._id }).finally(() => setBusy(false));
      }}
    >
      Join group
    </Button>
  );
}

function JoinedMenu({ group }: { group: GroupView }) {
  const leave = useM(api.groups.leave);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild>
          <Button variant="secondary" icon={<JoinedGlyph size={16} />}>
            Joined
            <ChevronDownGlyph size={16} />
          </Button>
        </MenuTrigger>
        <MenuContent width={320}>
          <MenuItem
            icon={<LeaveGlyph size={20} />}
            label="Leave group"
            onSelect={() => setConfirm(true)}
          />
        </MenuContent>
      </Menu>
      <Modal open={confirm} onOpenChange={setConfirm} title={`Leave ${group.name}?`} width={548}>
        <div className="p-4 text-[15px] text-primary">
          {group.privacy === "private"
            ? "Are you sure you want to leave this group? You won't be able to see posts or rejoin without approval."
            : "Are you sure you want to leave this group? You can rejoin any time."}
          {group.viewerRole === "admin" &&
          group.staff.filter((s) => s.role === "admin").length === 1
            ? " You're the only admin. The group will have no admins after you leave."
            : ""}
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="link" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="min-w-[110px]"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void leave({ groupId: group._id })
                .then(() => setConfirm(false))
                .finally(() => setBusy(false));
            }}
          >
            Leave group
          </Button>
        </div>
      </Modal>
    </>
  );
}

function groupUrl(group: GroupView) {
  return `${window.location.origin}/groups/${group.slug}`;
}

function ShareButton({ group }: { group: GroupView }) {
  const create = useM(api.posts.create);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 2500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild>
          <Button variant="secondary" icon={<ShareGlyph size={16} />}>
            Share
          </Button>
        </MenuTrigger>
        <MenuContent width={300}>
          <MenuItem
            icon={<Share2 size={20} />}
            label="Share to Feed"
            onSelect={() =>
              void create({
                privacy: "friends",
                attachments: [
                  {
                    kind: "link",
                    url: `/groups/${group.slug}`,
                    title: group.name,
                    domain: "facebook.com",
                    description: `${privacyLabel(group.privacy)} · ${membersLabel(group.memberCount, true)}`,
                    image: group.cover,
                  },
                ],
              }).then(() => setDone("Shared to your Feed."))
            }
          />
          <MenuItem
            icon={<Link2 size={20} />}
            label="Copy link"
            onSelect={() =>
              void navigator.clipboard
                ?.writeText(groupUrl(group))
                .then(() => setDone("Link copied to clipboard."))
            }
          />
        </MenuContent>
      </Menu>
      {done && <Toast>{done}</Toast>}
    </>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-6 z-[70] rounded-lg bg-[#323436] px-4 py-3 text-[15px] text-white shadow-elevated"
    >
      {children}
    </div>
  );
}

function TabBar({ group, stuck }: { group: GroupView; stuck: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const rest = decodeURIComponent(pathname)
    .replace(/^\/groups\/[^/]+/, "")
    .replace(/\/$/, "");
  const activeLabel =
    rest === ""
      ? "Discussion"
      : rest === "/about"
        ? "About"
        : rest === "/featured"
          ? "Featured"
          : rest === "/members"
            ? "People"
            : rest === "/media"
              ? "Media"
              : rest === "/files"
                ? "Files"
                : rest === "/events"
                  ? "Events"
                  : null;
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="sticky top-14 z-20 bg-card shadow-[0_1px_2px_var(--shadow-1)]">
      <div className="mx-auto flex h-[60px] w-full max-w-[1250px] items-center justify-between px-4 min-[1250px]:px-8">
        {stuck ? (
          // Facebook's stuck bar is blank on the left: just search + … on the right.
          <div />
        ) : (
          <nav aria-label="Group sections" className="flex h-full items-stretch">
            {TABS.map((t) => (
              <TabLink key={t.label} group={group} to={t.to} active={activeLabel === t.label}>
                {t.label}
              </TabLink>
            ))}
            {/* Facebook's tab row is just these six; Events opens from the … menu. */}
            {activeLabel === "Events" && (
              <TabLink group={group} to="/groups/$groupId/events" active>
                Events
              </TabLink>
            )}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <Tooltip content="Search within this group">
            <button
              type="button"
              aria-label="Search within this group"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
            >
              <SearchGlyph size={16} />
            </button>
          </Tooltip>
          <MoreMenu group={group} />
        </div>
      </div>
      {searchOpen && <GroupSearchDialog group={group} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function TabLink({
  group,
  to,
  active,
  children,
}: {
  group: GroupView;
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={groupParams(group)}
      className={cn(
        "relative flex items-center px-1 font-semibold text-[15px]",
        active ? "text-link" : "text-secondary",
      )}
    >
      <span className={cn("rounded-md px-3 py-[10px]", !active && "hover:bg-hover")}>
        {children}
      </span>
      {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-[1px] bg-fb" />}
    </Link>
  );
}

function MoreMenu({ group }: { group: GroupView }) {
  const navigate = useNavigate();
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <>
      <Menu modal={false}>
        <Tooltip content="More">
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
                <circle cx="4" cy="10" r="2" />
                <circle cx="10" cy="10" r="2" />
                <circle cx="16" cy="10" r="2" />
              </svg>
            </button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent width={320}>
          <MenuItem
            icon={<CalendarGlyph size={20} />}
            label="Events"
            onSelect={() =>
              void navigate({ to: "/groups/$groupId/events", params: groupParams(group) })
            }
          />
          <MenuItem
            icon={<Link2 size={20} />}
            label="Copy link"
            onSelect={() =>
              void navigator.clipboard?.writeText(groupUrl(group)).then(() => setCopied(true))
            }
          />
          <MenuSeparator />
          <MenuItem
            icon={<Flag size={20} />}
            label="Report group"
            onSelect={() => setReported(true)}
          />
        </MenuContent>
      </Menu>
      {copied && <Toast>Link copied to clipboard.</Toast>}
      <Modal open={reported} onOpenChange={setReported} title="Report" width={548}>
        <div className="p-4 text-[15px]">
          <p className="font-semibold text-[17px]">Thanks for letting us know</p>
          <p className="mt-1 text-secondary">
            Your feedback helps us keep Facebook safe. We'll review {group.name} against our
            Community Standards.
          </p>
        </div>
        <div className="flex justify-end px-4 pb-4">
          <Button variant="primary" onClick={() => setReported(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </>
  );
}

function RelatedGroups({ groupId }: { groupId: GroupView["_id"] }) {
  const [since] = useState(() => Date.now());
  const data = useQ(api.groups.discover, { since });
  const list = (data?.suggested ?? []).filter((g) => g._id !== groupId).slice(0, 3);
  return (
    <div className="pb-4">
      <h2 className="mb-3 font-bold text-[20px] text-primary">Related groups</h2>
      {data === undefined ? (
        <Skeleton className="h-[300px] w-full rounded-xl" />
      ) : list.length === 0 ? (
        <p className="text-[15px] text-secondary">No related groups right now.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto">
          {list.map((g) => (
            <GroupCard key={g._id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteBanner({ group }: { group: GroupView }) {
  const decline = useM(api.groups.declineInvite);
  const invite = group.invite;
  if (!invite) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-card p-4 shadow-base">
      <Avatar src={invite.from.avatar} size={40} />
      <p className="min-w-0 flex-1 text-[15px] text-primary">
        <Link
          to="/$username"
          params={{ username: invite.from.username }}
          className="font-semibold hover:underline"
        >
          {invite.from.name}
        </Link>{" "}
        invited you to join this group.
      </p>
      <JoinButton group={group} />
      <Button variant="secondary" onClick={() => void decline({ groupId: group._id })}>
        Decline
      </Button>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="bg-card">
      <div className="mx-auto max-w-[1250px]">
        <Skeleton className="aspect-[1250/463] max-h-[463px] w-full rounded-none rounded-b-lg" />
        <div className="px-8 py-6">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="mt-3 h-4 w-60" />
        </div>
      </div>
    </div>
  );
}

function GroupNotFound() {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center">
      <p className="font-bold text-[20px] text-secondary">This content isn't available right now</p>
      <p className="mt-2 max-w-md text-[17px] text-secondary">
        When this happens, it's usually because the owner only shared it with a small group of
        people, changed who can see it or it's been deleted.
      </p>
      <Link
        to="/groups/feed"
        className="mt-5 flex h-9 items-center rounded-md bg-btn-primary px-4 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
      >
        Go to your feed
      </Link>
    </div>
  );
}

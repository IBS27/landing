import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { FacebookLogo } from "@/icons";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ChevronDownGlyph, EyeGlyph, EyeOffGlyph, GlobeGlyph, LockGlyph } from "./icons";

type Privacy = "public" | "private";
type Friend = { _id: Id<"users">; name: string; avatar: string };

const PRIVACY: Record<Privacy, { label: string; sub: string; icon: ReactNode }> = {
  public: {
    label: "Public",
    sub: "Anyone can see who's in the group and what they post.",
    icon: <GlobeGlyph size={20} />,
  },
  private: {
    label: "Private",
    sub: "Only members can see who's in the group and what they post.",
    icon: <LockGlyph size={20} />,
  },
};

/** /groups/create: settings panel on the left, live desktop preview on the right. */
export function CreateGroupPage() {
  const viewer = useViewer();
  const create = useM(api.groups.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [visible, setVisible] = useState(true);
  const [invited, setInvited] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && privacy !== null && !busy;

  const submit = async () => {
    if (!ready || !privacy) return;
    setBusy(true);
    setError(null);
    try {
      const { slug } = await create({
        name,
        privacy,
        visible: privacy === "private" ? visible : true,
        invite: invited.map((f) => f._id),
      });
      await navigate({ to: "/groups/$groupId", params: { groupId: slug } });
    } catch (e) {
      setError(
        e instanceof Error ? e.message.replace(/^.*ConvexError: /, "") : "Something went wrong",
      );
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-stretch">
      <aside className="sticky top-14 flex h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_2px_var(--shadow-1)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3">
          <div className="flex items-center gap-2">
            <Link
              to="/groups/feed"
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
            >
              <X size={20} strokeWidth={2.4} />
            </Link>
            <FacebookLogo size={40} />
          </div>
          <p className="mt-4 text-[13px] text-secondary">
            <Link to="/groups/feed" className="hover:underline">
              Groups
            </Link>{" "}
            › Create group
          </p>
          <h1 className="font-bold text-[24px] text-primary leading-7">Create group</h1>
          <div className="mt-4 flex items-center gap-3">
            <Avatar src={viewer.avatar} size={40} />
            <div>
              <p className="font-semibold text-[15px] text-primary">{viewer.name}</p>
              <p className="text-[13px] text-secondary">Admin</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <FloatingInput label="Group name" value={name} onChange={setName} maxLength={75} />
            <Select
              label="Choose privacy"
              value={privacy ? PRIVACY[privacy] : null}
              options={(Object.keys(PRIVACY) as Privacy[]).map((k) => ({
                key: k,
                ...PRIVACY[k],
                onSelect: () => setPrivacy(k),
                selected: privacy === k,
              }))}
            />
            {privacy === "public" && (
              <p className="px-1 text-[13px] text-secondary">
                Members and visitors can post in the group. Admins can review the first post of new
                members.
              </p>
            )}
            {privacy === "private" && (
              <Select
                label="Hide group"
                value={visible ? VISIBILITY.visible : VISIBILITY.hidden}
                options={[
                  {
                    key: "visible",
                    ...VISIBILITY.visible,
                    selected: visible,
                    onSelect: () => setVisible(true),
                  },
                  {
                    key: "hidden",
                    ...VISIBILITY.hidden,
                    selected: !visible,
                    onSelect: () => setVisible(false),
                  },
                ]}
              />
            )}
            <InviteFriends invited={invited} onChange={setInvited} />
          </div>
          {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
        </div>
        <div className="border-divider border-t p-4">
          <Button variant="primary" block disabled={!ready} onClick={() => void submit()}>
            Create
          </Button>
        </div>
      </aside>
      <Preview name={name} privacy={privacy} invitedCount={invited.length} />
    </div>
  );
}

const VISIBILITY = {
  visible: { label: "Visible", sub: "Anyone can find this group.", icon: <EyeGlyph size={20} /> },
  hidden: {
    label: "Hidden",
    sub: "Only members can find this group.",
    icon: <EyeOffGlyph size={20} />,
  },
};

function FloatingInput({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <label className="group relative block h-14 rounded-md border border-divider focus-within:border-fb focus-within:shadow-[0_0_0_1px_var(--fb-blue)]">
      <span
        className={cn(
          "pointer-events-none absolute left-3 text-secondary transition-all",
          value
            ? "top-2 text-[12px]"
            : "top-4 text-[17px] group-focus-within:top-2 group-focus-within:text-[12px] group-focus-within:text-fb",
        )}
      >
        {label}
      </span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-x-3 bottom-1.5 bg-transparent text-[17px] text-primary outline-none"
      />
    </label>
  );
}

type Option = {
  key: string;
  label: string;
  sub: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
};

function Select({
  label,
  value,
  options,
}: {
  label: string;
  value: { label: string; icon: ReactNode } | null;
  options: Option[];
}) {
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex h-14 w-full items-center gap-2 rounded-md border border-divider px-3 text-left outline-none focus-visible:border-fb data-[state=open]:border-fb"
        >
          <span className="min-w-0 flex-1">
            {value ? (
              <>
                <span className="block text-[12px] text-secondary">{label}</span>
                <span className="flex items-center gap-1.5 text-[17px] text-primary">
                  {value.label}
                </span>
              </>
            ) : (
              <span className="text-[17px] text-secondary">{label}</span>
            )}
          </span>
          <ChevronDownGlyph size={20} className="text-icon" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" width={328}>
        {options.map((o) => (
          <MenuItem
            key={o.key}
            icon={o.icon}
            label={
              <span className="flex items-center justify-between gap-2">
                {o.label}
                <span
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full border-2",
                    o.selected ? "border-[6px] border-fb" : "border-icon-secondary",
                  )}
                />
              </span>
            }
            sub={o.sub}
            onSelect={o.onSelect}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

function InviteFriends({
  invited,
  onChange,
}: {
  invited: Friend[];
  onChange: (f: Friend[]) => void;
}) {
  const friends = useQ(api.groups.friendsToInvite, {});
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const chosen = new Set(invited.map((f) => f._id));
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (friends ?? [])
      .filter((f) => !chosen.has(f._id) && (!term || f.name.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [friends, q, chosen]);

  return (
    <div>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Invite friends (optional)"
          aria-label="Invite friends (optional)"
          className="h-14 w-full rounded-md border border-divider bg-transparent px-3 text-[17px] text-primary outline-none placeholder:text-secondary focus:border-fb focus:shadow-[0_0_0_1px_var(--fb-blue)]"
        />
        {focused && matches.length > 0 && (
          <div className="absolute inset-x-0 top-[60px] z-20 max-h-[300px] overflow-y-auto rounded-lg bg-popover p-2 shadow-elevated">
            {matches.map((f) => (
              <button
                key={f._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([...invited, { _id: f._id, name: f.name, avatar: f.avatar }]);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover"
              >
                <Avatar src={f.avatar} size={36} />
                <span className="font-medium text-[15px] text-primary">{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {invited.length === 0 ? (
        <p className="mt-2 px-1 text-[13px] text-secondary">
          Your friends can also be invited after the group is created.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {invited.map((f) => (
            <span
              key={f._id}
              className="flex h-8 items-center gap-1.5 rounded-full bg-highlight pr-1 pl-1 text-[15px] text-link"
            >
              <Avatar src={f.avatar} size={24} />
              {f.name}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(invited.filter((x) => x._id !== f._id))}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-hover"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Preview({
  name,
  privacy,
  invitedCount,
}: {
  name: string;
  privacy: Privacy | null;
  invitedCount: number;
}) {
  return (
    <main className="flex min-w-0 flex-1 items-start justify-center p-4 pt-6 min-[1200px]:px-12">
      <div className="w-full max-w-[1000px] rounded-xl bg-card p-4 shadow-base">
        <p className="mb-3 font-semibold text-[15px] text-primary">Desktop preview</p>
        <div className="overflow-hidden rounded-lg border border-divider">
          <div className="relative aspect-[1250/400] w-full bg-gradient-to-br from-[#E4E6EB] to-[#C9CCD1] dark:from-[#3A3B3C] dark:to-[#2A2B2C]">
            <svg
              viewBox="0 0 120 80"
              width="160"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80"
              aria-hidden
            >
              <rect
                x="18"
                y="12"
                width="84"
                height="56"
                rx="6"
                className="fill-white/70 dark:fill-white/10"
              />
              <circle cx="42" cy="32" r="8" fill="#0866FF" opacity=".8" />
              <path d="M24 62 50 40l16 12 14-10 16 20Z" className="fill-[#B0B3B8]" />
            </svg>
          </div>
          <div className="px-6 pt-5 pb-0">
            <p
              className={cn(
                "font-bold text-[28px] leading-8",
                name.trim() ? "text-primary" : "text-disabled",
              )}
            >
              {name.trim() || "Group name"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[15px] text-secondary">
              {privacy === "private" ? (
                <LockGlyph size={12} />
              ) : privacy === "public" ? (
                <GlobeGlyph size={12} />
              ) : null}
              {privacy ? `${PRIVACY[privacy].label} group` : "Group privacy"} · 1 member
              {invitedCount > 0 && ` · ${invitedCount} invited`}
            </p>
            <div className="mt-4 h-px bg-divider" />
            <div className="flex h-12 items-stretch gap-1">
              {["About", "Posts", "Members", "Events"].map((t) => (
                <span
                  key={t}
                  className="flex items-center px-3 font-semibold text-[15px] text-disabled"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3 bg-wash p-4">
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-[110px] rounded-lg bg-card shadow-base" />
              <div className="h-[180px] rounded-lg bg-card shadow-base" />
            </div>
            <div className="w-[38%]">
              <div className="rounded-lg bg-card p-4 shadow-base">
                <p className="font-semibold text-[17px] text-primary">About</p>
                {privacy && (
                  <div className="mt-3 flex gap-2 text-primary">
                    {PRIVACY[privacy].icon}
                    <div>
                      <p className="text-[15px]">{PRIVACY[privacy].label}</p>
                      <p className="text-[13px] text-secondary">{PRIVACY[privacy].sub}</p>
                    </div>
                  </div>
                )}
                {!privacy && <div className="mt-3 h-10 rounded bg-wash" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

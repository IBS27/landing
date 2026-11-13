import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Home, Search, UserPlus, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { toGroup } from "@/landing/links";
import { LandingPage } from "@/landing/shell/LandingPage";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NAME_MAX } from "../../../convex/lib/house";
import type { UserSummary } from "../../../convex/lib/users";
import { BillsCard, ChoresCard, errorText, field, GroceriesCard } from "./HouseSections";

/**
 * `/landing/place/house` (#38): the viewer's House Group — chores, bills and
 * the grocery list their roommates share — or, without one, invites to join
 * and a form to start one. `?group=<slug>` picks a house when there are several.
 */
export function HousePage({ group }: { group?: string }) {
  const data = useQ(api.house.page, group ? { slug: group } : {});
  if (data === undefined) return <PageSkeleton />;
  if (data === null) return <NoHouse missing={group !== undefined} />;
  if (data.state === "invited") return <Invited invite={data} />;
  return <HouseView data={data} />;
}

type PageData = NonNullable<FunctionReturnType<typeof api.house.page>>;
type MemberData = Extract<PageData, { state: "member" }>;
type InviteData = Extract<PageData, { state: "invited" }>;

/* ───────────── A house ───────────── */

function HouseView({ data }: { data: MemberData }) {
  const { house, members, invited } = data;
  const mine = useQ(api.house.mine, {});
  const [inviting, setInviting] = useState(false);
  const others = (mine?.houses ?? []).filter((h) => h._id !== house._id);
  return (
    <LandingPage
      title={house.name}
      description="Your House Group: chores, bills and groceries for the people who live here. Only they can see them."
      actions={
        <>
          {/* Icon-only on phones, so the house's name keeps the room. */}
          <Button
            variant="secondary"
            icon={<UserPlus size={16} />}
            onClick={() => setInviting(true)}
          >
            <span className="max-sm:sr-only">Invite</span>
          </Button>
          <Link
            {...toGroup({ slug: house.slug })}
            className="flex h-9 items-center gap-1.5 rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white transition-colors hover:bg-btn-primary-hover"
          >
            <UsersRound size={16} aria-hidden />
            <span className="max-sm:sr-only">Open Group</span>
          </Link>
        </>
      }
    >
      <Card className="mb-4 p-4">
        <h2 className="font-semibold text-[15px] text-primary">Who lives here</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {members.map((m) => (
            <li key={m._id} className="flex items-center gap-2">
              <Avatar src={m.avatar} size={28} />
              <span className="text-[15px] text-primary">{m.name}</span>
            </li>
          ))}
        </ul>
        {invited.length > 0 && <InvitedList houseId={house._id} invited={invited} />}
        {others.length > 0 && (
          <p className="mt-2 text-[13px] text-secondary">
            Your other {others.length === 1 ? "house" : "houses"}:{" "}
            {others.map((h, i) => (
              <span key={h._id}>
                {i > 0 && ", "}
                <Link
                  to="/landing/place/house"
                  search={{ group: h.slug }}
                  className="font-semibold text-link hover:underline"
                >
                  {h.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </Card>
      <ChoresCard houseId={house._id} chores={data.chores} members={members} />
      <BillsCard houseId={house._id} bills={data.bills} today={data.today} />
      <GroceriesCard houseId={house._id} groceries={data.groceries} />
      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        houseId={house._id}
        houseName={house.name}
      />
    </LandingPage>
  );
}

/* ───────────── Invites ───────────── */

function Invited({ invite }: { invite: InviteData }) {
  return (
    <LandingPage title="House" description="A House Group you've been invited to.">
      <InviteRow invite={invite} />
    </LandingPage>
  );
}

/** "Ana invited you to Dwight Way house" with Join and Decline. */
function InviteRow({
  invite,
}: {
  invite: {
    house: { _id: Id<"houses">; groupId: Id<"groups">; slug: string; name: string };
    invitedBy: UserSummary;
  };
}) {
  const join = useM(api.groups.join);
  const decline = useM(api.house.declineInvite);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Avatar src={invite.invitedBy.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-primary leading-5">
          <span className="font-semibold">{invite.invitedBy.name}</span> invited you to{" "}
          <span className="font-semibold">{invite.house.name}</span>, their House Group.
        </p>
        <p className="text-[13px] text-secondary">
          Join to share chores, bills and the grocery list. Only people who live there can see them.
        </p>
        {error && <p className="mt-1 text-[13px] text-negative">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => act(() => decline({ houseId: invite.house._id }))}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await join({ groupId: invite.house.groupId });
              await navigate({ to: "/landing/place/house", search: { group: invite.house.slug } });
            })
          }
        >
          Join
        </Button>
      </div>
    </Card>
  );
}

/* ───────────── No house yet ───────────── */

function NoHouse({ missing }: { missing: boolean }) {
  const mine = useQ(api.house.mine, {});
  return (
    <LandingPage
      title="House"
      description="A House Group for you and your roommates: chores, bills and a shared grocery list, seen only by the people who live there."
    >
      {missing && (
        <Card className="mb-3 p-4 text-[15px] text-secondary">
          That house isn't one you live in. Start one below, or ask a roommate to invite you.
        </Card>
      )}
      {mine?.invites.map((i) => (
        <InviteRow key={i._id} invite={{ house: i, invitedBy: i.invitedBy }} />
      ))}
      <CreateHouse />
    </LandingPage>
  );
}

function CreateHouse() {
  const create = useM(api.house.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<Id<"users">>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { slug } = await create({ name, invite: [...picked] });
      await navigate({ to: "/landing/place/house", search: { group: slug } });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <Home size={20} aria-hidden />
        </span>
        <div>
          <h2 className="font-bold text-[17px] text-primary leading-[22px]">Start a House Group</h2>
          <p className="text-[13px] text-secondary leading-4">
            A private, hidden Facebook Group. Nobody can join without an invite, and it's never put
            on a map.
          </p>
        </div>
      </div>
      <label className="mt-4 flex flex-col gap-1">
        <span className="font-semibold text-[13px] text-secondary">Name</span>
        <input
          className={field}
          placeholder="Dwight Way house"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <span className="font-semibold text-[13px] text-secondary">
          Invite the people you live with
        </span>
        <FriendPicker picked={picked} onChange={setPicked} className="mt-1" />
      </div>
      {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "Creating…" : picked.size > 0 ? `Create and invite ${picked.size}` : "Create"}
        </Button>
      </div>
    </Card>
  );
}

/* ───────────── Picking friends ───────────── */

function FriendPicker({
  houseId,
  picked,
  onChange,
  className,
}: {
  houseId?: Id<"houses">;
  picked: ReadonlySet<Id<"users">>;
  onChange: (next: ReadonlySet<Id<"users">>) => void;
  className?: string;
}) {
  const options = useQ(api.house.inviteOptions, houseId ? { houseId } : {});
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = (options ?? []).filter((u) => !needle || u.name.toLowerCase().includes(needle));
  const toggle = (id: Id<"users">) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div className={cn("rounded-lg border border-divider", className)}>
      <label className="flex items-center gap-2 border-divider border-b px-3 py-2 text-secondary">
        <Search size={16} aria-hidden />
        <span className="sr-only">Search your friends</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your friends"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
      </label>
      <ul className="max-h-60 overflow-y-auto py-1">
        {options === undefined ? (
          <li className="space-y-2 p-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-3 text-[13px] text-secondary">
            {options.length === 0
              ? "No friends left to invite."
              : `No friends called "${q.trim()}".`}
          </li>
        ) : (
          shown.map((u) => (
            <li key={u._id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-hover">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={picked.has(u._id)}
                  onChange={() => toggle(u._id)}
                />
                <Avatar src={u.avatar} size={28} />
                <span className="text-[15px] text-primary">{u.name}</span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Pending invites, each of which anyone in the house can withdraw. */
function InvitedList({ houseId, invited }: { houseId: Id<"houses">; invited: UserSummary[] }) {
  const cancel = useM(api.house.cancelInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withdraw = async (userId: Id<"users">) => {
    setBusy(true);
    setError(null);
    try {
      await cancel({ houseId, userId });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <h3 className="font-semibold text-[13px] text-secondary">Invited</h3>
      <ul className="mt-1 flex flex-wrap gap-2">
        {invited.map((u) => (
          <li
            key={u._id}
            className="flex items-center gap-1.5 rounded-full bg-btn py-0.5 pr-1 pl-2.5 text-[13px] text-primary"
          >
            {u.name}
            <button
              type="button"
              aria-label={`Withdraw ${u.name}'s invite`}
              disabled={busy}
              onClick={() => withdraw(u._id)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-secondary hover:bg-hover disabled:opacity-50"
            >
              <X size={12} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-[13px] text-negative">{error}</p>}
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  houseId,
  houseName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  houseId: Id<"houses">;
  houseName: string;
}) {
  const invite = useM(api.house.invite);
  const toast = useToast();
  const [picked, setPicked] = useState<ReadonlySet<Id<"users">>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Closing (Cancel, the X, Escape) starts the next invite fresh.
  const close = (o: boolean) => {
    if (!o) {
      setPicked(new Set());
      setError(null);
    }
    onOpenChange(o);
  };
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const n = await invite({ houseId, userIds: [...picked] });
      close(false);
      toast.show(n === 1 ? "Invite sent" : `${n} invites sent`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Modal open={open} onOpenChange={close} title={`Invite to ${houseName}`}>
        <div className="p-4">
          <p className="text-[15px] text-secondary">
            Invite the friends you live with. They'll see the house once they join.
          </p>
          {open && (
            <FriendPicker houseId={houseId} picked={picked} onChange={setPicked} className="mt-3" />
          )}
          {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={send} disabled={busy || picked.size === 0}>
              {picked.size > 1 ? `Invite ${picked.size}` : "Invite"}
            </Button>
          </div>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pt-6 pb-10 lg:px-8" aria-busy>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-5 space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}

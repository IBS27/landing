import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useM } from "@/app/viewer";
import { toConversation, toEvent, toGroup, toListing } from "@/landing/links";
import { PollPreview } from "@/landing/plans/ChatPoll";
import { cn, price, shortAge } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Avatar, Button, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { ProposalView } from "../../../convex/proposals";
import type { ProposalPayload } from "../../../convex/validators";

/* ── Shared bits ──────────────────────────────────────────────────────── */

const KIND = {
  message: {
    Icon: MessageCircle,
    tint: "bg-[#E7F0FF] text-[#0866FF] dark:bg-[#0866FF]/20",
    noun: "Message",
  },
  offer: {
    Icon: Tag,
    tint: "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]",
    noun: "Offer",
  },
  event: {
    Icon: CalendarDays,
    tint: "bg-[#FFE8EC] text-[#E41E3F] dark:bg-[#E41E3F]/20",
    noun: "Event",
  },
  group: {
    Icon: UsersRound,
    tint: "bg-[#F1E8FF] text-[#8A3FFC] dark:bg-[#8A3FFC]/25 dark:text-[#B48BFF]",
    noun: "Group",
  },
} as const;

function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function expiresLabel(expiresAt: number | null, now: number) {
  if (!expiresAt) return null;
  const ms = expiresAt - now;
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `Expires in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `Expires in ${h}h ${m}m`;
  return `Expires in ${Math.max(1, m)}m`;
}

/** The little "Muse" mark used on everything Muse wrote. */
export function MuseMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full bg-gradient-to-r from-[#0866FF] to-[#A033FF] px-2 font-semibold text-[12px] text-white leading-none",
        className,
      )}
    >
      <Sparkles size={11} strokeWidth={2.5} aria-hidden />
      Muse
    </span>
  );
}

function agentName(agent: string) {
  return agent.charAt(0).toUpperCase() + agent.slice(1);
}

/**
 * Keeps the dollar figure in an offer's text in step with its amount: the sent
 * message carries the amount only in its text (the server checks they agree).
 */
function withAmount(text: string, from: number, to: number) {
  const spellings = [`${from}`, from.toLocaleString("en-US")].map((d) => d.replace(/,/g, "\\,"));
  const re = new RegExp(`\\$(?:${spellings.join("|")})(?!\\d|[.,]\\d)`, "g");
  return text.replace(re, () => `$${to.toLocaleString("en-US")}`);
}

/** Who can see an Event once it's created: a Group's members, or the owner's friends. */
function EventAudience({
  inGroup,
  group,
}: {
  inGroup: boolean;
  group: { name: string; slug: string } | null;
}) {
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[13px] text-secondary">
      <UsersRound size={13} aria-hidden />
      {inGroup ? (
        <span className="min-w-0 truncate">
          Event in{" "}
          {group ? (
            <Link {...toGroup(group)} className="font-semibold text-primary hover:underline">
              {group.name}
            </Link>
          ) : (
            "a group"
          )}{" "}
          · visible to its members
        </span>
      ) : (
        "Visible to your friends"
      )}
    </div>
  );
}

function approveLabel(p: ProposalView, payload: ProposalPayload) {
  switch (payload.kind) {
    case "message":
      return payload.poll ? "Send poll" : "Approve & send";
    case "offer":
      return `Send ${price(payload.amount)} offer`;
    case "event":
      return "Create event";
    case "group":
      return "Create group";
  }
  return p.kind;
}

function title(p: ProposalView) {
  switch (p.kind) {
    case "message":
      return `${p.payload.kind === "message" && p.payload.poll ? "Poll" : "Message"} to ${p.conversation?.title ?? "a chat"}`;
    case "offer":
      return `Offer to ${p.listing?.sellerName ?? p.conversation?.title ?? "the seller"}`;
    case "event":
      return "Create an event";
    case "group":
      return "Start a group";
  }
}

function useActions(p: ProposalView) {
  const approve = useM(api.proposals.approve);
  const saveEdit = useM(api.proposals.saveEdit);
  const discard = useM(api.proposals.discard);
  const [busy, setBusy] = useState<null | "approve" | "save" | "discard">(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (kind: "approve" | "save" | "discard", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setError(typeof data === "string" ? data : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return {
    busy,
    error,
    approve: (payload?: ProposalPayload) =>
      run("approve", () => approve({ proposalId: p._id, payload })),
    save: (payload: ProposalPayload) => run("save", () => saveEdit({ proposalId: p._id, payload })),
    discard: () => run("discard", () => discard({ proposalId: p._id })),
  };
}

/** "Why Muse suggests this" with its sources. */
function WhyBox({ p, compact }: { p: ProposalView; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg bg-wash px-3 py-2.5 dark:bg-hover", compact && "py-2")}>
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="mt-[3px] shrink-0 text-[#8A3FFC]" aria-hidden />
        <div className="min-w-0 flex-1">
          {!compact && (
            <div className="font-semibold text-[13px] text-primary leading-4">
              Why Muse suggests this
            </div>
          )}
          <p className={cn("text-[13px] text-secondary leading-[18px]", !compact && "mt-0.5")}>
            {p.rationale}
          </p>
          {(p.sources || p.origin.via === "fallback") && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {p.sources && <SourcesChip sources={p.sources} />}
              {p.origin.via === "fallback" && (
                <span className="text-[12px] text-secondary">
                  Written by Landing's rules, not AI
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AvatarStack({
  people,
  size = 28,
}: {
  people: { _id: string; avatar: string; name: string }[];
  size?: number;
}) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, 5).map((u) => (
        <span key={u._id} className="rounded-full ring-2 ring-card" title={u.name}>
          <Avatar src={u.avatar} alt={u.name} size={size} />
        </span>
      ))}
    </div>
  );
}

function names(people: { firstName: string }[]) {
  const n = people.map((u) => u.firstName);
  if (n.length <= 2) return n.join(" and ");
  return `${n.slice(0, 2).join(", ")} and ${n.length - 2} more`;
}

/* ── Previews: what will be sent or created ───────────────────────────── */

function OutgoingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] bg-fb px-3 py-2 text-[15px] text-white leading-5">
        {text}
      </div>
    </div>
  );
}

function Preview({ p }: { p: ProposalView }) {
  switch (p.kind) {
    case "message":
      return (
        <div className="flex flex-col gap-2">
          {p.conversation && (
            <Link
              {...toConversation(p.conversation._id)}
              className="flex w-fit items-center gap-2 rounded-full py-0.5 pr-2 hover:bg-hover"
            >
              <AvatarStack people={p.conversation.people} size={24} />
              <span className="font-semibold text-[13px] text-primary">{p.conversation.title}</span>
            </Link>
          )}
          <OutgoingBubble text={p.payload.kind === "message" ? p.payload.text : ""} />
          {p.payload.kind === "message" && p.payload.poll && <PollPreview poll={p.payload.poll} />}
        </div>
      );
    case "offer": {
      const pay = p.payload.kind === "offer" ? p.payload : null;
      return (
        <div className="flex flex-col gap-2">
          {p.listing && pay && (
            <Link
              {...toListing(p.listing._id)}
              className="flex items-center gap-3 rounded-lg border border-divider p-2 hover:bg-hover"
            >
              {p.listing.photo && (
                <img
                  src={p.listing.photo}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[15px] text-primary">
                  {p.listing.title}
                </div>
                <div className="text-[13px] text-secondary">Asking {price(p.listing.price)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] text-secondary">Your offer</div>
                <div className="font-bold text-[20px] text-positive leading-6">
                  {price(pay.amount)}
                </div>
              </div>
            </Link>
          )}
          {pay && <OutgoingBubble text={pay.text} />}
        </div>
      );
    }
    case "event": {
      const pay = p.payload.kind === "event" ? p.payload : null;
      if (!pay) return null;
      const d = new Date(pay.startAt);
      return (
        <div className="flex gap-3 rounded-lg border border-divider p-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-wash dark:bg-hover">
            <span className="font-bold text-[11px] text-[#E41E3F] uppercase leading-4">
              {d.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="font-bold text-[22px] text-primary leading-6">{d.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[15px] text-primary leading-5">{pay.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-secondary">
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden />
                {d.toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {pay.venue && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} aria-hidden />
                  {pay.venue}
                </span>
              )}
            </div>
            <EventAudience inGroup={!!pay.groupId} group={p.group} />
            <p className="mt-1.5 text-[13px] text-primary leading-[18px]">{pay.description}</p>
            {p.invitees.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <AvatarStack people={p.invitees} size={24} />
                <span className="text-[13px] text-secondary">Invite {names(p.invitees)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "group": {
      const pay = p.payload.kind === "group" ? p.payload : null;
      if (!pay) return null;
      return (
        <div className="overflow-hidden rounded-lg border border-divider">
          <div className="h-16 bg-[url('/seed/covers/sf-01.jpg')] bg-center bg-cover" />
          <div className="p-3">
            <div className="font-semibold text-[15px] text-primary leading-5">{pay.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[13px] text-secondary">
              <Lock size={12} aria-hidden />
              {pay.privacy === "private" ? "Private group" : "Public group"}
            </div>
            <p className="mt-1.5 text-[13px] text-primary leading-[18px]">{pay.description}</p>
            {p.invitees.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <AvatarStack people={p.invitees} size={24} />
                <span className="text-[13px] text-secondary">Invite {names(p.invitees)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
  }
}

/* ── Editing ──────────────────────────────────────────────────────────── */

const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditForm({
  p,
  draft,
  onChange,
}: {
  p: ProposalView;
  draft: ProposalPayload;
  onChange: (d: ProposalPayload) => void;
}) {
  const invitees = p.kind === "event" || p.kind === "group" ? p.invitees : [];
  const InviteeChips =
    draft.kind === "event" || draft.kind === "group" ? (
      <div>
        <div className="mb-1 font-semibold text-[13px] text-secondary">Invite</div>
        <div className="flex flex-wrap gap-1.5">
          {invitees
            .filter((u) => draft.inviteIds.includes(u._id))
            .map((u) => (
              <span
                key={u._id}
                className="inline-flex items-center gap-1.5 rounded-full bg-btn py-1 pr-1 pl-1"
              >
                <Avatar src={u.avatar} size={20} />
                <span className="font-semibold text-[13px] text-primary">{u.firstName}</span>
                <button
                  type="button"
                  aria-label={`Don't invite ${u.firstName}`}
                  onClick={() =>
                    onChange({ ...draft, inviteIds: draft.inviteIds.filter((id) => id !== u._id) })
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-full text-secondary hover:bg-hover"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          {draft.inviteIds.length === 0 && (
            <span className="text-[13px] text-secondary">No one yet</span>
          )}
        </div>
      </div>
    ) : null;

  switch (draft.kind) {
    case "message":
      return (
        <textarea
          aria-label="Message"
          className={cn(field, "min-h-[88px] resize-y")}
          value={draft.text}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      );
    case "offer":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <span className="font-semibold text-[13px] text-secondary">Offer</span>
            <span className="relative">
              <span className="-translate-y-1/2 absolute top-1/2 left-3 text-secondary">$</span>
              <input
                type="number"
                min={0}
                step={5}
                className={cn(field, "w-32 pl-6")}
                value={draft.amount}
                onChange={(e) => {
                  const amount = Math.max(0, Math.round(Number(e.target.value) || 0));
                  onChange({
                    ...draft,
                    amount,
                    text: withAmount(draft.text, draft.amount, amount),
                  });
                }}
              />
            </span>
          </label>
          <textarea
            aria-label="Message"
            className={cn(field, "min-h-[72px] resize-y")}
            value={draft.text}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
          />
        </div>
      );
    case "event":
      return (
        <div className="flex flex-col gap-2">
          <input
            aria-label="Event name"
            className={field}
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              aria-label="Date and time"
              type="datetime-local"
              className={field}
              value={toLocalInput(draft.startAt)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (!Number.isNaN(t)) onChange({ ...draft, startAt: t });
              }}
            />
            <input
              aria-label="Location"
              placeholder="Location"
              className={field}
              value={draft.venue ?? ""}
              onChange={(e) => onChange({ ...draft, venue: e.target.value })}
            />
          </div>
          <textarea
            aria-label="Details"
            className={cn(field, "min-h-[64px] resize-y")}
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
          <EventAudience inGroup={!!draft.groupId} group={p.kind === "event" ? p.group : null} />
          {InviteeChips}
        </div>
      );
    case "group":
      return (
        <div className="flex flex-col gap-2">
          <input
            aria-label="Group name"
            className={field}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
          <textarea
            aria-label="Description"
            className={cn(field, "min-h-[64px] resize-y")}
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
          <select
            aria-label="Privacy"
            className={field}
            value={draft.privacy}
            onChange={(e) =>
              onChange({ ...draft, privacy: e.target.value === "public" ? "public" : "private" })
            }
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          {InviteeChips}
        </div>
      );
  }
}

/* ── Inbox card ───────────────────────────────────────────────────────── */

export function ProposalCard({ p }: { p: ProposalView }) {
  const now = useNow();
  const { busy, error, approve, save, discard } = useActions(p);
  const [draft, setDraft] = useState<ProposalPayload | null>(null);
  const meta = KIND[p.kind];
  const expires = expiresLabel(p.expiresAt, now);
  const soon = !!p.expiresAt && p.expiresAt - now < 6 * 3_600_000;
  const current = draft ?? p.payload;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            meta.tint,
          )}
        >
          <meta.Icon size={20} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-[15px] text-primary leading-5">
              {title(p)}
            </h3>
            <MuseMark />
            {p.edited && <span className="text-[12px] text-secondary">Edited by you</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-secondary leading-4">
            <span>
              Drafted by {agentName(p.origin.agent)} · {shortAge(p.createdAt, now)}
            </span>
            {expires && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    soon && "font-semibold text-[#E41E3F]",
                  )}
                >
                  <Clock size={12} aria-hidden />
                  {expires}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3">
        {draft ? <EditForm p={p} draft={draft} onChange={setDraft} /> : <Preview p={p} />}
        <WhyBox p={p} />
      </div>

      {error && <p className="px-4 pt-2 text-[13px] text-[#E41E3F]">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-divider border-t px-4 py-3">
        <div className="flex items-center gap-1 text-[12px] text-secondary">
          <Lock size={12} aria-hidden />
          Nothing is sent until you approve
        </div>
        {draft ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!!busy}
              onClick={async () => {
                if (await save(draft)) setDraft(null);
              }}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={16} strokeWidth={2.5} />}
              disabled={!!busy}
              onClick={() => approve(draft)}
            >
              {busy === "approve" ? "Working…" : approveLabel(p, current)}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={15} />}
              disabled={!!busy}
              onClick={discard}
            >
              {busy === "discard" ? "Discarding…" : "Discard"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={15} />}
              disabled={!!busy}
              onClick={() => setDraft(p.payload)}
            >
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={16} strokeWidth={2.5} />}
              disabled={!!busy}
              onClick={() => approve()}
            >
              {busy === "approve" ? "Working…" : approveLabel(p, current)}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Inline chat draft ────────────────────────────────────────────────── */

/**
 * A Muse draft at the bottom of a Messenger thread. Only the owner sees it;
 * approving turns it into an ordinary sent message.
 */
export function ChatDraft({ p, compact }: { p: ProposalView; compact?: boolean }) {
  const now = useNow();
  const { busy, error, approve, save, discard } = useActions(p);
  const [draft, setDraft] = useState<ProposalPayload | null>(null);
  const expires = expiresLabel(p.expiresAt, now);
  const pay = p.payload;
  const text = pay.kind === "message" || pay.kind === "offer" ? pay.text : "";

  return (
    <div className="mt-3 mb-1 flex justify-end">
      <div
        className={cn(
          "flex w-full flex-col gap-2 rounded-2xl border-2 border-[#A033FF]/40 border-dashed bg-card p-2.5",
          compact ? "max-w-full" : "max-w-[440px]",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-secondary">
          <MuseMark />
          <span>Draft · only you can see this</span>
          {expires && (
            <span className="inline-flex items-center gap-1">
              · <Clock size={11} aria-hidden /> {expires}
            </span>
          )}
        </div>
        {draft ? (
          <EditForm p={p} draft={draft} onChange={setDraft} />
        ) : (
          <>
            {pay.kind === "offer" && (
              <div className="flex justify-end">
                <span className="rounded-full bg-[#E3F5E5] px-2.5 py-0.5 font-semibold text-[#24832C] text-[13px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
                  Offer {price(pay.amount)}
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-[18px] bg-fb/75 px-3 py-2 text-[15px] text-white leading-5">
                {text}
              </div>
            </div>
            {pay.kind === "message" && pay.poll && <PollPreview poll={pay.poll} />}
          </>
        )}
        {!compact && <WhyBox p={p} compact />}
        {error && <p className="text-[13px] text-[#E41E3F]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-1.5">
          {draft ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={!!busy}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!!busy}
                onClick={async () => {
                  if (await save(draft)) setDraft(null);
                }}
              >
                Save
              </Button>
              <Button variant="primary" size="sm" disabled={!!busy} onClick={() => approve(draft)}>
                {busy === "approve" ? "Sending…" : "Send"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={discard}>
                Discard
              </Button>
              <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => setDraft(pay)}>
                Edit
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={15} strokeWidth={2.5} />}
                disabled={!!busy}
                onClick={() => approve()}
              >
                {busy === "approve"
                  ? "Sending…"
                  : pay.kind === "offer"
                    ? "Send offer"
                    : "Approve & send"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── History row ──────────────────────────────────────────────────────── */

type HistoryItem = ProposalView & { events: { action: string; actor: string; at: number }[] };

const OUTCOME: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Approved",
    className: "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]",
  },
  edited: {
    label: "Edited & approved",
    className: "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]",
  },
  rejected: { label: "Discarded", className: "bg-btn text-secondary" },
  expired: {
    label: "Expired",
    className: "bg-[#FFF4D6] text-[#8A6100] dark:bg-[#F7B928]/20 dark:text-[#F7B928]",
  },
  pending: { label: "Pending", className: "bg-btn text-secondary" },
};

const ACTION_LABEL: Record<string, string> = {
  created: "Muse drafted it",
  edited: "You edited it",
  approved: "You approved it",
  rejected: "You discarded it",
  expired: "It expired",
};

export function HistoryRow({ p }: { p: HistoryItem }) {
  const meta = KIND[p.kind];
  const outcome = OUTCOME[p.status] ?? OUTCOME.pending;
  const [open, setOpen] = useState(false);
  let summary: ReactNode = null;
  if (p.payload.kind === "message" || p.payload.kind === "offer") summary = `“${p.payload.text}”`;
  else if (p.payload.kind === "event") summary = p.payload.title;
  else if (p.payload.kind === "group") summary = p.payload.name;

  let link: ReactNode = null;
  if (p.result?.kind === "event")
    link = (
      <Link
        {...toEvent(p.result.eventId)}
        className="font-semibold text-[13px] text-link hover:underline"
      >
        View event
      </Link>
    );
  else if (p.result?.kind === "group" && p.payload.kind === "group")
    link = (
      <Link
        {...toGroup(p.result.groupId)}
        className="font-semibold text-[13px] text-link hover:underline"
      >
        View group
      </Link>
    );
  else if (
    p.result?.kind === "message" &&
    (p.kind === "message" || p.kind === "offer") &&
    p.conversation
  )
    link = (
      <Link
        {...toConversation(p.conversation._id)}
        className="font-semibold text-[13px] text-link hover:underline"
      >
        View chat
      </Link>
    );

  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tint)}
      >
        <meta.Icon size={18} strokeWidth={2.2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[15px] text-primary leading-5">{title(p)}</span>
          <span
            className={cn("rounded-full px-2 py-0.5 font-semibold text-[12px]", outcome.className)}
          >
            {outcome.label}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-secondary leading-[18px]">{summary}</p>
        <div className="mt-1 flex items-center gap-3">
          {link}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="font-semibold text-[13px] text-secondary hover:underline"
          >
            {open ? "Hide activity" : "Activity"}
          </button>
        </div>
        {open && (
          <ol className="mt-2 flex flex-col gap-1 border-divider border-l-2 pl-3">
            {p.events.map((e) => (
              <li key={`${e.action}-${e.at}`} className="text-[12px] text-secondary">
                {ACTION_LABEL[e.action] ?? e.action} · {new Date(e.at).toLocaleString()}
              </li>
            ))}
          </ol>
        )}
      </div>
      <span className="shrink-0 text-[12px] text-secondary">
        {p.decidedAt ? shortAge(p.decidedAt) : ""}
      </span>
    </li>
  );
}

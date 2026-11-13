import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Building2, CalendarDays, Lock, MapPin, UsersRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { toProfile } from "@/landing/links";
import { ChatPlansCard } from "@/landing/plans/ChatPlansCard";
import { ComingSoon, LandingPage } from "@/landing/shell/LandingPage";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { moveInLabel, neighborhoodLabel } from "../../../convex/lib/cityProfileFacts";
import type { Anchor, MatchBy } from "../../../convex/lib/crews";
import { getInterest, type InterestId } from "../../../convex/lib/interests";
import { CrewGroupCard } from "./CrewGroupCard";

type Status = NonNullable<FunctionReturnType<typeof api.crews.status>>;
type Crew = NonNullable<FunctionReturnType<typeof api.crews.myCrew>>;

function errorText(e: unknown) {
  return e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong";
}

const monthLabel = (month: string) => moveInLabel({ month });
const placesLabel = (slugs: string[]) =>
  slugs.map((s) => neighborhoodLabel(s as Parameters<typeof neighborhoodLabel>[0])).join(", ");

/**
 * Landing → Crew & Journeys (`/landing/crew`): the Move-in Crew (#30). Opt in,
 * pick what you're matched on, and see the people arriving with you and what
 * you have in common. Journeys (#32 and later) join this page, and plans from
 * your group chats (#34).
 */
export function CrewPage() {
  const status = useQ(api.crews.status, {});
  const crew = useQ(api.crews.myCrew, {});
  return (
    <LandingPage
      title="Crew & Journeys"
      description="Meet people arriving when you do, matched on what you're into, before move day."
    >
      <div className="flex max-w-[760px] flex-col gap-4">
        {status === undefined ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !status.briefDone ? (
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[17px] text-primary leading-5">
                Set up your City Profile first
              </h2>
              <p className="mt-0.5 text-[15px] text-secondary leading-5">
                Your crew is matched on your move-in month, neighborhoods and interests.
              </p>
            </div>
            <Link
              to="/landing/welcome"
              className="flex h-9 shrink-0 items-center rounded-md bg-btn-primary px-3 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
            >
              Set up your City Profile
            </Link>
          </Card>
        ) : !status.optedIn ? (
          <JoinCard status={status} />
        ) : (
          <>
            <CrewList crew={crew} status={status} />
            <CrewGroupCard crewSize={crew?.members.length ?? 0} />
            <CrewSettings status={status} />
          </>
        )}
        {status !== undefined && <ChatPlansCard />}
        <ComingSoon items={["Weekly check-ins and levels: Explore, Regular, Local"]} />
      </div>
    </LandingPage>
  );
}

/* ---------------- Choosing what to match on ---------------- */

function AnchorToggles({
  status,
  value,
  onChange,
}: {
  status: Status;
  value: MatchBy;
  onChange: (m: MatchBy) => void;
}) {
  const rows: { key: keyof MatchBy; icon: ReactNode; label: string; detail: string | null }[] = [
    {
      key: "month",
      icon: <CalendarDays size={18} />,
      label: "Arriving the same month",
      detail: status.values.month ? monthLabel(status.values.month) : null,
    },
    {
      key: "neighborhood",
      icon: <MapPin size={18} />,
      label: "Looking in the same neighborhoods",
      detail: status.values.neighborhoods.length ? placesLabel(status.values.neighborhoods) : null,
    },
    {
      key: "employer",
      icon: <Building2 size={18} />,
      label: "Working at the same place",
      detail: status.values.employer,
    },
  ];
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const usable = status.usable[r.key];
        return (
          <li key={r.key}>
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2",
                usable ? "cursor-pointer hover:bg-hover" : "opacity-60",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
                {r.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[15px] text-primary leading-5">
                  {r.label}
                </span>
                <span className="block text-[13px] text-secondary leading-4">
                  {r.detail ?? "Not in your City Profile yet"}
                </span>
              </span>
              <input
                type="checkbox"
                disabled={!usable}
                checked={usable && value[r.key]}
                onChange={(e) => onChange({ ...value, [r.key]: e.target.checked })}
                className="size-5 accent-[var(--accent)]"
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 text-[13px] text-secondary">
      <Lock size={14} className="mt-0.5 shrink-0" />
      Others in your crew see your name and photo and only what you have in common: the month,
      neighborhoods and workplace you both turned on, and shared interests (including ones Landing
      learned from your activity, which you can remove in your City Profile). A crew Group intro may
      mention interests you both stated, never your workplace. Matching never uses age, gender,
      ethnicity, religion, health or family status.
    </p>
  );
}

function JoinCard({ status }: { status: Status }) {
  const optIn = useM(api.crews.optIn);
  const toast = useToast();
  const [value, setValue] = useState<MatchBy>({ month: true, neighborhood: true, employer: false });
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-accent">
          <UsersRound size={22} />
        </span>
        <div>
          <h2 className="font-bold text-[20px] text-primary leading-6">Join your Move-in Crew</h2>
          <p className="text-[13px] text-secondary">
            People arriving when you do, matched on the interests you share.
          </p>
        </div>
      </div>
      <p className="mt-2 mb-1 font-semibold text-[13px] text-secondary">Match me with people…</p>
      <AnchorToggles status={status} value={value} onChange={setValue} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-divider border-t pt-3">
        <PrivacyNote />
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await optIn({ matchBy: value });
            } catch (e) {
              toast.show(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Join crew
        </Button>
      </div>
      {toast.node}
    </Card>
  );
}

/* ---------------- The crew ---------------- */

function anchorText(a: Anchor) {
  switch (a.kind) {
    case "month":
      return { icon: <CalendarDays size={13} />, text: `Arriving ${monthLabel(a.month)}` };
    case "neighborhood":
      return { icon: <MapPin size={13} />, text: `Both looking in ${placesLabel(a.slugs)}` };
    case "employer":
      return { icon: <Building2 size={13} />, text: `Both at ${a.name}` };
  }
}

function CrewList({ crew, status }: { crew: Crew | null | undefined; status: Status }) {
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">Your Move-in Crew</h2>
      <p className="mb-3 text-[13px] text-secondary">
        {status.values.month ? `Arriving ${monthLabel(status.values.month)}. ` : ""}Matched on what
        you share, best first.
      </p>
      {crew === undefined ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !crew || crew.members.length === 0 ? (
        <div className="rounded-lg bg-wash/60 px-4 py-6 text-center">
          <p className="font-semibold text-[15px] text-primary">No crew yet</p>
          <p className="mt-1 text-[13px] text-secondary">
            Nobody else who joined shares your month, neighborhoods or workplace and an interest. As
            more people join, they'll show up here. Turning on more of the options below can help.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {crew.members.map((m) => (
            <li key={m.user._id} className="flex items-start gap-3 py-3">
              <Link {...toProfile(m.user)} className="shrink-0">
                <Avatar src={m.user.avatar} alt={m.user.name} size={48} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  {...toProfile(m.user)}
                  className="font-semibold text-[15px] text-primary leading-5 hover:underline"
                >
                  {m.user.name}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {m.anchors.map((a) => {
                    const t = anchorText(a);
                    return (
                      <span
                        key={a.kind}
                        className="inline-flex items-center gap-1 rounded-full bg-btn px-2 py-0.5 text-[13px] text-primary"
                      >
                        {t.icon}
                        {t.text}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[13px] text-secondary">
                  You both like{" "}
                  {m.shared
                    .slice(0, 4)
                    .map((id) => {
                      const i = getInterest(id as InterestId);
                      return `${i.emoji} ${i.label.toLowerCase()}`;
                    })
                    .join(", ")}
                  {m.shared.length > 4 ? ` and ${m.shared.length - 4} more` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CrewSettings({ status }: { status: Status }) {
  const setMatchBy = useM(api.crews.setMatchBy);
  const optOut = useM(api.crews.optOut);
  const toast = useToast();
  const saved = status.matchBy ?? { month: true, neighborhood: true, employer: false };
  const [value, setValue] = useState<MatchBy>(saved);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const changed =
    value.month !== saved.month ||
    value.neighborhood !== saved.neighborhood ||
    value.employer !== saved.employer;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 font-bold text-[17px] text-primary leading-5">What you're matched on</h2>
      <AnchorToggles status={status} value={value} onChange={setValue} />
      <div className="mt-3 flex flex-col gap-3 border-divider border-t pt-3">
        <PrivacyNote />
        <div className="flex justify-between gap-2">
          <Button variant="ghost" className="text-negative" onClick={() => setLeaving(true)}>
            Leave crew
          </Button>
          <Button
            variant="primary"
            disabled={!changed || busy}
            onClick={() => run(() => setMatchBy({ matchBy: value }))}
          >
            Save
          </Button>
        </div>
      </div>
      <Modal open={leaving} onOpenChange={setLeaving} title="Leave your Move-in Crew?" width={440}>
        <div className="px-4 pb-4">
          <p className="text-[15px] text-primary">
            You'll stop appearing in other people's crews right away. You can join again anytime.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                run(async () => {
                  await optOut({});
                  setLeaving(false);
                })
              }
            >
              Leave
            </Button>
          </div>
        </div>
      </Modal>
      {toast.node}
    </Card>
  );
}

import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { MessageCircle, UserCheck, UserPlus, UserX } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { useGroup } from "./context";
import { SearchGlyph } from "./icons";
import { relativeAgo } from "./util";

type MembersData = FunctionReturnType<typeof api.groups.members>;
type Member = MembersData["everyone"][number];

/** People: search, admins & moderators, friends, nearby, new members, everyone. */
export function PeopleTab() {
  const group = useGroup();
  const [q, setQ] = useState("");
  const [learn, setLearn] = useState(false);
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const data = useQ(api.groups.members, { groupId: group._id, q: term || undefined });

  return (
    <Card className="mx-auto w-full max-w-[680px] rounded-xl px-4 pt-4 pb-2">
      <h2 className="font-semibold text-[17px] text-primary">
        Members{" "}
        <span className="font-normal text-[15px] text-secondary">
          · {group.memberCount.toLocaleString("en-US")}
        </span>
      </h2>
      <p className="mt-1 text-[15px] text-secondary">
        New people and Pages who join this group will appear here.{" "}
        <button
          type="button"
          onClick={() => setLearn(true)}
          className="font-semibold text-primary hover:underline"
        >
          Learn More
        </button>
      </p>
      <Modal open={learn} onOpenChange={setLearn} title="Group members" width={548}>
        <div className="space-y-3 p-4 text-[15px] text-primary">
          <p>
            People and Pages join a group when they're approved, invited by a member, or join a
            public group on their own.
          </p>
          <p className="text-secondary">
            {group.privacy === "public"
              ? "This group is public, so anyone can see who's in it."
              : "This group is private, so only members can see who's in it. Admins and moderators are always visible."}
          </p>
        </div>
      </Modal>
      <label className="mt-3 flex h-9 items-center gap-2 rounded-full bg-input px-3">
        <SearchGlyph size={16} className="text-icon-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a member"
          aria-label="Find a member"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
        />
      </label>
      <div className="mt-4 h-px bg-divider" />
      {data === undefined ? (
        <div className="space-y-4 py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-[60px] w-[60px] rounded-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : term.trim() ? (
        <Section
          title="Results"
          count={data.everyone.length + (data.canSee ? 0 : data.staff.length)}
        >
          {(data.canSee ? data.everyone : data.staff).map((m) => (
            <MemberRow key={m._id} m={m} />
          ))}
          {(data.canSee ? data.everyone : data.staff).length === 0 && (
            <p className="py-6 text-center text-[15px] text-secondary">No members found</p>
          )}
        </Section>
      ) : (
        <>
          <Section title="Admins & moderators" count={data.staff.length}>
            {data.staff.map((m) => (
              <MemberRow key={m._id} m={m} />
            ))}
          </Section>
          {!data.canSee ? (
            <p className="py-6 text-center text-[15px] text-secondary">
              Only members can see who's in this group.
            </p>
          ) : (
            <>
              {data.friends.length > 0 && (
                <Section title="Friends" count={data.friends.length}>
                  <Expandable items={data.friends} />
                </Section>
              )}
              {data.nearby.length > 0 && (
                <Section title="Members near you" count={data.nearby.length}>
                  <Expandable items={data.nearby} />
                </Section>
              )}
              {data.newest.length > 0 && (
                <Section title="New to the group">
                  <Expandable items={data.newest} />
                </Section>
              )}
              <Section title="Members" count={data.everyone.length} last>
                <Expandable items={data.everyone} initial={10} />
              </Section>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Section({
  title,
  count,
  last,
  children,
}: {
  title: string;
  count?: number;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={last ? "py-4" : "border-divider border-b py-4"}>
      <h3 className="mb-2 font-semibold text-[17px] text-primary">
        {title}
        {count !== undefined && (
          <span className="font-normal text-[15px] text-secondary"> · {count}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Expandable({ items, initial = 3 }: { items: Member[]; initial?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, initial);
  return (
    <>
      {shown.map((m) => (
        <MemberRow key={m._id} m={m} />
      ))}
      {items.length > initial && (
        <Button variant="secondary" block className="mt-3" onClick={() => setAll((a) => !a)}>
          {all ? "See less" : "See all"}
        </Button>
      )}
    </>
  );
}

function subline(m: Member) {
  if (m.kind === "page")
    return `${m.pageCategory ?? "Page"}${m.followerCount ? ` · ${m.followerCount.toLocaleString("en-US")} people follow this` : ""}`;
  if (m.role === "member" && Date.now() - m.joinedAt < 30 * 86_400_000)
    return `Joined ${relativeAgo(m.joinedAt)}`;
  if (m.work) return `${m.work.title} at ${m.work.company}`;
  if (m.city) return `Lives in ${m.city}`;
  return null;
}

function MemberRow({ m }: { m: Member }) {
  const sub = subline(m);
  return (
    <div className="-mx-2 flex min-h-[76px] items-center gap-3 rounded-lg px-2 py-2">
      <Link to="/$username" params={{ username: m.username }} className="flex shrink-0">
        <Avatar src={m.avatar} size={60} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/$username"
          params={{ username: m.username }}
          className="block truncate font-medium text-[15px] text-primary hover:underline"
        >
          {m.name}
        </Link>
        {m.role !== "member" && (
          <span className="mt-0.5 inline-flex h-5 items-center rounded-[4px] bg-btn px-1 text-[13px] text-primary">
            {m.role === "admin" ? "Admin" : "Moderator"}
          </span>
        )}
        {sub && <p className="truncate text-[13px] text-secondary">{sub}</p>}
      </div>
      <RelationButton m={m} />
    </div>
  );
}

function RelationButton({ m }: { m: Member }) {
  const send = useM(api.friends.sendRequest);
  const cancel = useM(api.friends.cancelRequest);
  const accept = useM(api.friends.acceptRequest);
  const getDm = useM(api.messenger.getOrCreateDm);
  const { openChat } = useChatDock();
  const [busy, setBusy] = useState(false);
  if (m.relation === "self" || m.kind === "page") return null;
  const run = (p: Promise<unknown>) => {
    setBusy(true);
    void p.finally(() => setBusy(false));
  };
  if (m.relation === "friend")
    return (
      <Button
        variant="secondary"
        icon={<MessageCircle size={16} />}
        disabled={busy}
        onClick={() => run(getDm({ userId: m._id }).then(openChat))}
      >
        Message
      </Button>
    );
  if (m.relation === "sent")
    return (
      <Button
        variant="secondary"
        icon={<UserX size={16} />}
        disabled={busy}
        onClick={() => run(cancel({ userId: m._id }))}
      >
        Cancel request
      </Button>
    );
  if (m.relation === "received")
    return (
      <Button
        variant="primary"
        icon={<UserCheck size={16} />}
        disabled={busy}
        onClick={() => run(accept({ userId: m._id }))}
      >
        Confirm
      </Button>
    );
  return (
    <Button
      variant="secondary"
      icon={<UserPlus size={16} />}
      disabled={busy}
      onClick={() => run(send({ userId: m._id }))}
    >
      Add friend
    </Button>
  );
}

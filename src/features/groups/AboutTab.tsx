import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useM } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { Avatar, Button, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { type GroupView, useGroup } from "./context";
import { Description, InfoRow, PrivacyRows } from "./DiscussionTab";
import { ChatGlyph, ClockGlyph, PeopleGlyph, PinGlyph } from "./icons";
import { ageLabel, formatLongDate, memberCount } from "./util";

/** About: description and privacy, members (admins), activity, rules. */
export function AboutTab() {
  const group = useGroup();
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
      <AboutCard group={group} />
      <MembersCard group={group} />
      <ActivityCard group={group} />
      {group.rules.length > 0 && <RulesCard group={group} />}
    </div>
  );
}

export function SectionCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Card className="rounded-xl px-4 pb-4">
      <h2 className="flex h-[60px] items-center font-semibold text-[17px] text-primary">
        <span>{title}</span>
      </h2>
      <div className="h-px bg-divider" />
      <div className="pt-4">{children}</div>
    </Card>
  );
}

function AboutCard({ group }: { group: GroupView }) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard title="About this group">
      <div className="flex flex-col gap-3">
        {editing ? (
          <EditDescription group={group} onDone={() => setEditing(false)} />
        ) : group.description ? (
          <Description text={group.description} limit={300} />
        ) : (
          group.viewerRole === "admin" && (
            <p className="text-[15px] text-secondary">
              Add a description to let people know what this group is about.
            </p>
          )
        )}
        {group.viewerRole === "admin" && !editing && (
          <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>
            {group.description ? "Edit description" : "Add description"}
          </Button>
        )}
        <PrivacyRows group={group} />
        <InfoRow
          muted
          icon={<ClockGlyph />}
          title="History"
          sub={`Group created on ${formatLongDate(group.createdAt)}`}
        />
        {group.location && <InfoRow muted icon={<PinGlyph />} title={group.location} />}
      </div>
    </SectionCard>
  );
}

function EditDescription({ group, onDone }: { group: GroupView; onDone: () => void }) {
  const save = useM(api.groups.updateAbout);
  const [text, setText] = useState(group.description);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        aria-label="Description"
        className="w-full resize-y rounded-md border border-divider bg-card p-3 text-[15px] text-primary outline-none focus:border-fb"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void save({ groupId: group._id, description: text })
              .then(onDone)
              .finally(() => setBusy(false));
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** "Nia and Dan are admins." / "Nia is an admin and Ana is a moderator." */
function staffLine(staff: GroupView["staff"]) {
  const admins = staff.filter((s) => s.role === "admin").map((s) => s.firstName);
  const mods = staff.filter((s) => s.role === "moderator").map((s) => s.firstName);
  const join = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const a = admins.length
    ? `${join(admins)} ${admins.length === 1 ? "is an admin" : "are admins"}`
    : "";
  const m = mods.length
    ? `${join(mods)} ${mods.length === 1 ? "is a moderator" : "are moderators"}`
    : "";
  return `${[a, m].filter(Boolean).join(". ")}.`;
}

function MembersCard({ group }: { group: GroupView }) {
  return (
    <SectionCard
      title={
        <>
          Members{" "}
          <span className="font-normal text-secondary">
            · {memberCount(group.memberCount, true)}
          </span>
        </>
      }
    >
      <div className="flex gap-1">
        {group.staff.map((s) => (
          <Link key={s._id} to="/$username" params={{ username: s.username }} aria-label={s.name}>
            <Avatar src={s.avatar} size={32} />
          </Link>
        ))}
      </div>
      {group.staff.length > 0 && (
        <p className="mt-3 text-[15px] text-primary">{staffLine(group.staff)}</p>
      )}
      {group.friendCount > 0 && (
        <p className="mt-1 text-[15px] text-primary">
          {group.friendNames.join(", ")}
          {group.friendCount > group.friendNames.length
            ? ` and ${group.friendCount - group.friendNames.length} other friends are members.`
            : group.friendCount === 1
              ? " is a member."
              : " are members."}
        </p>
      )}
      <Link
        to="/groups/$groupId/members"
        params={groupParams(group)}
        className="mt-4 flex h-9 items-center justify-center rounded-md bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
      >
        See all
      </Link>
    </SectionCard>
  );
}

function ActivityCard({ group }: { group: GroupView }) {
  const s = group.stats;
  return (
    <SectionCard title="Activity">
      <div className="flex flex-col gap-3">
        <StatRow
          icon={<ChatGlyph />}
          title={`${s.postsToday.toLocaleString("en-US")} new ${s.postsToday === 1 ? "post" : "posts"} today`}
          sub={`${s.postsLastMonth.toLocaleString("en-US")} in the last month`}
        />
        <StatRow
          icon={<PeopleGlyph />}
          title={`${group.memberCount.toLocaleString("en-US")} total members`}
          sub={`+ ${s.newMembersWeek} in the last week`}
        />
        <StatRow icon={<ClockGlyph />} title={`Created ${ageLabel(group.createdAt)}`} />
      </div>
    </SectionCard>
  );
}

function StatRow({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-icon-secondary">{icon}</span>
      <div>
        <p className="text-[15px] text-primary leading-5">{title}</p>
        {sub && <p className="text-[13px] text-secondary">{sub}</p>}
      </div>
    </div>
  );
}

function RulesCard({ group }: { group: GroupView }) {
  return (
    <SectionCard title="Group rules from the admins">
      <ol className="flex flex-col gap-4">
        {group.rules.map((r, i) => (
          <li key={r.title} className="flex gap-3">
            <span className="w-5 shrink-0 font-semibold text-[15px] text-primary">{i + 1}</span>
            <div>
              <p className="font-semibold text-[15px] text-primary">{r.title}</p>
              <p className="mt-0.5 text-[15px] text-secondary">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

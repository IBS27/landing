import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Cake,
  Clock,
  GraduationCap,
  Hand,
  Heart,
  Home,
  Link2,
  MapPin,
  Pencil,
  Pin,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Avatar, Button, Card, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CheckinsCard, ReelsCard } from "./cards";
import { birthdayLabel, joinedLabel, possessive, useProfile } from "./context";
import { BioEditor } from "./EditProfileModal";
import { PhotosCard } from "./PhotosTab";

export const ABOUT_SECTIONS = [
  { key: "intro", label: "Intro" },
  { key: "personal_details", label: "Personal details" },
  { key: "work", label: "Work" },
  { key: "education", label: "Education" },
  { key: "hobbies", label: "Hobbies" },
  { key: "interests", label: "Interests" },
  { key: "travel", label: "Travel" },
  { key: "links", label: "Links" },
  { key: "contact_info", label: "Contact info" },
  { key: "names", label: "Names" },
  { key: "details", label: "Details about you" },
] as const;
export type AboutSection = (typeof ABOUT_SECTIONS)[number]["key"];

export function isAboutSection(s: unknown): s is AboutSection {
  return ABOUT_SECTIONS.some((x) => x.key === s);
}

/** About tab: the About card (left nav + section), then Photos, Reels and Check-ins. */
export function AboutTab({ section }: { section: AboutSection }) {
  const { profile } = useProfile();
  const overview = useQ(api.profiles.overview, { userId: profile.user._id });
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex min-h-[536px] overflow-hidden rounded-xl max-[899px]:flex-col">
        <nav
          aria-label="About"
          className="w-[287px] shrink-0 border-divider border-r px-[6px] py-4 max-[899px]:w-full max-[899px]:border-r-0 max-[899px]:border-b"
        >
          <h2 className="px-[10px] pb-[14px] font-bold text-[20px] text-primary leading-6">
            About
          </h2>
          <ul className="flex flex-col gap-2">
            {ABOUT_SECTIONS.map((s) => {
              const active = s.key === section;
              return (
                <li key={s.key}>
                  <Link
                    to="/$username/about"
                    params={{ username: profile.user.username }}
                    search={{ section: s.key }}
                    className={cn(
                      "flex h-[35px] items-center rounded-md px-[10px] font-semibold text-[15px] transition-colors",
                      active ? "bg-highlight text-link" : "text-secondary hover:bg-hover",
                    )}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 px-4 pt-4 pb-6">
          <SectionBody section={section} checkins={overview?.checkins} />
        </div>
      </Card>
      <PhotosCard />
      <ReelsCard />
      <CheckinsCard checkins={overview?.checkins} />
    </div>
  );
}

/* ---------------- Building blocks ---------------- */

function Title({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 pb-3 font-semibold text-[17px] text-primary leading-5">{children}</h3>;
}

type IconT = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

function Row({
  icon: Icon,
  children,
  sub,
  onEdit,
  muted,
}: {
  icon: IconT;
  children: ReactNode;
  sub?: ReactNode;
  onEdit?: () => void;
  muted?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-[6px]">
      <span className="flex w-6 shrink-0 justify-center text-icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[15px] leading-5",
            muted ? "font-medium text-secondary" : "font-medium text-primary",
          )}
        >
          {children}
        </div>
        {sub && <div className="text-[13px] text-secondary leading-4">{sub}</div>}
      </div>
      {onEdit && (
        <IconButton label="Edit" variant="ghost" onClick={onEdit}>
          <Pencil size={20} strokeWidth={1.8} className="text-secondary" />
        </IconButton>
      )}
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-md py-[6px] text-left text-link hover:underline"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current">
        <Plus size={14} strokeWidth={3} />
      </span>
      <span className="font-medium text-[15px]">{label}</span>
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-[15px] text-secondary">{children}</p>;
}

/** Inline editor: a few labelled inputs with Cancel / Save, like Facebook's About forms. */
function FieldsEditor({
  fields,
  onSave,
  onCancel,
  onDelete,
}: {
  fields: { label: string; value: string; placeholder?: string }[];
  onSave: (values: string[]) => Promise<unknown>;
  onCancel: () => void;
  onDelete?: () => Promise<unknown>;
}) {
  const [values, setValues] = useState(fields.map((f) => f.value));
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onCancel();
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="my-2 flex flex-col gap-3 rounded-lg border border-divider p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => onSave(values));
      }}
    >
      {fields.map((f, i) => (
        <label
          key={f.label}
          className="block rounded-md border border-divider px-3 pt-1.5 pb-1 focus-within:border-fb"
        >
          <span className="block text-[12px] text-secondary">{f.label}</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: the editor opens on an explicit Edit/Add click
            autoFocus={i === 0}
            value={values[i]}
            placeholder={f.placeholder}
            onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            className="block w-full bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
          />
        </label>
      ))}
      <div className="flex items-center justify-between gap-2 border-divider border-t pt-3">
        <span>
          {onDelete && (
            <IconButton label="Delete" variant="ghost" onClick={() => void run(onDelete)}>
              <Trash2 size={18} className="text-secondary" />
            </IconButton>
          )}
        </span>
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            Save
          </Button>
        </span>
      </div>
    </form>
  );
}

/** A single-value About field (city, hometown, relationship…) with inline editing. */
function SimpleField({
  icon,
  label,
  value,
  field,
  addLabel,
  display,
}: {
  icon: IconT;
  label: string;
  value: string | null;
  field: "city" | "hometown" | "relationship" | "pronouns";
  addLabel: string;
  display?: (v: string) => ReactNode;
}) {
  const { profile } = useProfile();
  const update = useM(api.profiles.update);
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <FieldsEditor
        fields={[{ label, value: value ?? "" }]}
        onSave={([v]) => update({ [field]: v })}
        onCancel={() => setEditing(false)}
        onDelete={value ? () => update({ [field]: "" }) : undefined}
      />
    );
  if (!value)
    return profile.isSelf ? <AddRow label={addLabel} onClick={() => setEditing(true)} /> : null;
  return (
    <Row icon={icon} sub={label} onEdit={profile.isSelf ? () => setEditing(true) : undefined}>
      {display ? display(value) : value}
    </Row>
  );
}

/* ---------------- Sections ---------------- */

function SectionBody({
  section,
  checkins,
}: {
  section: AboutSection;
  checkins: { place: string; createdAt: number }[] | undefined;
}) {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const first = user.firstName;
  switch (section) {
    case "intro":
      return (
        <>
          <Title>Bio</Title>
          <BioRow />
          <Title>Pinned details</Title>
          {user.city || isSelf ? (
            <SimpleField
              icon={Pin}
              label="Current city"
              value={user.city}
              field="city"
              addLabel="Add current city"
            />
          ) : (
            <Empty>No pinned details to show</Empty>
          )}
        </>
      );
    case "personal_details":
      return (
        <>
          <Title>Personal details</Title>
          <SimpleField
            icon={MapPin}
            label="Current city"
            value={user.city}
            field="city"
            addLabel="Add current city"
          />
          <SimpleField
            icon={Home}
            label="Hometown"
            value={user.hometown}
            field="hometown"
            addLabel="Add hometown"
          />
          <SimpleField
            icon={Heart}
            label="Relationship status"
            value={user.relationship}
            field="relationship"
            addLabel="Add a relationship status"
          />
          {user.birthday && (
            <Row icon={Cake} sub="Birthday">
              {birthdayLabel(user.birthday)}
            </Row>
          )}
          <SimpleField
            icon={User}
            label="Pronouns"
            value={user.pronouns}
            field="pronouns"
            addLabel="Add pronouns"
          />
          <Row icon={Clock}>{joinedLabel(user.joinedAt)}</Row>
          {!isSelf && !user.city && !user.hometown && !user.relationship && !user.birthday && (
            <Empty>No personal details to show</Empty>
          )}
        </>
      );
    case "work":
      return (
        <>
          <Title>Work</Title>
          <WorkList />
        </>
      );
    case "education":
      return (
        <>
          <Title>Education</Title>
          <EducationList />
        </>
      );
    case "hobbies":
      return (
        <>
          <Title>Hobbies</Title>
          <Empty>No hobbies to show</Empty>
        </>
      );
    case "interests":
      return (
        <>
          <Title>Interests</Title>
          <Interests />
        </>
      );
    case "travel":
      return (
        <>
          <Title>Places visited</Title>
          {checkins && checkins.length > 0 ? (
            checkins.map((c) => (
              <Row key={c.place} icon={MapPin} sub="Checked in">
                {c.place}
              </Row>
            ))
          ) : (
            <Empty>No places to show</Empty>
          )}
        </>
      );
    case "links":
      return (
        <>
          <Title>Links</Title>
          <Empty>No links to show</Empty>
        </>
      );
    case "contact_info":
      return (
        <>
          <Title>Contact info</Title>
          <Row icon={Link2} sub="Facebook">
            <Link to="/$username" params={{ username: user.username }} className="hover:underline">
              facebook.com/{user.username}
            </Link>
          </Row>
        </>
      );
    case "names":
      return (
        <>
          <Title>Name</Title>
          <Row icon={User} sub="Full name">
            {user.name}
          </Row>
          <Title>Other names</Title>
          <Empty>No other names to show</Empty>
        </>
      );
    case "details":
      return (
        <>
          <Title>About {first}</Title>
          {user.bio ? (
            <Row icon={Hand}>{user.bio}</Row>
          ) : (
            <Empty>No additional details to show</Empty>
          )}
          <Title>Name pronunciation</Title>
          <Empty>No name pronunciation to show</Empty>
        </>
      );
  }
}

function BioRow() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const [editing, setEditing] = useState(false);
  if (editing) return <BioEditor initial={user.bio ?? ""} onDone={() => setEditing(false)} />;
  return (
    <div className="pb-2">
      <Row icon={Hand} muted={!user.bio} onEdit={isSelf ? () => setEditing(true) : undefined}>
        {user.bio ?? (isSelf ? "About you" : `${possessive(user.firstName)} bio is empty`)}
      </Row>
    </div>
  );
}

function WorkList() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const update = useM(api.profiles.update);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const save = (list: typeof user.work) => update({ work: list });

  return (
    <>
      {isSelf &&
        (editing === "new" ? (
          <FieldsEditor
            fields={[
              { label: "Company", value: "" },
              { label: "Position", value: "" },
            ]}
            onSave={([company, title]) => save([{ company, title }, ...user.work])}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AddRow label="Add a workplace" onClick={() => setEditing("new")} />
        ))}
      {user.work.map((w, i) =>
        editing === i ? (
          <FieldsEditor
            key={`${w.company}-${i}`}
            fields={[
              { label: "Company", value: w.company },
              { label: "Position", value: w.title },
            ]}
            onSave={([company, title]) =>
              save(user.work.map((x, j) => (j === i ? { company, title } : x)))
            }
            onDelete={() => save(user.work.filter((_, j) => j !== i))}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Row
            key={`${w.company}-${i}`}
            icon={Briefcase}
            onEdit={isSelf ? () => setEditing(i) : undefined}
          >
            {w.title ? (
              <>
                {w.title} at <span className="font-semibold">{w.company}</span>
              </>
            ) : (
              <>
                Works at <span className="font-semibold">{w.company}</span>
              </>
            )}
          </Row>
        ),
      )}
      {!isSelf && user.work.length === 0 && <Empty>No workplaces to show</Empty>}
    </>
  );
}

function EducationList() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const update = useM(api.profiles.update);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const save = (list: typeof user.education) => update({ education: list });

  return (
    <>
      {isSelf &&
        (editing === "new" ? (
          <FieldsEditor
            fields={[
              { label: "School", value: "" },
              { label: "Description", value: "", placeholder: "Concentration · Class of 2027" },
            ]}
            onSave={([school, detail]) => save([{ school, detail }, ...user.education])}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AddRow label="Add school" onClick={() => setEditing("new")} />
        ))}
      {user.education.map((e, i) =>
        editing === i ? (
          <FieldsEditor
            key={`${e.school}-${i}`}
            fields={[
              { label: "School", value: e.school },
              { label: "Description", value: e.detail ?? "" },
            ]}
            onSave={([school, detail]) =>
              save(user.education.map((x, j) => (j === i ? { school, detail } : x)))
            }
            onDelete={() => save(user.education.filter((_, j) => j !== i))}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Row
            key={`${e.school}-${i}`}
            icon={GraduationCap}
            sub={e.detail}
            onEdit={isSelf ? () => setEditing(i) : undefined}
          >
            {/high school/i.test(e.school) ? "Went to " : "Studied at "}
            <span className="font-semibold">{e.school}</span>
          </Row>
        ),
      )}
      {!isSelf && user.education.length === 0 && <Empty>No schools to show</Empty>}
    </>
  );
}

function Interests() {
  const { profile } = useProfile();
  const pages = useQ(api.profiles.following, { userId: profile.user._id });
  if (!pages) return null;
  if (pages.length === 0) return <Empty>No interests to show</Empty>;
  return (
    <div className="flex flex-col">
      {pages.map((p) => (
        <Link
          key={p._id}
          to="/$username"
          params={{ username: p.username }}
          className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover"
        >
          <Avatar src={p.avatar} size={40} />
          <span>
            <span className="block font-semibold text-[15px] text-primary">{p.name}</span>
            {p.category && <span className="block text-[13px] text-secondary">{p.category}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

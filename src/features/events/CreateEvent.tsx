import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, ImagePlus, Lock, MapPin, Plus, Users, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { GlobeIcon } from "@/features/posts/icons";
import { uploadFile } from "@/features/posts/util";
import { cn } from "@/lib/format";
import { Avatar, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CATEGORIES, RailShell } from "./EventsRail";
import { longDate } from "./format";

type Privacy = "public" | "friends" | "private";
type EventView = NonNullable<FunctionReturnType<typeof api.events.get>>;

const PRIVACY: { value: Privacy; label: string; sub: string }[] = [
  { value: "private", label: "Private", sub: "Only people who are invited" },
  { value: "public", label: "Public", sub: "Anyone on or off Facebook" },
  { value: "friends", label: "Friends", sub: "Your Facebook friends" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toTs = (date: string, time: string) =>
  date && time ? new Date(`${date}T${time}`).getTime() : null;

type Form = {
  title: string;
  startDate: string;
  startTime: string;
  hasEnd: boolean;
  endDate: string;
  endTime: string;
  online: "" | "in_person" | "virtual";
  venue: string;
  address: string;
  description: string;
  privacy: Privacy | "";
  category: string;
};

function initialForm(e?: EventView): Form {
  if (!e) {
    // Pre-fill tomorrow at noon.
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(12, 0, 0, 0);
    return {
      title: "",
      startDate: dateValue(d),
      startTime: timeValue(d),
      hasEnd: false,
      endDate: "",
      endTime: "",
      online: "",
      venue: "",
      address: "",
      description: "",
      privacy: "",
      category: "",
    };
  }
  const s = new Date(e.startAt);
  const end = e.endAt ? new Date(e.endAt) : null;
  return {
    title: e.title,
    startDate: dateValue(s),
    startTime: timeValue(s),
    hasEnd: !!end,
    endDate: end ? dateValue(end) : "",
    endTime: end ? timeValue(end) : "",
    online: e.online ? "virtual" : "in_person",
    venue: e.venue ?? "",
    address: e.address ?? "",
    description: e.description,
    privacy: e.privacy === "group" ? "friends" : e.privacy,
    category: e.category,
  };
}

/** /events/create (and ?edit=<id>): form rail + live desktop preview. */
export function CreateEvent({ editId }: { editId?: string }) {
  const existing = useQ(api.events.get, editId ? { eventId: editId } : "skip");
  if (editId && existing === undefined)
    return (
      <div className="flex justify-center pt-24">
        <Spinner />
      </div>
    );
  if (editId && !existing?.isHost)
    return (
      <div className="px-4 pt-24 text-center">
        <p className="font-bold text-[20px] text-secondary">You can't edit this event</p>
        <Link to="/events" className="mt-3 inline-block font-semibold text-link hover:underline">
          Go to Events
        </Link>
      </div>
    );
  return <CreateForm existing={existing ?? undefined} />;
}

function CreateForm({ existing }: { existing?: EventView }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const create = useM(api.events.create);
  const update = useM(api.events.update);
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const [f, setF] = useState<Form>(() => initialForm(existing));
  const [cover, setCover] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(
    () => () => {
      if (cover) URL.revokeObjectURL(cover.url);
    },
    [cover],
  );

  const startAt = toTs(f.startDate, f.startTime);
  const endAt = f.hasEnd ? toTs(f.endDate, f.endTime) : null;
  const valid =
    f.title.trim().length > 0 &&
    startAt !== null &&
    (!f.hasEnd || (endAt !== null && endAt > startAt)) &&
    (existing || (f.online !== "" && f.privacy !== ""));

  const submit = async () => {
    if (!valid || startAt === null) return;
    setBusy(true);
    setError(null);
    try {
      const coverStorageId = cover
        ? ((await uploadFile(await getUploadUrl({}), cover.file)) as Id<"_storage">)
        : undefined;
      const fields = {
        title: f.title,
        description: f.description,
        category: f.category || "Parties",
        startAt,
        endAt: endAt ?? undefined,
        online: f.online === "virtual",
        venue: f.venue || undefined,
        address: f.address || undefined,
        privacy: (f.privacy || "private") as Privacy,
        coverStorageId,
      };
      if (existing) {
        await update({ eventId: existing._id, ...fields });
        void navigate({ to: "/events/$eventId", params: { eventId: existing._id } });
      } else {
        const id = await create(fields);
        void navigate({ to: "/events/$eventId", params: { eventId: id } });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong",
      );
      setBusy(false);
    }
  };

  const coverUrl = cover?.url ?? existing?.cover ?? null;

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-stretch">
      <RailShell label="Create event" className="flex! shadow-[0_0_8px_var(--shadow-1)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <p className="flex items-center gap-1 pt-3 text-[13px] text-secondary">
            <Link to="/events" className="hover:underline">
              Events
            </Link>
            <ChevronRight size={12} />
            <span>{existing ? "Edit event" : "Create event"}</span>
          </p>
          <h1 className="font-bold text-[24px] text-primary leading-7">
            {existing ? "Edit event" : "Create event"}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <Avatar src={viewer.avatar} size={40} />
            <div>
              <p className="font-semibold text-[15px] text-primary leading-5">{viewer.name}</p>
              <p className="text-[13px] text-secondary leading-4">Host · Your profile</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <CoverPicker
              url={coverUrl}
              onPick={(file) => setCover({ file, url: URL.createObjectURL(file) })}
              onClear={cover ? () => setCover(null) : undefined}
            />
            <Field label="Event name" value={f.title}>
              {(id) => (
                <input
                  id={id}
                  value={f.title}
                  maxLength={64}
                  onChange={(e) => set("title", e.target.value)}
                  className={inputCls}
                />
              )}
            </Field>
            <div className="flex gap-3">
              <Field label="Start date" value={f.startDate} className="flex-1">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={f.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className={inputCls}
                  />
                )}
              </Field>
              <Field label="Start time" value={f.startTime} className="w-[130px]">
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    value={f.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    className={inputCls}
                  />
                )}
              </Field>
            </div>
            {f.hasEnd ? (
              <div className="flex items-center gap-3">
                <Field label="End date" value={f.endDate} className="flex-1">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={f.endDate}
                      min={f.startDate}
                      onChange={(e) => set("endDate", e.target.value)}
                      className={inputCls}
                    />
                  )}
                </Field>
                <Field label="End time" value={f.endTime} className="w-[130px]">
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      value={f.endTime}
                      onChange={(e) => set("endTime", e.target.value)}
                      className={inputCls}
                    />
                  )}
                </Field>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setF((s) => ({
                    ...s,
                    hasEnd: true,
                    endDate: s.startDate,
                    endTime: s.startTime
                      ? `${pad((Number(s.startTime.slice(0, 2)) + 3) % 24)}${s.startTime.slice(2)}`
                      : "",
                  }))
                }
                className="flex items-center gap-1 self-start rounded px-1 font-semibold text-[15px] text-link hover:bg-hover"
              >
                <Plus size={16} strokeWidth={2.6} />
                End date and time
              </button>
            )}
            {f.hasEnd && (
              <button
                type="button"
                onClick={() => setF((s) => ({ ...s, hasEnd: false }))}
                className="-mt-1 self-start rounded px-1 font-semibold text-[13px] text-link hover:bg-hover"
              >
                Remove end time
              </button>
            )}
            <Field label="Is it in person or virtual?" value={f.online}>
              {(id) => (
                <select
                  id={id}
                  value={f.online}
                  onChange={(e) => set("online", e.target.value as Form["online"])}
                  className={cn(inputCls, "appearance-auto")}
                >
                  <option value="" disabled hidden />
                  <option value="in_person">In person</option>
                  <option value="virtual">Virtual</option>
                </select>
              )}
            </Field>
            {f.online === "in_person" && (
              <>
                <Field label="Add location" value={f.venue} icon={<MapPin size={18} />}>
                  {(id) => (
                    <input
                      id={id}
                      value={f.venue}
                      onChange={(e) => set("venue", e.target.value)}
                      className={inputCls}
                    />
                  )}
                </Field>
                <Field label="Address (optional)" value={f.address}>
                  {(id) => (
                    <input
                      id={id}
                      value={f.address}
                      onChange={(e) => set("address", e.target.value)}
                      className={inputCls}
                    />
                  )}
                </Field>
              </>
            )}
            <Field label="What are the details?" value={f.description} tall>
              {(id) => (
                <textarea
                  id={id}
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  className={cn(inputCls, "h-auto resize-none pt-6")}
                />
              )}
            </Field>
            <Field label="Category" value={f.category}>
              {(id) => (
                <select
                  id={id}
                  value={f.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled hidden />
                  {CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Who can see it?" value={f.privacy}>
              {(id) => (
                <select
                  id={id}
                  value={f.privacy}
                  onChange={(e) => set("privacy", e.target.value as Privacy)}
                  className={inputCls}
                >
                  <option value="" disabled hidden />
                  {PRIVACY.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} · {p.sub}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {error && <p className="text-[13px] text-negative">{error}</p>}
          </div>
        </div>
        <div className="border-divider border-t px-4 py-3">
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void submit()}
            className="flex h-9 w-full items-center justify-center rounded-lg bg-btn-primary font-semibold text-[15px] text-white hover:bg-btn-primary-hover disabled:bg-btn disabled:text-disabled"
          >
            {busy ? (
              <Spinner size={18} className="text-white" />
            ) : existing ? (
              "Save"
            ) : (
              "Create event"
            )}
          </button>
        </div>
      </RailShell>

      <main className="min-w-0 flex-1 px-4 py-4 min-[900px]:px-8">
        <Preview form={f} startAt={startAt} endAt={endAt} cover={coverUrl} />
      </main>
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-md bg-transparent px-3 pt-5 pb-1 text-[17px] text-primary outline-none";

/** Facebook's floating-label field: grey border, label shrinks to the top once filled. */
function Field({
  label,
  value,
  children,
  className,
  icon,
  tall,
}: {
  label: string;
  value: string;
  children: (id: string) => ReactNode;
  className?: string;
  icon?: ReactNode;
  tall?: boolean;
}) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  const up = focus || value !== "" || label.endsWith("date") || label.endsWith("time");
  return (
    <div
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className={cn(
        "relative rounded-md border bg-card transition-colors",
        focus
          ? "border-fb shadow-[0_0_0_1px_var(--fb-blue)]"
          : "border-divider hover:border-secondary/60",
        tall && "min-h-[112px]",
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute left-3 flex items-center gap-1 text-secondary transition-all",
          up ? "top-2 text-[12px] leading-4" : "top-4 text-[17px] leading-6",
          focus && "text-fb",
        )}
      >
        {icon && !up && icon}
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function CoverPicker({
  url,
  onPick,
  onClear,
}: {
  url: string | null;
  onPick: (f: File) => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-divider">
      {url ? (
        <img src={url} alt="" className="aspect-[1.9] w-full object-cover" />
      ) : (
        <div className="flex aspect-[1.9] w-full flex-col items-center justify-center bg-comment text-secondary">
          <ImagePlus size={28} />
        </div>
      )}
      <label className="absolute right-2 bottom-2 flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-btn-floating px-3 font-semibold text-[15px] text-primary shadow-base hover:brightness-95">
        <ImagePlus size={16} />
        {url ? "Edit" : "Add cover photo"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
      </label>
      {onClear && (
        <button
          type="button"
          aria-label="Remove cover photo"
          onClick={onClear}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-btn-floating text-icon shadow-base"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/** The right-hand "Desktop preview": a scaled replica of the event page. */
function Preview({
  form,
  startAt,
  endAt,
  cover,
}: {
  form: Form;
  startAt: number | null;
  endAt: number | null;
  cover: string | null;
}) {
  const viewer = useViewer();
  const privacy = PRIVACY.find((p) => p.value === form.privacy);
  return (
    <section className="mx-auto max-w-[1000px] rounded-lg bg-card p-4 shadow-base">
      <h2 className="font-semibold text-[17px] text-primary leading-5">Desktop preview</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-divider bg-wash">
        <div className="bg-card px-6 pb-3">
          <div className="mx-auto aspect-[1.9] w-full max-w-[560px] overflow-hidden rounded-b-lg bg-btn">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,#c9ccd1,#e4e6eb)] dark:bg-[linear-gradient(135deg,#3a3b3c,#4e4f50)]" />
            )}
          </div>
          <p className="mt-4 font-bold text-[13px] text-negative uppercase leading-4">
            {startAt ? longDate(startAt, endAt) : "Date and time"}
          </p>
          <p
            className={cn(
              "mt-1 font-bold text-[24px] leading-7",
              form.title ? "text-primary" : "text-disabled",
            )}
          >
            {form.title || "Event name"}
          </p>
          <p
            className={cn(
              "mt-1 text-[15px]",
              form.venue || form.online === "virtual" ? "text-secondary" : "text-disabled",
            )}
          >
            {form.online === "virtual" ? "Online" : form.venue || "Location"}
          </p>
          <div className="mt-3 flex h-px bg-divider" />
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-4 font-semibold text-[13px]">
              <span className="border-fb border-b-[3px] pb-2 text-link">About</span>
              <span className="pb-2 text-secondary">Discussion</span>
            </div>
            <div className="flex gap-1.5">
              {["Interested", "Going", "Invite"].map((l) => (
                <span
                  key={l}
                  className="rounded-md bg-btn px-2 py-1 font-semibold text-[12px] text-disabled"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-3">
          <div className="flex-1 rounded-lg bg-card p-3 shadow-base">
            <p className="font-bold text-[15px] text-primary">Details</p>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-primary">
              <Users size={14} className="text-icon-secondary" />
              Event by <span className="font-semibold">{viewer.name}</span>
            </p>
            {form.online === "in_person" && (
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-primary">
                <MapPin size={14} className="text-icon-secondary" />
                {form.venue || "Location"}
              </p>
            )}
            {privacy && (
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-primary">
                {privacy.value === "public" ? (
                  <GlobeIcon size={14} />
                ) : privacy.value === "private" ? (
                  <Lock size={14} className="text-icon-secondary" />
                ) : (
                  <Users size={14} className="text-icon-secondary" />
                )}
                {privacy.label} · {privacy.sub}
              </p>
            )}
            <p
              className={cn(
                "mt-2 line-clamp-4 whitespace-pre-line text-[13px]",
                form.description ? "text-primary" : "text-disabled",
              )}
            >
              {form.description || "Details"}
            </p>
          </div>
          <div className="hidden w-[38%] flex-col gap-3 sm:flex">
            <div className="rounded-lg bg-card p-3 shadow-base">
              <p className="font-bold text-[15px] text-primary">Guests</p>
              <div className="mt-2 flex text-center">
                {["Going", "Interested"].map((l, i) => (
                  <div key={l} className="flex-1">
                    <p className="font-bold text-[15px] text-primary">{i === 0 ? 1 : 0}</p>
                    <p className="text-[11px] text-secondary">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

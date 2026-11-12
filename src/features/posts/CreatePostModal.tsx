import { ChevronLeft, Search, X } from "lucide-react";
import { type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal, PopoverPanel, Tooltip } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type Audience, AudienceChip } from "./Audience";
import { BACKGROUNDS, backgroundFor } from "./backgrounds";
import {
  CheckInIcon,
  DotsIcon,
  FeelingIcon,
  GifIcon,
  PhotoVideoIcon,
  SmileOutline,
  TagPeopleIcon,
  TextBackgroundIcon,
} from "./icons";
import { PhotoGrid } from "./PhotoGrid";
import type { PostView } from "./types";
import { mediaSize, uploadFile } from "./util";

export type ComposerPanel = "photo" | "feeling" | "tag" | "checkin";
type View = "main" | "feeling" | "tag" | "checkin";

export const FEELINGS: [string, string][] = [
  ["😀", "happy"],
  ["🥰", "loved"],
  ["😍", "lovely"],
  ["🤩", "excited"],
  ["😜", "crazy"],
  ["😊", "blessed"],
  ["😔", "sad"],
  ["🙏", "thankful"],
  ["😌", "relaxed"],
  ["😎", "cool"],
  ["😴", "tired"],
  ["🤒", "sick"],
  ["😇", "grateful"],
  ["🥳", "festive"],
  ["😤", "determined"],
  ["😋", "hungry"],
  ["🤔", "thoughtful"],
  ["😅", "nervous"],
  ["😡", "angry"],
  ["😢", "emotional"],
];

const PLACES = [
  "Seattle, Washington",
  "Capitol Hill, Seattle",
  "Pike Place Market",
  "Space Needle",
  "Gas Works Park",
  "Ballard, Seattle",
  "Fremont, Seattle",
  "Green Lake Park",
  "Discovery Park",
  "University District, Seattle",
  "Alki Beach",
  "Kerry Park",
  "Lumen Field",
  "Seattle Center",
  "Mount Rainier National Park",
];

type LocalMedia = { file: File; preview: string; kind: "image" | "video" };
type Friend = { _id: Id<"users">; name: string; avatar: string };

/**
 * Facebook's "Create post" dialog. Also edits an existing post (text,
 * background, audience, feeling, place) when `editing` is set.
 */
export function CreatePostModal({
  open,
  onOpenChange,
  initialPanel,
  groupId,
  groupName,
  timelineUser,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialPanel?: ComposerPanel;
  groupId?: Id<"groups">;
  groupName?: string;
  /** Posting on a friend's timeline. */
  timelineUser?: { _id: Id<"users">; firstName: string };
  editing?: PostView;
}) {
  const viewer = useViewer();
  const create = useM(api.posts.create);
  const update = useM(api.posts.update);
  const getUploadUrl = useM(api.posts.generateUploadUrl);

  const [view, setView] = useState<View>("main");
  const [text, setText] = useState(editing?.text ?? "");
  const [background, setBackground] = useState<string | null>(editing?.background ?? null);
  const [showSwatches, setShowSwatches] = useState(false);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [tagged, setTagged] = useState<Friend[]>(
    editing?.tagged.map((u) => ({ _id: u._id, name: u.name, avatar: u.avatar })) ?? [],
  );
  const [feeling, setFeeling] = useState<string | null>(editing?.feeling ?? null);
  const [place, setPlace] = useState<string | null>(editing?.place ?? null);
  const [privacy, setPrivacy] = useState<Audience>(editing?.privacy ?? "friends");
  // New posts start at the default audience from Settings & privacy.
  const defaultAudience = useQ(api.settings.get, editing ? "skip" : {})?.defaultAudience;
  useEffect(() => {
    if (open && !editing && defaultAudience) setPrivacy(defaultAudience);
  }, [open, editing, defaultAudience]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Apply the panel the composer button asked for each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setView(
      initialPanel === "feeling" || initialPanel === "tag" || initialPanel === "checkin"
        ? initialPanel
        : "main",
    );
    if (initialPanel === "photo") setShowDrop(true);
  }, [open, initialPanel]);

  const reset = () => {
    setView("main");
    setText("");
    setBackground(null);
    setShowSwatches(false);
    setMedia([]);
    setShowDrop(false);
    setTagged([]);
    setFeeling(null);
    setPlace(null);
    setError(null);
  };

  const addFiles = (files: FileList | File[]) => {
    const next = [...files]
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        kind: f.type.startsWith("video/") ? ("video" as const) : ("image" as const),
      }));
    if (next.length) {
      setMedia((m) => [...m, ...next]);
      setBackground(null);
      setShowSwatches(false);
    }
  };

  const hasContent = text.trim().length > 0 || media.length > 0 || !!editing;
  const bgAllowed = media.length === 0 && !showDrop && text.length <= 130 && !editing?.media.length;
  const bg = bgAllowed ? backgroundFor(background) : null;
  const large = !bg && text.length < 85 && media.length === 0 && !showDrop;

  const submit = async () => {
    if (!hasContent || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await update({
          postId: editing._id,
          text,
          background: bg ? bg.key : null,
          privacy: editing.group ? undefined : privacy,
          feeling,
          place,
        });
      } else {
        const uploads = await Promise.all(
          media.map(async (m) => {
            const url = await getUploadUrl({});
            const storageId = (await uploadFile(url, m.file)) as Id<"_storage">;
            return { storageId, kind: m.kind, ...(await mediaSize(m.file)) };
          }),
        );
        await create({
          text: text || undefined,
          background: bg?.key,
          uploads,
          feeling: feeling ?? undefined,
          place: place ?? undefined,
          taggedIds: tagged.map((t) => t._id),
          privacy: groupId ? undefined : privacy,
          groupId,
          timelineUserId: timelineUser?._id,
        });
      }
      reset();
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    view === "feeling"
      ? "How are you feeling?"
      : view === "tag"
        ? "Tag people"
        : view === "checkin"
          ? "Search for location"
          : editing
            ? "Edit post"
            : "Create post";

  const placeholder = timelineUser
    ? `Write something to ${timelineUser.firstName}...`
    : groupId
      ? "Create a public post..."
      : `What's on your mind, ${viewer.firstName}?`;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setView("main");
      }}
      title={title}
      width={500}
      onBack={view !== "main" ? () => setView("main") : undefined}
      className="rounded-xl"
    >
      {view === "main" && (
        <div className="flex flex-col">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {/* Author row */}
            <div className="flex items-center gap-3 px-4 pt-4">
              <Avatar src={viewer.avatar} size={40} />
              <div className="min-w-0">
                <p className="text-[15px] leading-5">
                  <span className="font-semibold">{viewer.name}</span>
                  <ActivityLine feeling={feeling} tagged={tagged} place={place} />
                </p>
                <div className="mt-1 flex gap-1">
                  {groupId || editing?.group ? (
                    <span className="inline-flex h-6 items-center rounded-md bg-btn px-2 font-semibold text-[13px]">
                      {groupName ?? editing?.group?.name ?? "Group"}
                    </span>
                  ) : (
                    <AudienceChip value={privacy} onChange={setPrivacy} />
                  )}
                </div>
              </div>
            </div>

            {/* Text */}
            {bg ? (
              <div
                className="relative mt-3 flex h-[336px] items-center justify-center px-10"
                style={{ background: bg.css }}
              >
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 130))}
                  placeholder={placeholder}
                  rows={3}
                  // biome-ignore lint/a11y/noAutofocus: the composer dialog focuses its text box
                  autoFocus
                  className="w-full resize-none bg-transparent text-center font-bold text-[30px] leading-9 outline-none placeholder:text-white/80"
                  style={{ color: bg.text }}
                />
              </div>
            ) : (
              <div className="px-4 pt-3">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  // biome-ignore lint/a11y/noAutofocus: the composer dialog focuses its text box
                  autoFocus
                  rows={large ? 4 : 3}
                  className={cn(
                    "w-full resize-none bg-transparent text-primary outline-none placeholder:text-placeholder",
                    large ? "text-[24px] leading-7" : "text-[15px] leading-5",
                  )}
                />
              </div>
            )}

            {/* Background + emoji row */}
            {!showDrop && media.length === 0 && !editing?.media.length && (
              <div className="flex items-center justify-between px-4 py-2">
                {showSwatches ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Hide background options"
                      onClick={() => setShowSwatches(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-btn"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <Swatch
                      css="var(--card)"
                      active={!background}
                      label="No background"
                      onClick={() => setBackground(null)}
                      bordered
                    />
                    {BACKGROUNDS.slice(0, 9).map((b) => (
                      <Swatch
                        key={b.key}
                        css={b.css}
                        label={b.label}
                        active={background === b.key}
                        onClick={() => {
                          setBackground(b.key);
                          textRef.current?.focus();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Tooltip content="Background options" side="top">
                    <button
                      type="button"
                      aria-label="Show background options"
                      onClick={() => setShowSwatches(true)}
                      className="rounded-lg"
                    >
                      <TextBackgroundIcon />
                    </button>
                  </Tooltip>
                )}
                <EmojiButton onPick={(e) => setText((t) => t + e)} />
              </div>
            )}

            {/* Media */}
            {(showDrop || media.length > 0) && (
              <div className="mx-4 mt-2 mb-2 rounded-lg border border-divider p-2">
                <div className="relative">
                  {media.length === 0 ? (
                    <DropZone onFiles={addFiles} onBrowse={() => fileRef.current?.click()} />
                  ) : (
                    <MediaPreview media={media} onAdd={() => fileRef.current?.click()} />
                  )}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => {
                      setMedia([]);
                      setShowDrop(false);
                    }}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-divider bg-card text-secondary hover:brightness-95"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}
            {editing && editing.media.length > 0 && (
              <div className="mx-4 my-2 grid grid-cols-4 gap-1">
                {editing.media.map((m, i) => (
                  <img
                    key={i}
                    src={m.url}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pt-2 pb-4">
            {/* Add to your post */}
            <div className="flex h-[58px] items-center justify-between rounded-lg border border-divider px-4 shadow-[0_1px_2px_var(--shadow-1)]">
              <span className="font-semibold text-[15px]">Add to your post</span>
              <div className="flex items-center">
                <AddButton
                  label="Photo/video"
                  disabled={!!editing}
                  onClick={() => {
                    setShowDrop(true);
                    setBackground(null);
                  }}
                >
                  <PhotoVideoIcon />
                </AddButton>
                <AddButton label="Tag people" disabled={!!editing} onClick={() => setView("tag")}>
                  <TagPeopleIcon />
                </AddButton>
                <AddButton label="Feeling/activity" onClick={() => setView("feeling")}>
                  <FeelingIcon />
                </AddButton>
                <AddButton label="Check in" onClick={() => setView("checkin")}>
                  <CheckInIcon />
                </AddButton>
                <AddButton label="GIF" disabled>
                  <GifIcon />
                </AddButton>
                <AddButton label="More">
                  <DotsIcon size={24} className="text-icon-secondary" />
                </AddButton>
              </div>
            </div>
            {error && <p className="mt-2 text-negative text-sm">{error}</p>}
            <Button
              variant="primary"
              block
              className="mt-4"
              disabled={!hasContent || busy}
              onClick={() => void submit()}
            >
              {busy ? <Spinner size={18} className="text-white" /> : editing ? "Save" : "Post"}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {view === "feeling" && (
        <FeelingPicker
          value={feeling}
          onPick={(f) => {
            setFeeling(f);
            setView("main");
          }}
        />
      )}
      {view === "tag" && (
        <TagPicker value={tagged} onChange={setTagged} onDone={() => setView("main")} />
      )}
      {view === "checkin" && (
        <PlacePicker
          onPick={(p) => {
            setPlace(p);
            setView("main");
          }}
          onClear={place ? () => setPlace(null) : undefined}
        />
      )}
    </Modal>
  );
}

function ActivityLine({
  feeling,
  tagged,
  place,
}: {
  feeling: string | null;
  tagged: Friend[];
  place: string | null;
}) {
  if (!feeling && !tagged.length && !place) return null;
  const emoji = FEELINGS.find(([, f]) => f === feeling)?.[0];
  return (
    <span>
      {feeling && (
        <>
          {" "}
          is {emoji} feeling <span className="font-semibold">{feeling}</span>
        </>
      )}
      {tagged.length > 0 && (
        <>
          {feeling ? " with " : " is with "}
          <span className="font-semibold">{tagged[0].name}</span>
          {tagged.length > 1 && (
            <>
              {" "}
              and{" "}
              <span className="font-semibold">
                {tagged.length - 1} {tagged.length === 2 ? "other" : "others"}
              </span>
            </>
          )}
        </>
      )}
      {place && (
        <>
          {feeling || tagged.length ? " at " : " is at "}
          <span className="font-semibold">{place}</span>
        </>
      )}
      .
    </span>
  );
}

function Swatch({
  css,
  label,
  active,
  onClick,
  bordered,
}: {
  css: string;
  label: string;
  active: boolean;
  onClick: () => void;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-lg",
        bordered && "border border-divider",
        active && "ring-2 ring-fb ring-offset-2 ring-offset-card",
      )}
      style={{ background: css }}
    />
  );
}

function AddButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {children}
      </button>
    </Tooltip>
  );
}

const EMOJI = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😮",
  "😢",
  "😡",
  "👍",
  "❤️",
  "🙏",
  "🎉",
  "🔥",
  "👏",
  "😅",
  "🤔",
  "😎",
  "☕",
  "🌧️",
  "🏔️",
  "🌲",
  "🎶",
  "📚",
  "🍜",
  "🐶",
];

function EmojiButton({ onPick }: { onPick: (e: string) => void }) {
  return (
    <PopoverPanel
      width={296}
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Emoji"
          className="flex h-9 w-9 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
        >
          <SmileOutline size={24} />
        </button>
      }
    >
      <div className="grid grid-cols-8 gap-0.5 p-2">
        {EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-xl hover:bg-hover"
          >
            {e}
          </button>
        ))}
      </div>
    </PopoverPanel>
  );
}

function DropZone({ onFiles, onBrowse }: { onFiles: (f: FileList) => void; onBrowse: () => void }) {
  const [over, setOver] = useState(false);
  const stop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <button
      type="button"
      onClick={onBrowse}
      onDragOver={(e) => {
        stop(e);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex h-[220px] w-full flex-col items-center justify-center rounded-lg bg-comment transition-colors hover:brightness-95 dark:hover:brightness-125",
        over && "ring-2 ring-fb",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-btn">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
          <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v6a3.5 3.5 0 0 1-3.5 3.5h-.6l.06-.5V7.5A3.5 3.5 0 0 0 10.5 4H5.06A3.5 3.5 0 0 1 8.5 2h6ZM2 8.5A2.5 2.5 0 0 1 4.5 6h6A2.5 2.5 0 0 1 13 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 2 15.5v-7Zm2.62 7.3h5.76c.4 0 .63-.44.4-.77l-1.7-2.42a.5.5 0 0 0-.82 0l-.88 1.25-.53-.66a.5.5 0 0 0-.79.02l-1.84 2.2c-.27.33-.04.82.4.82ZM5.5 10.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
        </svg>
      </span>
      <span className="mt-2 font-semibold text-[17px]">Add photos/videos</span>
      <span className="text-[12px] text-secondary">or drag and drop</span>
    </button>
  );
}

function MediaPreview({ media, onAdd }: { media: LocalMedia[]; onAdd: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <PhotoGrid media={media.map((m) => ({ url: m.preview, kind: m.kind }))} />
      <div className="absolute top-2 left-2 flex gap-2">
        <Button variant="floating" size="sm" onClick={onAdd} icon={<PhotoVideoIcon size={16} />}>
          Add photos/videos
        </Button>
      </div>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-9 flex-1 items-center gap-2 rounded-full bg-input px-3">
      <Search size={16} className="text-secondary" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // biome-ignore lint/a11y/noAutofocus: search panels focus their field like Facebook
        autoFocus
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

function FeelingPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (f: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const list = FEELINGS.filter(([, f]) => f.includes(q.toLowerCase()));
  return (
    <div className="p-4">
      <div className="mb-3 border-divider border-b">
        <span className="inline-block border-fb border-b-[3px] px-4 pb-3 font-semibold text-[15px] text-fb">
          Feelings
        </span>
      </div>
      <div className="mb-3 flex">
        <SearchField value={q} onChange={setQ} placeholder="Search" />
      </div>
      <div className="grid max-h-[360px] grid-cols-2 gap-1 overflow-y-auto">
        {list.map(([emoji, f]) => (
          <button
            key={f}
            type="button"
            onClick={() => onPick(value === f ? null : f)}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 text-left hover:bg-hover",
              value === f && "bg-highlight",
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-xl">
              {emoji}
            </span>
            <span className="font-medium text-[15px]">{f}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TagPicker({
  value,
  onChange,
  onDone,
}: {
  value: Friend[];
  onChange: (v: Friend[]) => void;
  onDone: () => void;
}) {
  const friends = useQ(api.posts.friendPicker, {});
  const [q, setQ] = useState("");
  const picked = new Set(value.map((v) => v._id));
  const list = useMemo(
    () => (friends ?? []).filter((f) => f.name.toLowerCase().includes(q.toLowerCase())),
    [friends, q],
  );
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <SearchField value={q} onChange={setQ} placeholder="Search for friends" />
        <Button variant="link" className="px-2" onClick={onDone}>
          Done
        </Button>
      </div>
      {value.length > 0 && (
        <>
          <p className="mb-2 font-semibold text-[13px] text-secondary uppercase">Tagged</p>
          <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-divider p-2">
            {value.map((f) => (
              <span
                key={f._id}
                className="inline-flex items-center gap-1 rounded-md bg-btn-soft px-2 py-1 font-semibold text-btn-soft-text text-sm"
              >
                {f.name}
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onChange(value.filter((v) => v._id !== f._id))}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      <p className="mb-1 font-semibold text-[13px] text-secondary uppercase">Suggestions</p>
      <div className="max-h-[320px] overflow-y-auto">
        {friends === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          list.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() =>
                onChange(picked.has(f._id) ? value.filter((v) => v._id !== f._id) : [...value, f])
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover",
                picked.has(f._id) && "bg-highlight",
              )}
            >
              <Avatar src={f.avatar} size={36} />
              <span className="font-medium text-[15px]">{f.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PlacePicker({ onPick, onClear }: { onPick: (p: string) => void; onClear?: () => void }) {
  const [q, setQ] = useState("");
  const list = PLACES.filter((p) => p.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <SearchField value={q} onChange={setQ} placeholder="Where are you?" />
        {onClear && (
          <Button variant="link" className="px-2" onClick={onClear}>
            Remove
          </Button>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {q.trim() && !PLACES.some((p) => p.toLowerCase() === q.trim().toLowerCase()) && (
          <PlaceRow name={q.trim()} sub="Add a custom location" onClick={() => onPick(q.trim())} />
        )}
        {list.map((p) => (
          <PlaceRow key={p} name={p} sub="Seattle, Washington" onClick={() => onPick(p)} />
        ))}
      </div>
    </div>
  );
}

function PlaceRow({ name, sub, onClick }: { name: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-btn">
        <CheckInIcon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-[15px]">{name}</span>
        <span className="block truncate text-secondary text-sm">{sub}</span>
      </span>
    </button>
  );
}

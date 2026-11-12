import { useNavigate } from "@tanstack/react-router";
import { Image as ImageIcon, Settings } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useViewer } from "@/app/viewer";
import { BACKGROUNDS } from "@/features/posts/backgrounds";
import { cn } from "@/lib/format";
import { Avatar, Button, Card, Divider, IconButton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { StorySettingsDialog } from "./StorySettingsDialog";
import { storyBackground, storyTextColor } from "./storyUtils";

type Mode = "pick" | "text" | "photo";

const PHOTO_TILE = "linear-gradient(135deg, #2e89ff 0%, #7a5cf6 100%)";
const TEXT_TILE = "linear-gradient(135deg, #f04ba0 0%, #c046e0 50%, #7a4bf0 100%)";

/** /stories/create: Facebook's story creator (photo or text story). */
export function StoryCreator() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const generateUploadUrl = useM(api.posts.generateUploadUrl);
  const createStory = useM(api.stories.create);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>("pick");
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BACKGROUNDS[4].key);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (mode === "text") textArea.current?.focus();
  }, [mode]);

  const discard = () => {
    setMode("pick");
    setText("");
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "photo" && file) {
        const size = await imageSize(preview!);
        const url = await generateUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await createStory({ storageId, text: text || undefined, ...size });
      } else {
        await createStory({ text, background: bg });
      }
      void navigate({ to: "/" });
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const canShare = mode === "text" ? text.trim().length > 0 : mode === "photo" && !!file;

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-stretch">
      <aside className="sticky top-14 flex h-[calc(100vh-56px)] w-[360px] shrink-0 flex-col bg-card shadow-[1px_0_2px_var(--shadow-1)]">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="font-bold text-[24px] text-primary leading-7">Your story</h1>
          <IconButton label="Story privacy" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} className="text-icon" />
          </IconButton>
        </div>
        <div className="flex items-center gap-3 px-4 py-2">
          <Avatar src={viewer.avatar} size={60} />
          <span className="font-semibold text-[17px] text-primary">{viewer.name}</span>
        </div>
        <Divider className="mx-4 my-2" />

        {mode === "text" && (
          <div className="flex flex-col gap-4 px-4 pt-2">
            <textarea
              ref={textArea}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 250))}
              placeholder="Start typing"
              rows={7}
              className="w-full resize-none rounded-md border border-divider bg-transparent p-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
            />
            <div className="rounded-lg border border-divider p-3">
              <p className="mb-2 font-semibold text-[15px] text-primary">Backgrounds</p>
              <div className="flex flex-wrap gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    aria-label={b.label}
                    aria-pressed={bg === b.key}
                    onClick={() => setBg(b.key)}
                    className={cn(
                      "h-7 w-7 rounded-full",
                      bg === b.key && "ring-2 ring-fb ring-offset-2 ring-offset-card",
                    )}
                    style={{ background: b.css }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {mode === "photo" && (
          <div className="flex flex-col gap-3 px-4 pt-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 120))}
              placeholder="Add text"
              rows={3}
              className="w-full resize-none rounded-md border border-divider bg-transparent p-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              Change photo
            </Button>
          </div>
        )}

        {mode !== "pick" && (
          <div className="mt-auto flex gap-2 border-divider border-t p-4 shadow-[0_-1px_2px_var(--shadow-1)]">
            <Button variant="secondary" className="w-[110px]" onClick={discard} disabled={busy}>
              Discard
            </Button>
            <Button
              variant="primary"
              block
              onClick={() => void share()}
              disabled={!canShare || busy}
            >
              {busy ? <Spinner size={18} className="text-white" /> : "Share to story"}
            </Button>
          </div>
        )}
        {error && <p className="px-4 pb-3 text-[13px] text-negative">{error}</p>}
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center p-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setMode("photo");
            }
            e.target.value = "";
          }}
        />
        {mode === "pick" ? (
          <div className="flex flex-wrap justify-center gap-5">
            <Tile
              gradient={PHOTO_TILE}
              label="Create a photo story"
              onClick={() => fileInput.current?.click()}
              glyph={<ImageIcon size={22} strokeWidth={2.2} />}
            />
            <Tile
              gradient={TEXT_TILE}
              label="Create a text story"
              onClick={() => setMode("text")}
              glyph={<span className="font-semibold text-[17px]">Aa</span>}
            />
          </div>
        ) : (
          <Card className="flex h-[calc(100vh-104px)] max-h-[780px] w-full max-w-[980px] flex-col p-4">
            <p className="pb-3 font-semibold text-[15px] text-primary">Preview</p>
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-[#18191a]">
              <div className="relative aspect-[9/16] h-[92%] overflow-hidden rounded-lg bg-black">
                {mode === "text" ? (
                  <div
                    className="flex h-full w-full items-center justify-center p-6 text-center font-bold text-[22px] text-white leading-7"
                    style={{ background: storyBackground(bg), color: storyTextColor(bg) }}
                  >
                    <span className="whitespace-pre-wrap break-words">
                      {text || "Start typing"}
                    </span>
                  </div>
                ) : (
                  preview && (
                    <>
                      <img src={preview} alt="" className="h-full w-full object-contain" />
                      {text && (
                        <p className="absolute inset-x-4 bottom-10 rounded-lg bg-black/50 p-2 text-center font-semibold text-[15px] text-white">
                          {text}
                        </p>
                      )}
                    </>
                  )
                )}
              </div>
            </div>
          </Card>
        )}
      </main>
      <StorySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function Tile({
  gradient,
  label,
  glyph,
  onClick,
}: {
  gradient: string;
  label: string;
  glyph: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[330px] w-[220px] flex-col items-center justify-center gap-3 rounded-lg shadow-base transition hover:brightness-95"
      style={{ background: gradient }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#050505] shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        {glyph}
      </span>
      <span className="font-semibold text-[15px] text-white">{label}</span>
    </button>
  );
}

function imageSize(src: string) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({});
    img.src = src;
  });
}

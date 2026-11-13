import { useState } from "react";
import { useM } from "@/app/viewer";
import { Button, Card } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type { SceneSource } from "../../../../convex/lib/unitScene";
import { sceneId } from "./id";
import { fieldClass } from "./UnitEditor";

export function UnitSources({ doc }: { doc: Doc<"unitScenes"> }) {
  const uploadUrl = useM(api.unitScenes.uploadUrl),
    addSource = useM(api.unitScenes.addSource);
  const [kind, setKind] = useState<SceneSource["kind"]>("floorplan");
  const [url, setUrl] = useState(""),
    [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function add(file?: File) {
    setBusy(true);
    setError("");
    try {
      const source: SceneSource = {
        key: `source-${sceneId()}`,
        label: (label || file?.name || `Source ${doc.sources.length + 1}`).slice(0, 120),
        kind,
      };
      if (file) {
        if (file.size > 25 * 1024 * 1024) throw new Error("Maximum file size is 25 MB");
        const upload = await fetch(await uploadUrl({ id: doc._id }), {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!upload.ok) throw new Error("Upload failed");
        const response = (await upload.json()) as {
          storageId: NonNullable<SceneSource["storageId"]>;
        };
        source.storageId = response.storageId;
      } else source.url = url.trim();
      await addSource({ id: doc._id, revision: doc.revision, source });
      setUrl("");
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add source");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-bold text-lg text-primary">Source material</h2>
      <p className="text-secondary text-sm">
        Private to you. Add a floor-plan image, room photos, or a walkthrough video. Muse reads the
        media when you generate.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {doc.sources.map((s) => (
          <a
            key={s.key}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-lg border border-divider text-primary text-xs"
          >
            {s.url && s.kind !== "video" ? (
              <img src={s.url} alt={s.label} className="aspect-[4/3] w-full bg-wash object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-wash">
                {s.kind === "video" ? "Video" : "Unavailable"}
              </div>
            )}
            <div className="break-words p-2">
              {s.label}
              <span className="block text-secondary">{s.key}</span>
            </div>
          </a>
        ))}
      </div>
      {doc.sources.length < 20 && (
        <>
          <label className="block text-primary text-sm">
            Media type
            <select
              className={fieldClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as SceneSource["kind"])}
            >
              <option value="floorplan">Floor plan image</option>
              <option value="photo">Room photo</option>
              <option value="video">Walkthrough video</option>
            </select>
          </label>
          <label className="block text-primary text-sm">
            Source label
            <input
              className={fieldClass}
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="For example: living room, looking toward kitchen"
            />
          </label>
          <label className="block text-primary text-sm">
            Upload {kind === "video" ? "MP4 / WebM" : "JPG / PNG / WebP"}
            <input
              className={`${fieldClass} mt-1`}
              type="file"
              accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void add(file);
                e.target.value = "";
              }}
            />
          </label>
          <label className="block text-primary text-sm">
            Or a direct public media URL
            <input
              className={fieldClass}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/floorplan.jpg"
            />
          </label>
          <p className="text-secondary text-xs">
            Use the image or video file URL. A listing page or YouTube page is not a media file.
          </p>
          <Button variant="secondary" disabled={busy || !url.trim()} onClick={() => void add()}>
            Add URL
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700 text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

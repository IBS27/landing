import { useState } from "react";
import { useM } from "@/app/viewer";
import { Button, Card } from "@/ui/primitives";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type { SceneSource } from "../../../../convex/lib/unitScene";
import { sceneId } from "./id";
import { fieldClass, labelClass } from "./UnitEditor";

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
      <div>
        <h2 className="font-bold text-[17px] text-primary leading-5">Source material</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Private to you. Add a floor-plan image, room photos, or a walkthrough video. Muse reads
          the media when you generate.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
        {doc.sources.map((s) => (
          <a
            key={s.key}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="group min-w-0 overflow-hidden rounded-lg bg-wash text-[13px] text-primary leading-4 dark:bg-hover"
          >
            {s.url && s.kind !== "video" ? (
              <img
                src={s.url}
                alt={s.label}
                className={`aspect-[4/3] w-full bg-white ${s.kind === "floorplan" ? "object-contain" : "object-cover"}`}
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-btn text-secondary">
                {s.kind === "video" ? "Video" : "Unavailable"}
              </div>
            )}
            <div className="px-2 py-1.5">
              <span className="block truncate font-semibold group-hover:underline" title={s.label}>
                {s.label}
              </span>
              <span className="block truncate text-[12px] text-secondary">{s.key}</span>
            </div>
          </a>
        ))}
      </div>
      {doc.sceneSources?.some(
        (s) =>
          !doc.sources.some(
            (current) =>
              current.key === s.key && current.url === s.url && current.storageId === s.storageId,
          ),
      ) && (
        <details className="text-[13px] text-secondary leading-[18px]">
          <summary className="cursor-pointer font-semibold hover:underline">
            Earlier evidence used by your saved layout
          </summary>
          <ul className="space-y-1 pt-1.5">
            {doc.sceneSources.map((s) => (
              <li key={s.key}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link hover:underline"
                >
                  {s.label} ({s.key})
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {doc.sources.length < 20 && (
        <div className="space-y-3 border-divider border-t pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
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
            <label className={labelClass}>
              Source label
              <input
                className={fieldClass}
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="For example: living room, looking toward kitchen"
              />
            </label>
          </div>
          <label className={labelClass}>
            Upload {kind === "video" ? "MP4 / WebM" : "JPG / PNG / WebP"}
            <input
              className="block w-full text-[13px] text-secondary file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border-0 file:bg-btn file:px-3 file:font-semibold file:text-[15px] file:text-btn-text hover:file:brightness-95 disabled:opacity-50"
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
          <div className={labelClass}>
            <label htmlFor={`${doc._id}-source-url`}>Or a direct public media URL</label>
            <div className="flex gap-2">
              <input
                id={`${doc._id}-source-url`}
                className={fieldClass}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/floorplan.jpg"
              />
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={busy || !url.trim()}
                onClick={() => void add()}
              >
                Add URL
              </Button>
            </div>
            <span className="text-[12px] leading-4">
              Use the image or video file URL. A listing page or YouTube page is not a media file.
            </span>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-negative">
          {error}
        </p>
      )}
    </Card>
  );
}

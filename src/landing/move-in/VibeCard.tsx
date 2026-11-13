import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Pencil, RefreshCw, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useM, useViewerContext } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { SourcesChip } from "@/ui/Citations";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { CitedSource, NonEmpty } from "../../../convex/lib/citations";
import type { VibeValue } from "../../../convex/lib/vibe";
import { VibeEditor, VibeView } from "./vibeParts";

export type Room = FunctionReturnType<typeof api.rooms.mine>[number];
type Suggestion = FunctionReturnType<typeof api.rooms.suggestVibe>;

const EMPTY: VibeValue = { summary: "", styles: [], palette: [], keywords: [] };

const ORIGIN_TEXT = {
  typed: "You wrote this",
  generated: "Suggested by Muse",
  edited: "Suggested by Muse, edited by you",
} as const;

function errorText(e: unknown) {
  return e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong";
}

/**
 * The room's style vibe (#25): typed by the person, or suggested by Muse from
 * what they saved, liked and follow. A suggestion is only a proposal until
 * they keep it, and it shows what it was based on.
 */
export function VibeCard({ room }: { room: Room }) {
  const { viewerId } = useViewerContext();
  const suggest = useAction(api.rooms.suggestVibe);
  const setVibe = useM(api.rooms.setVibe);
  const clearVibe = useM(api.rooms.clearVibe);
  const toast = useToast();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [editor, setEditor] = useState<null | "new" | "current" | "suggestion">(null);
  const [busy, setBusy] = useState<null | "suggest" | "save">(null);

  async function run(work: "suggest" | "save", fn: () => Promise<unknown>) {
    setBusy(work);
    try {
      await fn();
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const askMuse = () =>
    run("suggest", async () => {
      if (!viewerId) return;
      setEditor(null);
      setSuggestion(await suggest({ viewerId, roomId: room._id }));
    });

  const keepSuggestion = (vibe: VibeValue, edited: boolean) =>
    run("save", async () => {
      if (!suggestion) return;
      await setVibe({
        roomId: room._id,
        vibe,
        origin: edited ? "edited" : "generated",
        citations: suggestion.citations ?? undefined,
        basis: suggestion.basis,
      });
      setSuggestion(null);
      setEditor(null);
    });

  const saveEdit = (vibe: VibeValue) =>
    run("save", async () => {
      const wasMuse = room.vibe && room.vibe.origin !== "typed";
      await setVibe({
        roomId: room._id,
        vibe,
        origin: editor === "current" && wasMuse ? "edited" : "typed",
        keepSources: editor === "current" && Boolean(wasMuse),
      });
      setEditor(null);
    });

  let body: ReactNode;
  if (busy === "suggest") {
    body = (
      <div className="flex items-center gap-3 py-6 text-[15px] text-secondary">
        <Spinner size={20} />
        Muse is looking at what you've saved, liked and follow…
      </div>
    );
  } else if (editor) {
    const initial =
      editor === "suggestion" && suggestion
        ? suggestion.vibe
        : editor === "current" && room.vibe
          ? room.vibe
          : EMPTY;
    body = (
      <VibeEditor
        initial={initial}
        busy={busy === "save"}
        saveLabel={editor === "suggestion" ? "Use this vibe" : "Save vibe"}
        onCancel={() => setEditor(null)}
        onSave={(vibe) => (editor === "suggestion" ? keepSuggestion(vibe, true) : saveEdit(vibe))}
      />
    );
  } else if (suggestion) {
    body = (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-divider bg-wash/60 p-4">
          <p className="mb-3 flex items-center gap-1.5 font-semibold text-[13px] text-secondary">
            <Sparkles size={14} className="text-accent" />
            {suggestion.basis.length === 0 && !suggestion.sources
              ? "There isn't much to go on yet, so this is a simple starting point. Edit it to make it yours."
              : suggestion.via === "fallback"
                ? "Muse's AI isn't available right now, so this comes from simple matching on what you saved, liked and follow."
                : "Muse suggests this from what you saved, liked and follow."}
          </p>
          <VibeView vibe={suggestion.vibe} />
          <Basis basis={suggestion.basis} sources={suggestion.sources} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setSuggestion(null)}>
            Dismiss
          </Button>
          <Button onClick={() => setEditor("suggestion")} icon={<Pencil size={16} />}>
            Edit first
          </Button>
          <Button
            variant="primary"
            disabled={busy === "save"}
            onClick={() => keepSuggestion(suggestion.vibe, false)}
          >
            Use this vibe
          </Button>
        </div>
      </div>
    );
  } else if (room.vibe) {
    const vibe = room.vibe;
    body = (
      <div className="flex flex-col gap-4">
        <VibeView vibe={vibe} />
        <Basis basis={vibe.basis} sources={vibe.sources} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-divider border-t pt-3">
          <span className="text-[13px] text-secondary">{ORIGIN_TEXT[vibe.origin]}</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => run("save", () => clearVibe({ roomId: room._id }))}
            >
              Remove
            </Button>
            <Button icon={<RefreshCw size={16} />} disabled={busy !== null} onClick={askMuse}>
              Suggest another
            </Button>
            <Button icon={<Pencil size={16} />} onClick={() => setEditor("current")}>
              Edit
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-start gap-3 py-2">
        <p className="text-[15px] text-secondary">
          A vibe is the look you're going for: a few words, some styles and colors. Landing uses it
          to find Marketplace pieces that fit.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Sparkles size={16} />} onClick={askMuse}>
            Suggest a vibe
          </Button>
          <Button icon={<Pencil size={16} />} onClick={() => setEditor("new")}>
            Write my own
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold text-[20px] text-primary leading-6">Vibe</h2>
      {body}
      {toast.node}
    </Card>
  );
}

/** What a Muse suggestion was based on: the reasons, and a chip with the cited sources. */
function Basis({ basis, sources }: { basis: string[]; sources: NonEmpty<CitedSource> | null }) {
  if (basis.length === 0 && !sources) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="font-semibold text-[13px] text-secondary">Based on</p>
      {basis.length > 0 && (
        <ul className="flex flex-col gap-1">
          {basis.map((b) => (
            <li key={b} className="text-[13px] text-primary leading-[18px]">
              {b}
            </li>
          ))}
        </ul>
      )}
      {sources && <SourcesChip sources={sources} className="self-start" />}
    </div>
  );
}

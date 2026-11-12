import { useState } from "react";
import { useM, useViewer } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { GroupView } from "./context";
import { AnonymousPostIcon, CloseGlyph } from "./icons";

const MAX_OPTIONS = 10;

/**
 * "Poll" from the group composer: a question plus options. Posts don't carry a
 * poll type yet, so the poll is published as text (question, then one line
 * per option) in the group.
 */
export function PollDialog({
  group,
  open,
  onOpenChange,
}: {
  group: GroupView;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const viewer = useViewer();
  const create = useM(api.posts.create);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length > 0 && filled.length >= 2;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setQuestion("");
      setOptions(["", ""]);
      setError(null);
    }
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await create({
        groupId: group._id,
        text: `${question.trim()}\n\n${filled.map((o) => `• ${o}`).join("\n")}`,
      });
      close(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={close} title="Create poll" width={500} className="rounded-xl">
      <div className="flex max-h-[calc(100vh-200px)] flex-col overflow-y-auto px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar src={viewer.avatar} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-[15px] text-primary leading-5">{viewer.name}</p>
            <span className="mt-1 inline-flex h-6 items-center rounded-md bg-btn px-2 font-semibold text-[13px] text-btn-text">
              {group.name}
            </span>
          </div>
        </div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          aria-label="Poll question"
          rows={2}
          // biome-ignore lint/a11y/noAutofocus: the poll dialog focuses its question
          autoFocus
          className="mt-3 w-full resize-none bg-transparent text-[24px] text-primary leading-7 outline-none placeholder:text-placeholder"
        />
        <div className="mt-2 flex flex-col gap-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) =>
                  setOptions((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                maxLength={80}
                className="h-10 min-w-0 flex-1 rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setOptions((xs) => xs.filter((_, j) => j !== i))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-icon hover:bg-hover"
                >
                  <CloseGlyph size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions((xs) => [...xs, ""])}
            className="mt-2 self-start rounded-md px-2 py-1.5 font-semibold text-[15px] text-link hover:bg-hover"
          >
            Add option
          </button>
        )}
        {error && <p className="mt-2 text-[13px] text-[#E41E3F]">{error}</p>}
      </div>
      <div className="p-4">
        <Button variant="primary" block disabled={!ready || busy} onClick={() => void submit()}>
          Post
        </Button>
      </div>
    </Modal>
  );
}

/**
 * "Anonymous post" from the group composer. Anonymous posting needs admin
 * approval and hidden authorship, which the backend doesn't support, so the
 * dialog says so plainly and offers a regular post instead.
 */
export function AnonymousDialog({
  group,
  open,
  onOpenChange,
  onWritePost,
}: {
  group: GroupView;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onWritePost: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Anonymous post"
      width={500}
      className="rounded-xl"
    >
      <div className="flex flex-col items-center px-6 pt-6 pb-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F3FF] dark:bg-[#263951]">
          <AnonymousPostIcon size={36} />
        </span>
        <p className="mt-4 font-bold text-[20px] text-primary leading-6">
          Anonymous posting isn't turned on
        </p>
        <p className="mt-2 text-[15px] text-secondary">
          The admins of {group.name} haven't allowed anonymous posts. You can still post in the
          group with your name.
        </p>
      </div>
      <div className="flex justify-end gap-2 p-4">
        <Button variant="link" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onOpenChange(false);
            onWritePost();
          }}
        >
          Write a post
        </Button>
      </div>
    </Modal>
  );
}

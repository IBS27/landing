import { CircleAlert, CircleCheck, Megaphone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "./overlays";
import { Button } from "./primitives";

/* ---------- Shared row ---------- */

/** Facebook's heavier chevron on dialog rows that lead to another step. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-icon-secondary"
      aria-hidden
    >
      <path d="M8.5 4 16.5 12l-8 8" />
    </svg>
  );
}

function StepRow({
  icon,
  label,
  sub,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
    >
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px] text-primary leading-5">{label}</span>
        {sub && <span className="block text-[13px] text-secondary leading-4">{sub}</span>}
      </span>
      <Chevron />
    </button>
  );
}

/* ---------- Report content (posts, messages) ---------- */

/** Facebook's reasons for reporting a post. */
export const POST_REPORT_REASONS = [
  "I just don't like it",
  "Bullying, harassment or abuse",
  "Suicide or self-injury",
  "Violent, hateful or disturbing content",
  "Selling or promoting restricted items",
  "Adult content",
  "Scam, fraud or false information",
  "Intellectual property",
];

/** Messenger's reasons for reporting a message. */
export const MESSAGE_REPORT_REASONS = [
  "Harassment",
  "Suicide or self-injury",
  "Pretending to be someone",
  "Sharing inappropriate things",
  "Hate speech",
  "Unauthorized sales",
  "Scam",
  "Something else",
];

export type ReportFollowUp = { icon: ReactNode; label: string; sub?: string; onClick: () => void };

/**
 * Facebook's report flow: pick a reason → review and Submit → "Thanks for
 * letting us know", with optional other steps (hide, block...).
 */
export function ReportDialog({
  noun,
  reasons,
  onSubmit,
  onClose,
  followUps = [],
}: {
  /** "post", "message"... used in the copy. */
  noun: string;
  reasons: string[];
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
  followUps?: ReportFollowUp[];
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [state, setState] = useState<"pick" | "review" | "sending" | "done" | "error">("pick");
  const submit = () => {
    if (!reason) return;
    setState("sending");
    onSubmit(reason).then(
      () => setState("done"),
      () => setState("error"),
    );
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Report"
      width={548}
      onBack={state === "review" || state === "error" ? () => setState("pick") : undefined}
    >
      {state === "done" ? (
        <div className="p-4">
          <div className="flex flex-col items-center px-2 pt-2 pb-4 text-center">
            <CircleCheck size={56} strokeWidth={1.6} className="text-[#31a24c]" />
            <p className="mt-3 font-bold text-[20px] text-primary leading-6">
              Thanks for letting us know
            </p>
            <p className="mt-1 text-[15px] text-secondary leading-5">
              We'll use this information to improve our processes. We won't let them know who
              reported this {noun}.
            </p>
          </div>
          {followUps.length > 0 && (
            <>
              <p className="px-2 pb-1 font-semibold text-[17px] text-primary">
                Other steps you can take
              </p>
              {followUps.map((f) => (
                <StepRow
                  key={f.label}
                  icon={f.icon}
                  label={f.label}
                  sub={f.sub}
                  onClick={() => {
                    f.onClick();
                    onClose();
                  }}
                />
              ))}
            </>
          )}
          <Button variant="primary" block className="mt-3" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : state === "pick" ? (
        <div className="p-2">
          <div className="px-2 pt-2 pb-2">
            <p className="font-semibold text-[17px] text-primary leading-5">
              Why are you reporting this {noun}?
            </p>
            <p className="mt-1 text-[13px] text-secondary leading-4">
              If someone is in immediate danger, get help before reporting to Facebook. Don't wait.
            </p>
          </div>
          {reasons.map((r) => (
            <StepRow
              key={r}
              label={r}
              onClick={() => {
                setReason(r);
                setState("review");
              }}
            />
          ))}
        </div>
      ) : (
        <div className="p-4">
          <p className="font-semibold text-[17px] text-primary leading-5">{reason}</p>
          <p className="mt-2 text-[15px] text-secondary leading-5">
            {state === "error"
              ? "Something went wrong and your report wasn't sent. Please try again."
              : `We'll review this ${noun} against our Community Standards. Your report is anonymous, except if you're reporting an intellectual property infringement.`}
          </p>
          <Button
            variant="primary"
            block
            className="mt-4"
            disabled={state === "sending"}
            onClick={submit}
          >
            Submit
          </Button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Report a problem (account menu, Ctrl+B, Reels) ---------- */

export function ReportProblemDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<"improve" | "broken" | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Report a problem"
      width={500}
      onBack={kind && !sent ? () => setKind(null) : undefined}
    >
      {sent ? (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <p className="font-bold text-[20px] text-primary">Thanks for your feedback</p>
          <p className="mt-1 text-[15px] text-secondary">
            We use reports like this to help improve Facebook.
          </p>
          <Button variant="primary" className="mt-5" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : kind === null ? (
        <div className="p-2">
          <StepRow
            icon={<Megaphone size={20} />}
            label="Help us improve Facebook"
            sub="Tell us how we can make Facebook better."
            onClick={() => setKind("improve")}
          />
          <StepRow
            icon={<CircleAlert size={20} />}
            label="Something went wrong"
            sub="Let us know about a broken feature."
            onClick={() => setKind("broken")}
          />
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) setSent(true);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "broken"
                ? "Briefly explain what happened or what's not working."
                : "Tell us what you'd like to see improved."
            }
            aria-label="Details"
            className="min-h-[120px] resize-none rounded-md border border-divider bg-card p-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
          />
          <Button type="submit" variant="primary" block disabled={!text.trim()}>
            Send
          </Button>
        </form>
      )}
    </Modal>
  );
}

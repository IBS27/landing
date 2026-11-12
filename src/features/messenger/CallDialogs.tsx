import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { type ReactNode, useId, useRef, useState } from "react";
import { useM } from "@/app/viewer";
import { Button, IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type CallMedia, type DeviceKind, useMediaDevices } from "./useCallMedia";

/** A dark dialog over the call (the call window always uses Facebook's dark theme). */
function CallDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[90] animate-[fade-in_.12s_ease-out] bg-black/60" />
        <D.Content
          ref={ref}
          aria-describedby={undefined}
          // Focus the dialog itself (no ring on the first control); Tab walks in.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            ref.current?.focus();
          }}
          className="dark fixed top-1/2 left-1/2 z-[91] flex max-h-[calc(100dvh-32px)] w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card text-primary shadow-elevated outline-none"
        >
          <div className="relative flex h-[60px] shrink-0 items-center justify-center border-divider border-b px-14">
            <D.Title className="truncate font-bold text-[20px] leading-6">{title}</D.Title>
            <D.Close asChild>
              <IconButton label="Close" size={36} className="absolute! right-3">
                <X size={20} strokeWidth={2.4} className="text-secondary" />
              </IconButton>
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

const canPickSpeaker =
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

const DEVICE_ROWS: { kind: DeviceKind; label: string; fallback: string; none: string }[] = [
  { kind: "audioinput", label: "Microphone", fallback: "Microphone", none: "No microphone found" },
  { kind: "audiooutput", label: "Speakers", fallback: "Speaker", none: "System default" },
  { kind: "videoinput", label: "Camera", fallback: "Camera", none: "No camera found" },
];

/** "…" → Settings: input and output devices for this call. */
export function CallSettingsDialog({
  open,
  onOpenChange,
  media,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  media: CallMedia;
}) {
  const devices = useMediaDevices(open);
  const inUse: Partial<Record<DeviceKind, string | undefined>> = {
    audioinput: media.audio?.getSettings().deviceId,
    videoinput: media.source === "camera" ? media.video?.getSettings().deviceId : undefined,
  };
  return (
    <CallDialog open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="flex flex-col gap-4 p-4">
        {DEVICE_ROWS.filter((r) => r.kind !== "audiooutput" || canPickSpeaker).map((row) => {
          const list = devices.filter((d) => d.kind === row.kind && d.deviceId);
          const value = inUse[row.kind] || media.prefs[row.kind] || list[0]?.deviceId || "";
          return (
            <DeviceSelect
              key={row.kind}
              label={row.label}
              value={list.some((d) => d.deviceId === value) ? value : (list[0]?.deviceId ?? "")}
              disabled={media.busy}
              options={list.map((d, i) => ({
                id: d.deviceId,
                label: d.label || `${row.fallback} ${i + 1}`,
              }))}
              empty={row.none}
              onChange={(id) => void media.setDevice(row.kind, id)}
            />
          );
        })}
        <p className="text-[13px] text-secondary leading-4">
          Changes apply right away and are remembered for your next call.
        </p>
      </div>
    </CallDialog>
  );
}

function DeviceSelect({
  label,
  value,
  options,
  empty,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  empty: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-[15px] leading-5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-md border border-divider bg-input px-3 text-[15px] text-primary outline-none focus-visible:border-fb disabled:cursor-default disabled:opacity-60"
      >
        {options.length === 0 ? (
          <option value="">{empty}</option>
        ) : (
          options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

const PROBLEMS = [
  "I couldn't hear the other person",
  "The other person couldn't hear me",
  "Video was frozen or blurry",
  "The call dropped",
  "Something else",
];

/** "…" → Report a problem: saved with the call so it can be looked into. */
export function ReportCallDialog({
  open,
  onOpenChange,
  callId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  callId: Id<"calls">;
}) {
  const report = useM(api.calls.reportProblem);
  const [choice, setChoice] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const reset = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setChoice(null);
      setDetails("");
      setState("idle");
    }
  };
  const send = () => {
    if (!choice) return;
    setState("sending");
    const reason = details.trim() ? `${choice}: ${details.trim()}` : choice;
    report({ callId, reason })
      .then(() => setState("sent"))
      .catch(() => setState("error"));
  };
  return (
    <CallDialog open={open} onOpenChange={reset} title="Report a problem">
      {state === "sent" ? (
        <div className="p-4">
          <p className="font-semibold text-[17px] leading-[22px]">Thanks for letting us know</p>
          <p className="mt-1 text-[15px] text-secondary leading-5">
            Your report helps us make calls better.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => reset(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-[15px] text-secondary leading-5">What went wrong with this call?</p>
          <fieldset className="mt-2 flex flex-col">
            <legend className="sr-only">Problem</legend>
            {PROBLEMS.map((p) => (
              <label
                key={p}
                className="-mx-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-[15px] hover:bg-hover"
              >
                {p}
                <input
                  type="radio"
                  name="call-problem"
                  value={p}
                  checked={choice === p}
                  onChange={() => setChoice(p)}
                  className="h-5 w-5 shrink-0 accent-[#0866ff]"
                />
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={800}
            rows={3}
            placeholder="Add details (optional)"
            aria-label="Details"
            className="mt-3 w-full resize-none rounded-md border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none placeholder:text-secondary focus-visible:border-fb"
          />
          {state === "error" && (
            <p className="mt-2 text-[13px] text-negative">Couldn't send your report. Try again.</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" className="text-link!" onClick={() => reset(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="min-w-[72px]"
              disabled={!choice || state === "sending"}
              onClick={send}
            >
              {state === "sending" ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </CallDialog>
  );
}

import type { FunctionReturnType } from "convex/server";
import { Dialog as D } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { ModalScrim } from "@/ui/overlays";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RINGTONE, useTone } from "./callTones";
import { PhoneIcon, VideoCallIcon } from "./icons";

type Incoming = FunctionReturnType<typeof api.calls.incoming>[number];

/**
 * Facebook's incoming-call dialog: centred over the page veil, with the
 * caller's avatar pulsing, Decline and Accept. Escape declines. When several
 * calls ring at once the newest is shown; the rest wait behind it.
 */
export function IncomingCalls({ onAnswer }: { onAnswer: (callId: Id<"calls">) => void }) {
  const calls = useQ(api.calls.incoming, {});
  // Hide a call the moment it's answered or declined, before the query catches up.
  const [handled, setHandled] = useState<string[]>([]);
  const ringing = (calls ?? []).filter((c) => !handled.includes(c._id));
  const call = ringing.at(-1);
  useTone(RINGTONE, !!call);
  const decline = useM(api.calls.decline);
  const accept = useM(api.calls.accept);
  if (!call) return null;

  const done = (id: string) => setHandled((h) => [...h.filter((x) => x !== id), id]);
  const onDecline = () => {
    done(call._id);
    void decline({ callId: call._id }).catch(() => {});
  };
  const onAccept = () => {
    done(call._id);
    // Open the call window inside the click so it isn't blocked, then join.
    onAnswer(call._id);
    void accept({ callId: call._id }).catch(() => {});
  };

  return (
    <D.Root open onOpenChange={(o) => !o && onDecline()}>
      <D.Portal>
        <ModalScrim />
        <IncomingCallDialog key={call._id} call={call} onDecline={onDecline} onAccept={onAccept} />
      </D.Portal>
    </D.Root>
  );
}

function IncomingCallDialog({
  call,
  onDecline,
  onAccept,
}: {
  call: Incoming;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const video = call.kind === "video";
  const kindLabel = video ? "video call" : "audio call";
  return (
    <D.Content
      ref={ref}
      role="alertdialog"
      aria-label={`Incoming ${kindLabel} from ${call.caller.name}`}
      // A click on the page behind doesn't dismiss a ringing call; Escape declines it.
      onPointerDownOutside={(e) => e.preventDefault()}
      // Focus the dialog itself so no ring shows on Decline; Tab walks into the buttons.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        ref.current?.focus();
      }}
      onInteractOutside={(e) => e.preventDefault()}
      className="fixed top-1/2 left-1/2 z-[61] flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-[fade-in_.15s_ease-out] flex-col items-center rounded-lg bg-card px-6 pt-8 pb-6 text-center shadow-elevated outline-none"
    >
      {call.groupName && (
        <p className="mb-4 font-semibold text-[13px] text-secondary leading-4">
          Group {kindLabel} · {call.groupName}
        </p>
      )}
      <div className="relative h-24 w-24">
        <span className="absolute inset-0 animate-ping rounded-full bg-fb/25 [animation-duration:1.6s]" />
        <span className="absolute -inset-2.5 animate-ping rounded-full bg-fb/10 [animation-delay:.4s] [animation-duration:1.6s]" />
        <Avatar src={call.caller.avatar} size={96} className="relative" />
      </div>
      <D.Title className="mt-5 font-bold text-[20px] text-primary leading-6">
        {call.caller.name} is calling you
      </D.Title>
      <D.Description className="mt-1.5 text-[15px] text-secondary leading-5">
        The call will start as soon as you accept.
      </D.Description>
      <div className="mt-7 flex justify-center gap-14">
        <RoundButton label="Decline" className="bg-[#e41e3f]" onClick={onDecline}>
          <PhoneIcon size={24} className="rotate-[135deg]" />
        </RoundButton>
        <RoundButton label="Accept" className="bg-[#31a24c]" onClick={onAccept}>
          {video ? <VideoCallIcon size={24} /> : <PhoneIcon size={22} />}
        </RoundButton>
      </div>
    </D.Content>
  );
}

function RoundButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-fb focus-visible:outline-offset-2 active:scale-95",
          className,
        )}
      >
        {children}
      </button>
      <span className="font-semibold text-[13px] text-primary leading-4" aria-hidden>
        {label}
      </span>
    </div>
  );
}

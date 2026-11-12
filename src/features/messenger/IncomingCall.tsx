import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Avatar } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RINGTONE, useTone } from "./callTones";
import { PhoneIcon, VideoCallIcon } from "./icons";

type Incoming = FunctionReturnType<typeof api.calls.incoming>[number];

/** Bottom-right cards for calls ringing for the viewer, newest on top. */
export function IncomingCalls({ onAnswer }: { onAnswer: (callId: Id<"calls">) => void }) {
  const calls = useQ(api.calls.incoming, {});
  useTone(RINGTONE, !!calls?.length);
  if (!calls?.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-[75] flex flex-col-reverse gap-3">
      {calls.map((c) => (
        <IncomingCallCard key={c._id} call={c} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function IncomingCallCard({
  call,
  onAnswer,
}: {
  call: Incoming;
  onAnswer: (callId: Id<"calls">) => void;
}) {
  const decline = useM(api.calls.decline);
  const accept = useM(api.calls.accept);
  const video = call.kind === "video";
  const kindLabel = video ? "video call" : "audio call";
  return (
    <section
      role="alertdialog"
      aria-label={`Incoming ${kindLabel} from ${call.caller.name}`}
      className="w-[328px] animate-[fade-in_.2s_ease-out] rounded-lg bg-card p-4 text-center shadow-[0_12px_28px_0_var(--shadow-2),0_2px_4px_0_var(--shadow-2)] dark:shadow-[0_12px_28px_0_var(--shadow-2),0_2px_4px_0_var(--shadow-2),0_0_0_1px_var(--divider)]"
    >
      <p className="text-[13px] text-secondary leading-4">
        {call.groupName ? `Group ${kindLabel} · ${call.groupName}` : `Incoming ${kindLabel}`}
      </p>
      <div className="relative mx-auto mt-5 h-[72px] w-[72px]">
        <span className="absolute inset-0 animate-ping rounded-full bg-fb/30 [animation-duration:1.6s]" />
        <span className="absolute -inset-2 animate-ping rounded-full bg-fb/15 [animation-delay:.4s] [animation-duration:1.6s]" />
        <Avatar src={call.caller.avatar} size={72} className="relative" />
      </div>
      <h2 className="mt-4 font-bold text-[17px] text-primary leading-[22px]">
        {call.caller.name} is calling you…
      </h2>
      <div className="mt-4 flex justify-center gap-10">
        <CardButton
          label="Decline"
          className="bg-[#e41e3f]"
          onClick={() => void decline({ callId: call._id }).catch(() => {})}
        >
          <PhoneIcon size={22} className="rotate-[135deg]" />
        </CardButton>
        <CardButton
          label="Accept"
          className="bg-[#31a24c]"
          onClick={() => {
            // Open the window inside the click so it isn't blocked, then join.
            onAnswer(call._id);
            void accept({ callId: call._id }).catch(() => {});
          }}
        >
          {video ? <VideoCallIcon size={22} /> : <PhoneIcon size={20} />}
        </CardButton>
      </div>
    </section>
  );
}

function CardButton({
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
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-fb focus-visible:outline-offset-2",
          className,
        )}
      >
        {children}
      </button>
      <span className="font-semibold text-[13px] text-primary">{label}</span>
    </div>
  );
}

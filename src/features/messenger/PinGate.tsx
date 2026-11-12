import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/**
 * Messenger's end-to-end encryption gate. Until a persona creates a PIN (or
 * dismisses the prompt), the Messenger dropdown shows "Create a PIN" in place
 * of the chat list and /messages opens it as a dialog.
 */
export function usePinPrompt() {
  return useQ(api.messenger.pinStatus, {})?.prompt ?? false;
}

/** The "***_" pill Facebook draws above the PIN copy. */
function PinIllustration() {
  return (
    <span className="flex h-[123px] w-[240px] items-center justify-center" aria-hidden>
      <svg viewBox="0 0 118 61" width="118" height="61">
        <rect
          x="2.5"
          y="3.5"
          width="115"
          height="57"
          rx="28.5"
          className="fill-[#95C3F8] dark:fill-[#2B5C99]"
        />
        <rect
          x="0.5"
          y="0.5"
          width="115"
          height="57"
          rx="28.5"
          className="fill-[#CCE5FF] dark:fill-[#1D3B61]"
        />
        <g
          className="stroke-[#0A7CFF] dark:stroke-[#4BA0FF]"
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
        >
          {[25, 48, 71].map((cx) => (
            <g key={cx} transform={`translate(${cx} 26.5)`}>
              <path d="M0 -8.5V8.5M-7.4 -4.25L7.4 4.25M-7.4 4.25L7.4 -4.25" />
            </g>
          ))}
          <path d="M85 36.5H98" />
        </g>
      </svg>
    </span>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M10 1.5a4.75 4.75 0 0 0-4.75 4.75V8.5h-.5A1.75 1.75 0 0 0 3 10.25v6.5c0 .97.78 1.75 1.75 1.75h10.5c.97 0 1.75-.78 1.75-1.75v-6.5c0-.97-.78-1.75-1.75-1.75h-.5V6.25A4.75 4.75 0 0 0 10 1.5Zm2.75 7h-5.5V6.25a2.75 2.75 0 0 1 5.5 0V8.5Z" />
    </svg>
  );
}

function AsteriskGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path
        d="M10 2.5v15M3.5 6.25l13 7.5M3.5 13.75l13-7.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 pl-2 text-primary">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <p className="font-medium text-[15px] leading-5">{children}</p>
    </div>
  );
}

/** Illustration, title, the two encryption notes and "Create PIN". */
function PinIntro({ variant, onCreate }: { variant: "panel" | "dialog"; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <PinIllustration />
      <h2
        className={cn(
          "text-center font-bold text-[20px] text-primary leading-6",
          variant === "panel" ? "mt-5 px-8" : "mt-3 px-4",
        )}
      >
        Create a PIN to access your chats on any device
      </h2>
      <div
        className={cn(
          "flex w-full flex-col gap-[15px]",
          variant === "panel" ? "mt-[35px] pr-[13px]" : "mt-[15px]",
        )}
      >
        <Row icon={<LockGlyph />}>
          Personal chats are secured with end-to-end encryption, so only the people in them can
          read, listen to, or share messages.
        </Row>
        <Row icon={<AsteriskGlyph />}>
          You’ll need a PIN to access these chats if you use another browser or device.
        </Row>
      </div>
      <Button
        variant="primary"
        block
        onClick={onCreate}
        className={cn(
          "rounded-lg focus-visible:shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--fb-blue)] focus-visible:outline-none",
          variant === "panel" ? "mt-10" : "mt-[31px]",
        )}
      >
        Create PIN
      </Button>
    </div>
  );
}

const LENGTH = 6;

/** Six PIN boxes driven by one numeric input (typing, paste and backspace all work). */
function PinBoxes({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <label className="relative flex cursor-text justify-center gap-2">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="off"
        maxLength={LENGTH}
        aria-label="PIN"
        aria-invalid={error || undefined}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      {Array.from({ length: LENGTH }, (_, i) => {
        const filled = i < value.length;
        const current = focused && i === Math.min(value.length, LENGTH - 1);
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "flex h-14 w-11 items-center justify-center rounded-lg border bg-input transition-colors",
              error
                ? "border-negative"
                : current
                  ? "border-fb shadow-[0_0_0_1px_var(--fb-blue)]"
                  : "border-transparent",
            )}
          >
            {filled && <span className="h-3 w-3 rounded-full bg-primary" />}
          </span>
        );
      })}
    </label>
  );
}

/** "Create a PIN" → "Confirm your PIN"; saves the hashed PIN on a match. */
function PinEntry({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const createPin = useM(api.messenger.createPin);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setValue("");
      return;
    }
    if (pin !== first) {
      setError("PINs don't match. Try again.");
      setValue("");
      return;
    }
    setSaving(true);
    try {
      await createPin({ pin });
      onDone();
    } catch {
      setSaving(false);
      setError("Something went wrong. Try again.");
      setValue("");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="relative flex h-9 items-center justify-center">
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            setError(null);
            setValue("");
            if (first === null) onBack();
            else setFirst(null);
          }}
          className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <h2 className="font-bold text-[20px] text-primary leading-6">
          {first === null ? "Create a PIN" : "Confirm your PIN"}
        </h2>
      </div>
      <p className="mt-4 px-2 text-center text-[15px] text-secondary leading-5">
        {first === null
          ? "Your PIN must be 6 digits. You’ll need it to access your end-to-end encrypted chats if you use another browser or device."
          : "Enter your PIN again to confirm it."}
      </p>
      <div className="mt-6">
        <PinBoxes
          key={first === null ? "create" : "confirm"}
          value={value}
          error={!!error && value.length === 0}
          onChange={(v) => {
            setError(null);
            setValue(v);
            if (v.length === LENGTH) void submit(v);
          }}
        />
      </div>
      <p
        role={error ? "alert" : undefined}
        className="mt-3 h-4 text-center text-[13px] text-negative leading-4"
      >
        {error}
      </p>
      <div className="mt-4 flex h-9 items-center justify-center">
        {saving && <Spinner size={20} />}
      </div>
    </div>
  );
}

/** Full-height gate that replaces the Chats panel in the header dropdown. */
export function PinGatePanel() {
  const [step, setStep] = useState<"intro" | "entry">("intro");
  return (
    <div className="flex h-[calc(100vh-72px)] max-h-[828px] flex-col justify-center px-4 pb-2.5">
      {step === "intro" ? (
        <PinIntro variant="panel" onCreate={() => setStep("entry")} />
      ) : (
        <PinEntry onBack={() => setStep("intro")} onDone={() => {}} />
      )}
    </div>
  );
}

/** First visit to /messages: the PIN dialog. Escape or clicking outside means "Not now". */
export function PinDialog() {
  const prompt = usePinPrompt();
  const dismiss = useM(api.messenger.dismissPinPrompt);
  const [step, setStep] = useState<"intro" | "entry">("intro");
  const [closed, setClosed] = useState(false);
  return (
    <Modal
      open={prompt && !closed}
      onOpenChange={(o) => {
        if (o) return;
        setClosed(true);
        void dismiss({}).catch(() => setClosed(false));
      }}
      title="Create a PIN to access your chats on any device"
      hideHeader
      width={548}
      className="min-h-[400px] rounded-xl"
      bodyClassName={cn(
        "flex flex-col justify-center px-4 pb-4",
        step === "intro" ? "pt-12" : "pt-4",
      )}
    >
      {step === "intro" ? (
        <PinIntro variant="dialog" onCreate={() => setStep("entry")} />
      ) : (
        <div className="pb-2">
          <PinEntry onBack={() => setStep("intro")} onDone={() => setClosed(true)} />
        </div>
      )}
    </Modal>
  );
}

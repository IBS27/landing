import { type ReactNode, useState } from "react";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";

/**
 * A button that asks before it deletes or resets something, with the
 * consequences spelled out. `onConfirm` runs the mutation; a failure stays in
 * the dialog with a retry.
 */
export function ConfirmAction({
  label,
  icon,
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="sm"
        icon={icon}
        disabled={disabled}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onOpenChange={(o) => !busy && setOpen(o)} title={title}>
        <div className="px-4 pt-3 pb-4">
          <div className="text-[15px] text-primary leading-5">{body}</div>
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-negative">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={run}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

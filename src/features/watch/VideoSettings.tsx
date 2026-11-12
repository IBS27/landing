import { type Option, RadioList, usePref } from "@/features/misc/settings/controls";
import { Modal } from "@/ui/overlays";

const AUTOPLAY: Option<string>[] = [
  { value: "Default", label: "Default", sub: "Videos autoplay muted as you scroll." },
  { value: "On", label: "On", sub: "Always autoplay videos." },
  { value: "Off", label: "Off", sub: "Never autoplay videos. Tap play to start one." },
];

const QUALITY: Option<string>[] = [
  { value: "Default", label: "Default", sub: "Adjusts to your connection." },
  { value: "SD only", label: "SD only", sub: "Uses less data." },
  { value: "HD if available", label: "HD if available", sub: "Plays in the highest quality." },
];

/**
 * The Video rail's gear: Autoplay and default quality. Both are the same
 * persisted choices as Settings → Media, and every video player follows them.
 */
export function VideoSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [autoplay, setAutoplay] = usePref("autoplay");
  const [quality, setQuality] = usePref("video-quality");
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Video settings" width={500}>
      <div className="px-2 pt-2 pb-3">
        <h3 className="px-2 pt-1 pb-1 font-semibold text-[17px] text-primary leading-5">
          Autoplay
        </h3>
        <RadioList name="Autoplay" options={AUTOPLAY} value={autoplay} onChange={setAutoplay} />
        <div className="mx-2 my-2 h-px bg-divider" />
        <h3 className="px-2 pt-1 pb-1 font-semibold text-[17px] text-primary leading-5">
          Video default quality
        </h3>
        <RadioList
          name="Video default quality"
          options={QUALITY}
          value={quality}
          onChange={setQuality}
        />
      </div>
    </Modal>
  );
}

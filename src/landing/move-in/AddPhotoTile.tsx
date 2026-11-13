import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/format";
import { Spinner } from "@/ui/primitives";

/**
 * A dashed "add photos" tile. Its file input is visually hidden rather than
 * `display: none`, so it stays reachable by keyboard and shows a focus ring.
 */
export function AddPhotoTile({
  label,
  busy,
  multiple = true,
  onFiles,
  className,
}: {
  label: string;
  busy?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-divider border-dashed text-secondary focus-within:ring-2 focus-within:ring-fb hover:bg-hover",
        className,
      )}
    >
      {busy ? <Spinner size={18} /> : <ImagePlus size={20} aria-hidden />}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        aria-label={label}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

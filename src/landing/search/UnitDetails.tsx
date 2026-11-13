import { Eye, Volume1, Volume2, VolumeX } from "lucide-react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const VIEW_LABEL = { sunrise: "Sunrise", sunset: "Sunset", ocean: "Ocean" } as const;

const NOISE = {
  high: {
    label: "High",
    Icon: Volume2,
    tone: "bg-[#FFE8EC] text-[#C2163A] dark:bg-[#E41E3F]/20 dark:text-[#FF6B81]",
  },
  medium: {
    label: "Medium",
    Icon: Volume1,
    tone: "bg-[#FFF4D6] text-[#8A6100] dark:bg-[#F7B928]/20 dark:text-[#F7B928]",
  },
  low: {
    label: "Low",
    Icon: VolumeX,
    tone: "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]",
  },
} as const;

/** "Unit details" (#13): the unit's view and its noise risk from nearby campuses and nightlife, cited. */
export function UnitDetails({ listingId }: { listingId: Id<"listings"> }) {
  const d = useQ(api.listings.unitDetails, { listingId });
  if (!d) return null;
  const noise = d.noise ? NOISE[d.noise.level] : null;
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[17px] text-primary leading-5">Unit details</h2>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
          <Eye size={18} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="font-semibold text-[15px] text-primary leading-5">View</div>
          <p className="text-[13px] text-secondary leading-[18px]">
            {d.views.length > 0
              ? d.views.map((v) => VIEW_LABEL[v]).join(", ")
              : "The lister didn't say"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            noise ? noise.tone : "bg-btn text-icon",
          )}
        >
          {noise ? <noise.Icon size={18} aria-hidden /> : <Volume1 size={18} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="font-semibold text-[15px] text-primary leading-5">
            Noise risk{noise ? `: ${noise.label}` : ""}
          </div>
          {d.noise ? (
            <ul className="mt-0.5 flex flex-col gap-1">
              {d.noise.reasons.map((r) => (
                <li
                  key={r.text}
                  className="flex flex-wrap items-center gap-1.5 text-[13px] text-secondary leading-[18px]"
                >
                  <span>{r.text}</span>
                  {r.sources && <SourcesChip sources={r.sources} label="Source" />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-secondary leading-[18px]">
              No campus or nightlife data for this area yet
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

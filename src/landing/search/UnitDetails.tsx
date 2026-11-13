import { Eye, Sunrise, Sunset, Volume1, Volume2, VolumeX, Waves } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type ViewKind, viewStory } from "./viewStory";

const VIEW_LABEL = { sunrise: "Sunrise", sunset: "Sunset", ocean: "Ocean" } as const;
const VIEW_ICON = { sunrise: Sunrise, sunset: Sunset, ocean: Waves } as const;

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
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="font-semibold text-[15px] text-primary leading-5">View</div>
          <p className="text-[13px] text-secondary leading-[18px]">
            {d.views.length > 0
              ? d.views.map((v) => VIEW_LABEL[v]).join(", ")
              : "The lister didn't say"}
          </p>
        </div>
      </div>
      {d.point &&
        d.views.map((v) => (
          <ViewDetails key={v} kind={v} point={d.point as NonNullable<typeof d.point>} />
        ))}
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

/** One view through the year: sun times and directions for this exact spot, and what each season is like. */
function ViewDetails({
  kind,
  point,
}: {
  kind: ViewKind;
  point: { lat: number; lng: number; neighborhood: string | null };
}) {
  const [open, setOpen] = useState(false);
  const s = viewStory(kind, point);
  const Icon = VIEW_ICON[kind];
  return (
    <div className="mt-2 ml-12 rounded-lg bg-wash p-3 dark:bg-hover">
      <div className="flex items-center gap-1.5 font-semibold text-[13px] text-primary">
        <Icon size={15} className="text-[#D4A137]" aria-hidden />
        {s.title}
      </div>
      <p className="mt-1 text-[13px] text-secondary leading-[18px]">{s.lead}</p>

      <table className="mt-2 w-full text-left text-[12px] leading-4">
        <thead className="text-secondary">
          <tr>
            <th className="pb-1 font-semibold">Day</th>
            <th className="pb-1 font-semibold">{kind === "sunrise" ? "Sunrise" : "Sunset"}</th>
            <th className="pb-1 font-semibold">Golden hour</th>
          </tr>
        </thead>
        <tbody className="text-primary">
          {s.rows.map((r) => (
            <tr key={r.id} className="border-divider border-t">
              <td className="py-1 pr-2">{r.label.replace(/ \(.*\)/, "")}</td>
              <td className="py-1 pr-2">
                <div className="font-semibold">{r.time}</div>
                <div className="text-secondary">{r.direction}</div>
              </td>
              <td className="py-1">{r.goldenHour}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {open ? (
        <>
          <div className="mt-2 flex flex-col gap-1.5">
            {s.seasons.map((x) => (
              <p key={x.label} className="text-[13px] text-primary leading-[18px]">
                <span className="font-semibold">{x.label}: </span>
                {x.text}
              </p>
            ))}
          </div>
          <div className="mt-2 font-semibold text-[12px] text-secondary uppercase tracking-wide">
            Good to know
          </div>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {s.facts.map((f) => (
              <li key={f} className="text-[13px] text-primary leading-[18px]">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-secondary leading-4">
            Sun times are calculated for this listing's location with NOAA's solar equations.
            Weather notes describe typical San Francisco seasons, not a forecast.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 font-semibold text-[13px] text-link hover:underline"
          >
            Show less
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 font-semibold text-[13px] text-link hover:underline"
        >
          What it's like through the year
        </button>
      )}
    </div>
  );
}

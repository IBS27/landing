import { Link } from "@tanstack/react-router";
import { BadgeCheck, CircleAlert, CircleCheck } from "lucide-react";
import { useQ } from "@/app/viewer";
import { cn, price } from "@/lib/format";
import { SourcesChip } from "@/ui/Citations";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/**
 * Rentals ranked by fit with the viewer's City Profile (#10): budget, transit
 * and interests. Each result shows the reasons behind its rank, with sources.
 */
export function RentalResults() {
  const data = useQ(api.rentals.search, {});
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-bold text-[17px] text-primary leading-5">Rentals for you</h2>
        <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
          Ranked by your budget, transit and interests from your City Profile.
        </p>
      </div>
      {data === undefined ? (
        <div className="p-4">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {data.needsBrief && (
            <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg bg-wash p-3 dark:bg-hover">
              <p className="text-[13px] text-primary leading-[18px]">
                Finish your brief to rank rentals by your budget, transit and interests. Until then,
                these are the newest.
              </p>
              <Link to="/landing/welcome">
                <Button variant="primary" size="sm">
                  Finish your brief
                </Button>
              </Link>
            </div>
          )}
          <ul className="divide-y divide-divider">
            {data.results.map((r) => (
              <li key={r._id}>
                <div className="flex gap-3 px-4 py-3">
                  {r.photo ? (
                    <img
                      src={r.photo}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-md bg-wash" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/landing/find/listing/$listingId"
                        params={{ listingId: r._id }}
                        className="truncate font-semibold text-[15px] text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.verified && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E3F5E5] px-2 py-0.5 font-semibold text-[#24832C] text-[12px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
                          <BadgeCheck size={13} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-secondary">
                      {price(r.price)}/mo
                      {r.listingType === "sublet" ? " · Sublet" : ""}
                      {r.neighborhood ? ` · ${r.neighborhood}` : ""}
                    </div>
                    {r.reasons.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.reasons.map((x) => (
                          <li
                            key={x.kind}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[12px]",
                              x.tone === "good"
                                ? "bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]"
                                : "bg-[#FFF4D6] text-[#8A6100] dark:bg-[#F7B928]/20 dark:text-[#F7B928]",
                              !x.sources && "pr-2",
                            )}
                          >
                            {x.tone === "good" ? (
                              <CircleCheck size={12} aria-hidden />
                            ) : (
                              <CircleAlert size={12} aria-hidden />
                            )}
                            <span className="font-semibold">{x.text}</span>
                            {x.sources && <SourcesChip sources={x.sources} label="Source" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

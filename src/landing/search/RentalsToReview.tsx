import { Link } from "@tanstack/react-router";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { useQ } from "@/app/viewer";
import { price } from "@/lib/format";
import { Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

/**
 * Stand-in list of rentals on Find, linking to each one's Landing view with
 * its verified levels and things to check. Apartment search (#10) replaces it.
 */
export function RentalsToReview() {
  const rows = useQ(api.trust.rentalsToReview, {});
  return (
    <Card className="mb-4 overflow-hidden">
      <h2 className="px-4 pt-4 pb-2 font-bold text-[17px] text-primary leading-5">Rentals</h2>
      {rows === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-divider">
          {rows.map((r) => (
            <li key={r._id}>
              <Link
                to="/landing/find/listing/$listingId"
                params={{ listingId: r._id }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover"
              >
                {r.photo ? (
                  <img
                    src={r.photo}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-md bg-wash" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[15px] text-primary">{r.title}</div>
                  <div className="text-[13px] text-secondary">
                    {price(r.price)}/mo{r.neighborhood ? ` · ${r.neighborhood}` : ""}
                  </div>
                </div>
                {r.verified && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E3F5E5] px-2 py-0.5 font-semibold text-[#24832C] text-[12px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
                    <BadgeCheck size={13} /> Verified
                  </span>
                )}
                {r.signals > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF4D6] px-2 py-0.5 font-semibold text-[#8A6100] text-[12px] dark:bg-[#F7B928]/20 dark:text-[#F7B928]">
                    <TriangleAlert size={13} /> {r.signals} to check
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

import type { FunctionReturnType } from "convex/server";
import { Check, PenLine } from "lucide-react";
import { cn, price } from "@/lib/format";
import { Skeleton } from "@/ui/primitives";
import type { api } from "../../../../convex/_generated/api";

export type PickerItem = FunctionReturnType<typeof api.unitItems.picker>["entries"][number];

const GROUPS: { id: PickerItem["group"]; label: string }[] = [
  { id: "yours", label: "Yours" },
  { id: "marketplace", label: "From Marketplace" },
  { id: "matches", label: "Matches for this room" },
  { id: "saved", label: "Saved" },
];
const SALE: Record<NonNullable<PickerItem["sale"]>, string> = {
  active: "Listed for sale",
  pending: "Sale pending",
  sold: "Sold",
};

export function Chip({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 font-semibold text-[12px]",
        tone === "accent" ? "bg-btn-soft text-btn-soft-text" : "bg-btn text-secondary",
      )}
    >
      {tone === "accent" && <Check size={11} strokeWidth={3} aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Choose what to place (#131): the owner's items first, then the room's vibe
 * matches and saved listings, or a custom item. `value` is an entry key or "".
 */
export function ItemPicker({
  items,
  value,
  placed,
  onChange,
}: {
  items: PickerItem[] | undefined;
  value: string;
  /** Keys of entries already placed in this unit. */
  placed: Set<string>;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Item to place"
      className="max-h-[340px] overflow-y-auto rounded-lg border border-divider"
    >
      <Row selected={value === ""} onSelect={() => onChange("")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-wash text-secondary">
          <PenLine size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px] text-primary">Custom item</div>
          <div className="text-[13px] text-secondary">Name it and enter its size yourself</div>
        </div>
      </Row>
      {items === undefined ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        GROUPS.map((g) => {
          const rows = items.filter((i) => i.group === g.id);
          if (!rows.length) return null;
          return (
            <div key={g.id} role="group" aria-label={g.label}>
              <div className="sticky top-0 border-divider border-t bg-card px-3 pt-2.5 pb-1 font-semibold text-[13px] text-secondary">
                {g.label}
              </div>
              {rows.map((i) => (
                <Row key={i.key} selected={value === i.key} onSelect={() => onChange(i.key)}>
                  {i.photo ? (
                    <img
                      src={i.photo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-md bg-wash" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[15px] text-primary">{i.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-secondary">
                      <span>
                        {i.group === "yours" ? "Paid " : ""}
                        {i.price === 0 ? "Free" : price(i.price)}
                      </span>
                      {i.sale && <Chip>{SALE[i.sale]}</Chip>}
                      {(placed.has(i.key) ||
                        (i.fromListingId && placed.has(`listing:${i.fromListingId}`))) && (
                        <Chip tone="accent">In this room</Chip>
                      )}
                    </div>
                  </div>
                </Row>
              ))}
            </div>
          );
        })
      )}
      {items !== undefined && items.length === 0 && (
        <p className="border-divider border-t px-3 py-2.5 text-[13px] text-secondary">
          Items you own, your room's matches and saved Marketplace listings show up here.
        </p>
      )}
    </div>
  );
}

function Row({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors focus-visible:bg-hover",
        selected ? "bg-btn-soft shadow-[inset_3px_0_0_var(--fb-blue)]" : "hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

import { Link } from "@tanstack/react-router";
import { Sparkles, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { toListing } from "@/landing/links";
import { cn, price } from "@/lib/format";
import { Button, Card, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ITEM_CATEGORIES, NEIGHBORHOODS } from "../../../convex/lib/listings";
import type { ListingCategory } from "../../../convex/validators";

const field =
  "w-full rounded-lg border border-divider bg-input px-3 py-2 text-[15px] text-primary outline-none focus:border-fb";

/**
 * "Sell your stuff" (#43): pick items from the inventory (#27) and Landing
 * creates the Marketplace listings, pre-filled with each item's photos and price.
 */
export function SellItems() {
  const items = useQ(api.inventory.mine, {});
  const [picked, setPicked] = useState<Set<Id<"ownedItems">>>(new Set());
  const [reviewing, setReviewing] = useState(false);

  const toggle = (id: Id<"ownedItems">) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-[240px] flex-1">
          <h2 className="font-bold text-[17px] text-primary leading-5">Sell your stuff</h2>
          <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">
            Pick what you're not taking. Landing creates the Marketplace listings with your photos
            and what you paid, and you can change anything first.
          </p>
        </div>
        {!reviewing && (
          <Button
            variant="primary"
            size="sm"
            disabled={picked.size === 0}
            onClick={() => setReviewing(true)}
          >
            Review listings{picked.size > 0 ? ` (${picked.size})` : ""}
          </Button>
        )}
      </div>
      {reviewing && (
        <ReviewListings
          itemIds={[...picked]}
          onDone={(created) => {
            setReviewing(false);
            if (created) setPicked(new Set());
          }}
        />
      )}
      {items === undefined ? (
        <div className="p-4">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-secondary">
          Nothing to sell yet. Items you add in My Place → Your stuff show up here.
        </p>
      ) : (
        <ul className="divide-y divide-divider border-divider border-t">
          {items.map((it) => {
            const listed = it.saleListingId;
            const disabled = !!listed || reviewing || it.photos.length === 0;
            return (
              <li key={it._id}>
                <label
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    !disabled && "cursor-pointer hover:bg-hover",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-[var(--accent)]"
                    disabled={disabled}
                    checked={picked.has(it._id)}
                    onChange={() => toggle(it._id)}
                    aria-label={`Sell ${it.title}`}
                  />
                  {it.photos[0] ? (
                    <img
                      src={it.photos[0]}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-md bg-wash" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[15px] text-primary">
                      {it.title}
                    </div>
                    <div className="text-[13px] text-secondary leading-[18px]">
                      Paid {it.price === 0 ? "nothing" : price(it.price)}
                      {it.photos.length === 0 ? " · No photo, so it can't be listed" : ""}
                    </div>
                  </div>
                  {listed && (
                    <Link
                      {...toListing(listed)}
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-[13px] text-link hover:underline"
                    >
                      <Store size={13} aria-hidden /> Listed
                    </Link>
                  )}
                </label>
                {listed && <MuseTerms item={it} />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type Item = NonNullable<ReturnType<typeof useQ<typeof api.inventory.mine>>>[number];

/** For a listed item: whether Muse replies to buyers, and its lowest price (#44). */
function MuseTerms({ item }: { item: Item }) {
  const setTerms = useM(api.moveOutSales.setTerms);
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(item.saleMinPrice ? String(item.saleMinPrice) : "");
  const [error, setError] = useState<string | null>(null);
  const on = item.saleMuse === "active";

  const save = async () => {
    setError(null);
    try {
      await setTerms({ itemId: item._id, minPrice: Number(min) });
      setEditing(false);
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setError(typeof data === "string" ? data : "Couldn't save. Try again.");
    }
  };

  return (
    <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pr-4 pb-2 pl-[104px] text-[13px] max-sm:pl-4">
      <Sparkles size={12} className="shrink-0 text-[#8A3FFC]" aria-hidden />
      {item.saleMinPrice !== null ? (
        <span className="text-secondary">
          {on ? "Muse replies to buyers" : "Muse paused"} · lowest{" "}
          <b className="text-primary">{price(item.saleMinPrice)}</b>
        </span>
      ) : (
        <span className="text-secondary">
          Set a lowest price and Muse drafts your replies to buyers
        </span>
      )}
      {editing ? (
        <>
          <input
            aria-label="Lowest price"
            type="number"
            min={1}
            className="h-8 w-24 rounded-lg border border-divider bg-input px-2 text-[13px] text-primary outline-none focus:border-fb"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={save} disabled={!min.trim()}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {item.saleMinPrice !== null ? "Edit lowest" : "Set lowest price"}
          </Button>
          {item.saleMinPrice !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTerms({ itemId: item._id, muse: on ? "paused" : "active" })}
            >
              {on ? "Pause" : "Resume"}
            </Button>
          )}
        </>
      )}
      {error && <span className="text-negative">{error}</span>}
    </div>
  );
}

type Draft = {
  itemId: Id<"ownedItems">;
  title: string;
  price: string;
  category: ListingCategory;
  /** Lowest price Muse may accept (#44); blank = Muse doesn't reply to buyers. */
  minPrice: string;
};

function ReviewListings({
  itemIds,
  onDone,
}: {
  itemIds: Id<"ownedItems">[];
  onDone: (created: boolean) => void;
}) {
  const drafts = useQ(api.inventory.saleDrafts, { itemIds });
  const listForSale = useM(api.inventory.listForSale);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [hood, setHood] = useState<string>(NEIGHBORHOODS[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill once from the inventory; after that the edits are the user's.
  useEffect(() => {
    if (!drafts || rows) return;
    setRows(
      drafts.map((d) => ({
        itemId: d.itemId,
        title: d.title,
        price: String(d.price),
        category: d.category,
        minPrice: "",
      })),
    );
    const from = drafts.find((d) => d.neighborhood)?.neighborhood;
    if (from && NEIGHBORHOODS.some((n) => n.name === from)) setHood(from);
  }, [drafts, rows]);

  const photosFor = (id: Id<"ownedItems">) => drafts?.find((d) => d.itemId === id)?.photos ?? [];
  const set = (i: number, patch: Partial<Draft>) =>
    setRows((r) => r?.map((x, j) => (j === i ? { ...x, ...patch } : x)) ?? r);

  const submit = async () => {
    if (!rows) return;
    // A cleared price box isn't "free": Number("") would list it for $0.
    const blank = rows.find((r) => r.price.trim() === "");
    if (blank) {
      setError(`Enter a price for ${blank.title.trim() || "each item"}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await listForSale({
        items: rows.map((r) => ({
          itemId: r.itemId,
          title: r.title,
          price: Number(r.price),
          category: r.category,
          minPrice: r.minPrice.trim() ? Number(r.minPrice) : undefined,
        })),
        neighborhood: hood,
      });
      onDone(true);
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setError(typeof data === "string" ? data : "Couldn't create the listings. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mb-4 rounded-lg bg-wash p-3 dark:bg-hover">
      {!rows ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={r.itemId} className="flex gap-3">
                <div className="flex shrink-0 gap-1">
                  {photosFor(r.itemId)
                    .slice(0, 2)
                    .map((p) => (
                      <img key={p} src={p} alt="" className="h-14 w-14 rounded-md object-cover" />
                    ))}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_100px_160px]">
                  <input
                    aria-label="Title"
                    className={field}
                    value={r.title}
                    onChange={(e) => set(i, { title: e.target.value })}
                  />
                  <span className="relative">
                    <span className="-translate-y-1/2 absolute top-1/2 left-3 text-secondary">
                      $
                    </span>
                    <input
                      aria-label="Price"
                      type="number"
                      min={0}
                      className={`${field} pl-6`}
                      value={r.price}
                      onChange={(e) => set(i, { price: e.target.value })}
                    />
                  </span>
                  <span className="relative">
                    <span className="-translate-y-1/2 absolute top-1/2 left-3 text-secondary">
                      $
                    </span>
                    <input
                      aria-label="Lowest price for Muse"
                      title="Lowest price Muse may accept from buyers. Leave blank to reply yourself."
                      placeholder="Lowest"
                      type="number"
                      min={1}
                      className={`${field} pl-6`}
                      value={r.minPrice}
                      onChange={(e) => set(i, { minPrice: e.target.value })}
                    />
                  </span>
                  <select
                    aria-label="Category"
                    className={field}
                    value={r.category}
                    onChange={(e) => set(i, { category: e.target.value as ListingCategory })}
                  >
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[13px] text-secondary">Pickup neighborhood</span>
            <select
              className={`${field} w-48`}
              value={hood}
              onChange={(e) => setHood(e.target.value)}
            >
              {NEIGHBORHOODS.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onDone(false)} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={busy || !rows}>
          {busy ? "Creating…" : `Create ${rows?.length === 1 ? "listing" : "listings"}`}
        </Button>
      </div>
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import {
  CONDITIONS,
  type Condition,
  PROPERTY_TYPES,
  type PropertyType,
} from "../../../convex/lib/listings";
import type { BrowseFilters, SortOrder } from "../../../convex/listings";

/* ───────────── URL search params ───────────── */

export type MpSearch = {
  q?: string;
  category?: string;
  sort?: SortOrder;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  days?: number;
  availability?: "sold";
  make?: string;
  model?: string;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  vehicleType?: string;
  transmission?: string;
  type?: PropertyType;
  beds?: number;
  baths?: number;
  minSqft?: number;
  maxSqft?: number;
  room?: boolean;
  individuals?: boolean;
};

const SORTS: SortOrder[] = [
  "recommended",
  "price_asc",
  "price_desc",
  "distance_asc",
  "distance_desc",
  "newest",
];

const num = (x: unknown) => {
  const n = typeof x === "number" ? x : typeof x === "string" && x !== "" ? Number(x) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x : undefined);
const bool = (x: unknown) => (x === true || x === "true" ? true : undefined);

export function parseMpSearch(s: Record<string, unknown>): MpSearch {
  const out: MpSearch = {
    q: str(s.q),
    category: str(s.category),
    sort: SORTS.includes(s.sort as SortOrder) ? (s.sort as SortOrder) : undefined,
    minPrice: num(s.minPrice),
    maxPrice: num(s.maxPrice),
    condition: str(s.condition),
    days: num(s.days),
    availability: s.availability === "sold" ? "sold" : undefined,
    make: str(s.make),
    model: str(s.model),
    minYear: num(s.minYear),
    maxYear: num(s.maxYear),
    minMileage: num(s.minMileage),
    maxMileage: num(s.maxMileage),
    vehicleType: str(s.vehicleType),
    transmission: str(s.transmission),
    type: PROPERTY_TYPES.some((t) => t.value === s.type) ? (s.type as PropertyType) : undefined,
    beds: num(s.beds),
    baths: num(s.baths),
    minSqft: num(s.minSqft),
    maxSqft: num(s.maxSqft),
    room: bool(s.room),
    individuals: bool(s.individuals),
  };
  for (const k of Object.keys(out) as (keyof MpSearch)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export function toFilters(s: MpSearch): BrowseFilters {
  const conditions = (s.condition?.split(",") ?? []).filter((c): c is Condition =>
    CONDITIONS.some((x) => x.value === c),
  );
  return {
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    conditions: conditions.length ? conditions : undefined,
    daysSinceListed: s.days,
    availability: s.availability,
    make: s.make,
    model: s.model,
    minYear: s.minYear,
    maxYear: s.maxYear,
    minMileage: s.minMileage,
    maxMileage: s.maxMileage,
    vehicleType: s.vehicleType,
    transmission: s.transmission,
    propertyType: s.type,
    minBedrooms: s.beds,
    minBathrooms: s.baths,
    minSqft: s.minSqft,
    maxSqft: s.maxSqft,
    privateRoomOnly: s.room,
    individualsOnly: s.individuals,
  };
}

/** Stable cache key for a filter set. */
export function filterKey(s: MpSearch) {
  return JSON.stringify(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)));
}

/* ───────────── Controls ───────────── */

export function Accordion({
  label,
  children,
  summary,
}: {
  label: string;
  children: ReactNode;
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-[45px] w-full items-center rounded-lg px-2 py-2 text-left hover:bg-hover",
          open && "bg-hover",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[15px] text-primary leading-5">{label}</span>
          {summary && !open && (
            <span className="block truncate text-[13px] text-secondary leading-4">{summary}</span>
          )}
        </span>
        <ChevronDown
          size={20}
          strokeWidth={2.25}
          className={cn("shrink-0 text-secondary transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="pt-1 pb-2">{children}</div>}
    </div>
  );
}

export function RadioRow({
  label,
  checked,
  onSelect,
  name,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
  name: string;
}) {
  return (
    <label className="flex h-[46px] cursor-pointer items-center rounded-lg px-2 hover:bg-hover">
      <span className="flex-1 font-medium text-[15px] text-primary">{label}</span>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2",
          checked ? "border-fb" : "border-secondary",
        )}
        aria-hidden
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-fb" />}
      </span>
    </label>
  );
}

export function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex h-[46px] cursor-pointer items-center rounded-lg px-2 hover:bg-hover">
      <span className="flex-1 font-medium text-[15px] text-primary">{label}</span>
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border-2",
          checked ? "border-fb bg-fb" : "border-secondary",
        )}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2">
            <path d="m2.5 6.2 2.3 2.3 4.7-5" />
          </svg>
        )}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  size = "sm",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? 44 : 52;
  const h = size === "sm" ? 24 : 28;
  const k = h - 4;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors",
        checked ? "bg-[#1876F2]" : "bg-[#8F9297]",
      )}
      style={{ width: w, height: h }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-[left]"
        style={{ width: k, height: k, left: checked ? w - k - 2 : 2 }}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-[45px] items-center gap-2 px-2">
      <span className="flex-1 font-semibold text-[15px] text-primary leading-5">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** "Price  [Min] to [Max]": commits on blur or Enter. */
export function RangeInputs({
  label,
  min,
  max,
  onCommit,
}: {
  label: string;
  min?: number;
  max?: number;
  onCommit: (min?: number, max?: number) => void;
}) {
  const [a, setA] = useState(min?.toString() ?? "");
  const [b, setB] = useState(max?.toString() ?? "");
  useEffect(() => setA(min?.toString() ?? ""), [min]);
  useEffect(() => setB(max?.toString() ?? ""), [max]);
  const commit = () => {
    const pa = a.trim() === "" ? undefined : Number(a.replace(/[^0-9.]/g, ""));
    const pb = b.trim() === "" ? undefined : Number(b.replace(/[^0-9.]/g, ""));
    const na = pa !== undefined && Number.isFinite(pa) ? pa : undefined;
    const nb = pb !== undefined && Number.isFinite(pb) ? pb : undefined;
    if (na !== min || nb !== max) onCommit(na, nb);
  };
  const input = (value: string, set: (v: string) => void, placeholder: string) => (
    <input
      value={value}
      inputMode="numeric"
      placeholder={placeholder}
      aria-label={`${label} ${placeholder}`}
      onChange={(e) => set(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-9 w-0 min-w-0 flex-1 rounded-md border border-divider bg-input px-3 font-medium text-[15px] text-primary outline-none placeholder:font-normal placeholder:text-placeholder focus:border-fb"
    />
  );
  return (
    <div className="px-2 py-2">
      <p className="font-semibold text-[15px] text-primary leading-5">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        {input(a, setA, "Min")}
        <span className="text-[15px] text-primary">to</span>
        {input(b, setB, "Max")}
      </div>
    </div>
  );
}

/* ───────────── Filter panels ───────────── */

const SORT_LABEL: Record<SortOrder, string> = {
  recommended: "Suggested",
  price_asc: "Price: Lowest first",
  price_desc: "Price: Highest first",
  distance_asc: "Distance: Nearest first",
  distance_desc: "Distance: Farthest first",
  newest: "Date listed: Newest first",
};

export type FilterKind = "general" | "vehicles" | "rentals" | "homesales";

/** The rail "Filters" block for a category or search. Writes to the URL. */
export function FilterPanel({ kind, value }: { kind: FilterKind; value: MpSearch }) {
  const navigate = useNavigate();
  const set = (patch: Partial<MpSearch>) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next))
          if (next[k] === undefined || next[k] === "") delete next[k];
        return next;
      },
      replace: true,
    });

  const sortLabel = (s: SortOrder) =>
    s === "recommended" && kind !== "general" ? "Recommended" : SORT_LABEL[s];
  const sort = value.sort ?? "recommended";
  const conditions = value.condition?.split(",") ?? [];

  return (
    <>
      <Accordion label="Sort by" summary={value.sort ? sortLabel(sort) : undefined}>
        {SORTS.map((s) => (
          <RadioRow
            key={s}
            name="sort"
            label={sortLabel(s)}
            checked={sort === s}
            onSelect={() => set({ sort: s === "recommended" ? undefined : s })}
          />
        ))}
      </Accordion>
      <RangeInputs
        label="Price"
        min={value.minPrice}
        max={value.maxPrice}
        onCommit={(minPrice, maxPrice) => set({ minPrice, maxPrice })}
      />

      {kind === "vehicles" && <VehicleFilters value={value} set={set} />}

      {(kind === "rentals" || kind === "homesales") && (
        <>
          <Accordion
            label="Bedrooms"
            summary={value.beds !== undefined ? `${value.beds}+` : undefined}
          >
            {[undefined, 1, 2, 3, 4, 5, 6].map((n) => (
              <RadioRow
                key={n ?? "all"}
                name="beds"
                label={n === undefined ? "All" : `${n}+`}
                checked={value.beds === n}
                onSelect={() => set({ beds: n })}
              />
            ))}
          </Accordion>
          <Accordion
            label="Bathrooms"
            summary={value.baths !== undefined ? `${value.baths}+` : undefined}
          >
            {[undefined, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((n) => (
              <RadioRow
                key={n ?? "all"}
                name="baths"
                label={n === undefined ? "All" : `${n}+`}
                checked={value.baths === n}
                onSelect={() => set({ baths: n })}
              />
            ))}
          </Accordion>
          <Accordion
            label={kind === "rentals" ? "Rental type" : "Property type"}
            summary={PROPERTY_TYPES.find((t) => t.value === value.type)?.label}
          >
            <RadioRow
              name="type"
              label="All"
              checked={!value.type}
              onSelect={() => set({ type: undefined })}
            />
            {PROPERTY_TYPES.map((t) => (
              <RadioRow
                key={t.value}
                name="type"
                label={t.label}
                checked={value.type === t.value}
                onSelect={() => set({ type: t.value })}
              />
            ))}
          </Accordion>
          {kind === "rentals" && (
            <ToggleRow
              label="Filter option: Private room only"
              checked={!!value.room}
              onChange={(v) => set({ room: v || undefined })}
            />
          )}
          <RangeInputs
            label="Square feet"
            min={value.minSqft}
            max={value.maxSqft}
            onCommit={(minSqft, maxSqft) => set({ minSqft, maxSqft })}
          />
          <ToggleRow
            label="Listings from individuals only"
            checked={!!value.individuals}
            onChange={(v) => set({ individuals: v || undefined })}
          />
        </>
      )}

      {kind === "general" && (
        <>
          <Accordion
            label="Condition"
            summary={
              conditions.length
                ? CONDITIONS.filter((c) => conditions.includes(c.value))
                    .map((c) => c.label)
                    .join(", ")
                : undefined
            }
          >
            {CONDITIONS.map((c) => (
              <CheckRow
                key={c.value}
                label={c.label}
                checked={conditions.includes(c.value)}
                onToggle={() => {
                  const next = conditions.includes(c.value)
                    ? conditions.filter((x) => x !== c.value)
                    : [...conditions, c.value];
                  set({ condition: next.join(",") || undefined });
                }}
              />
            ))}
          </Accordion>
          <Accordion
            label="Date listed"
            summary={
              value.days !== undefined ? DAYS.find((d) => d.v === value.days)?.label : undefined
            }
          >
            {DAYS.map((d) => (
              <RadioRow
                key={d.label}
                name="days"
                label={d.label}
                checked={value.days === d.v}
                onSelect={() => set({ days: d.v })}
              />
            ))}
          </Accordion>
          <Accordion
            label="Availability"
            summary={value.availability === "sold" ? "Sold" : undefined}
          >
            <RadioRow
              name="availability"
              label="Available"
              checked={value.availability !== "sold"}
              onSelect={() => set({ availability: undefined })}
            />
            <RadioRow
              name="availability"
              label="Sold"
              checked={value.availability === "sold"}
              onSelect={() => set({ availability: "sold" })}
            />
          </Accordion>
        </>
      )}
    </>
  );
}

const DAYS: { label: string; v: number | undefined }[] = [
  { label: "All", v: undefined },
  { label: "Last 24 hours", v: 1 },
  { label: "Last 7 days", v: 7 },
  { label: "Last 30 days", v: 30 },
];

const YEARS = Array.from({ length: 2027 - 1980 + 1 }, (_, i) => 2027 - i);

function VehicleFilters({ value, set }: { value: MpSearch; set: (p: Partial<MpSearch>) => void }) {
  const facets = useQ(api.listings.vehicleFacets, { make: value.make });
  const select = (
    label: string,
    v: number | undefined,
    onChange: (n: number | undefined) => void,
  ) => (
    <select
      aria-label={label}
      value={v ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      className="h-9 w-0 min-w-0 flex-1 rounded-md border border-divider bg-input px-2 font-medium text-[15px] text-primary outline-none focus:border-fb"
    >
      <option value="">{label}</option>
      {YEARS.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <Accordion label="Make" summary={value.make}>
        <RadioRow
          name="make"
          label="All makes"
          checked={!value.make}
          onSelect={() => set({ make: undefined, model: undefined })}
        />
        {facets?.makes.map((m) => (
          <RadioRow
            key={m}
            name="make"
            label={m}
            checked={value.make === m}
            onSelect={() => set({ make: m, model: undefined })}
          />
        ))}
      </Accordion>
      <Accordion label="Model" summary={value.model}>
        <RadioRow
          name="model"
          label="All models"
          checked={!value.model}
          onSelect={() => set({ model: undefined })}
        />
        {facets?.models.map((m) => (
          <RadioRow
            key={m}
            name="model"
            label={m}
            checked={value.model === m}
            onSelect={() => set({ model: m })}
          />
        ))}
      </Accordion>
      <div className="px-2 py-2">
        <p className="font-semibold text-[15px] text-primary leading-5">Year</p>
        <div className="mt-2 flex items-center gap-3">
          {select("Min", value.minYear, (minYear) => set({ minYear }))}
          <span className="text-[15px]">to</span>
          {select("Max", value.maxYear, (maxYear) => set({ maxYear }))}
        </div>
      </div>
      <RangeInputs
        label="Mileage"
        min={value.minMileage}
        max={value.maxMileage}
        onCommit={(minMileage, maxMileage) => set({ minMileage, maxMileage })}
      />
      <Accordion label="Vehicle type" summary={value.vehicleType}>
        <RadioRow
          name="vehicleType"
          label="All"
          checked={!value.vehicleType}
          onSelect={() => set({ vehicleType: undefined })}
        />
        {VEHICLE_TYPES.map((t) => (
          <RadioRow
            key={t}
            name="vehicleType"
            label={t}
            checked={value.vehicleType === t}
            onSelect={() => set({ vehicleType: t })}
          />
        ))}
      </Accordion>
      <Accordion label="Transmission type" summary={value.transmission}>
        {[undefined, "Automatic transmission", "Manual transmission"].map((t) => (
          <RadioRow
            key={t ?? "all"}
            name="transmission"
            label={t === undefined ? "All" : t.replace(" transmission", "")}
            checked={value.transmission === t}
            onSelect={() => set({ transmission: t })}
          />
        ))}
      </Accordion>
    </>
  );
}

export const VEHICLE_TYPES = [
  "Car/Truck",
  "Motorcycle",
  "Powersport",
  "RV/Camper",
  "Trailer",
  "Boat",
  "Commercial/Industrial",
  "Other",
];

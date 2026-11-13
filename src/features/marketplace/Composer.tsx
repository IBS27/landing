import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Globe, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useM, useQ, useViewer, useViewerContext } from "@/app/viewer";
import { uploadFile } from "@/features/posts/util";
import { PlayGlyph } from "@/features/posts/VideoPlayer";
import { captureVideoPoster, probeVideo } from "@/features/posts/videoUpload";
import { cn, price as fmtPrice } from "@/lib/format";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  bedsBaths,
  CONDITIONS,
  type Condition,
  conditionLabel,
  ITEM_CATEGORIES,
  MAX_PROPERTY_PHOTOS,
  MEETUPS,
  type Meetup,
  NEIGHBORHOODS,
  PROPERTY_TYPES,
  type PropertyType,
  propertyTypeLabel,
} from "../../../convex/lib/listings";
import type { ListingCategory, Media } from "../../../convex/validators";
import { SelectField, TextArea, TextField } from "./fields";
import { CheckRow, Switch, VEHICLE_TYPES } from "./filters";
import { LockIcon, PhoneIcon, PhotosAddIcon, RocketIcon, VideoAddIcon } from "./icons";
import { useToast } from "./toast";

export type ComposerKind = "item" | "vehicle" | "property";
type Detail = NonNullable<FunctionReturnType<typeof api.listings.get>>;

type FormState = {
  photos: string[];
  /** "Add video": the uploaded clip (served URL + size), or null. */
  video: Media | null;
  title: string;
  price: string;
  category: ListingCategory | "";
  condition: Condition | "";
  brand: string;
  description: string;
  neighborhood: string;
  meetup: Meetup[];
  groupIds: Id<"groups">[];
  boost: boolean;
  hideFromFriends: boolean;
  // Vehicle
  vehicleType: string;
  year: string;
  make: string;
  model: string;
  mileage: string;
  bodyStyle: string;
  exteriorColor: string;
  transmission: string;
  fuelType: string;
  cleanTitle: boolean;
  // Property
  saleOrRent: "rent" | "sale" | "";
  propertyType: PropertyType | "";
  bedrooms: string;
  bathrooms: string;
  address: string;
  sqft: string;
  availableFrom: string;
  laundry: string;
  parking: string;
  petsAllowed: boolean;
  furnished: boolean;
};

const EMPTY: FormState = {
  photos: [],
  video: null,
  title: "",
  price: "",
  category: "",
  condition: "",
  brand: "",
  description: "",
  neighborhood: "Mission",
  meetup: ["public"],
  groupIds: [],
  boost: false,
  hideFromFriends: false,
  vehicleType: "",
  year: "",
  make: "",
  model: "",
  mileage: "",
  bodyStyle: "",
  exteriorColor: "",
  transmission: "",
  fuelType: "",
  cleanTitle: true,
  saleOrRent: "",
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  address: "",
  sqft: "",
  availableFrom: "",
  laundry: "",
  parking: "",
  petsAllowed: false,
  furnished: false,
};

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));
const YEARS = opts(Array.from({ length: 2027 - 1950 + 1 }, (_, i) => String(2027 - i)));
const BODY_STYLES = opts([
  "Coupe",
  "Truck",
  "Sedan",
  "Hatchback",
  "SUV",
  "Convertible",
  "Wagon",
  "Minivan",
  "Small Car",
  "Other",
]);
const COLORS = opts([
  "Black",
  "Blue",
  "Brown",
  "Gold",
  "Green",
  "Gray",
  "Pink",
  "Purple",
  "Red",
  "Silver",
  "Orange",
  "White",
  "Yellow",
  "Charcoal",
  "Off white",
  "Tan",
  "Beige",
  "Burgundy",
  "Turquoise",
  "Cream",
]);
const FUELS = opts([
  "Diesel",
  "Electric",
  "Gasoline",
  "Flex",
  "Hybrid",
  "Petrol",
  "Plug-in hybrid",
  "Other",
]);
const TRANSMISSIONS = opts(["Automatic transmission", "Manual transmission"]);
const LAUNDRY = opts(["In-unit laundry", "Laundry in building", "Laundry available", "None"]);
const PARKING = opts([
  "Garage parking",
  "Street parking",
  "Off-street parking",
  "Parking available",
  "None",
]);
const COUNTS = opts(["1", "2", "3", "4", "5", "6"]);
const BATHS = opts(["1", "1.5", "2", "2.5", "3", "3.5", "4"]);
const HOODS = NEIGHBORHOODS.map((n) => ({ value: n.name, label: `${n.name}, ${n.city}` }));

function fromListing(l: Detail): FormState {
  return {
    ...EMPTY,
    photos: l.photos,
    video: l.video,
    title: l.title,
    price: String(l.price),
    category: l.category,
    condition: l.condition ?? "",
    brand: l.brand ?? "",
    description: l.description,
    neighborhood: l.location.neighborhood ?? "Mission",
    meetup: l.meetup,
    vehicleType: l.vehicle?.vehicleType ?? "",
    year: l.vehicle ? String(l.vehicle.year) : "",
    make: l.vehicle?.make ?? "",
    model: l.vehicle?.model ?? "",
    mileage: l.vehicle?.mileage !== undefined ? String(l.vehicle.mileage) : "",
    bodyStyle: l.vehicle?.bodyStyle ?? "",
    exteriorColor: l.vehicle?.exteriorColor ?? "",
    transmission: l.vehicle?.transmission ?? "",
    fuelType: l.vehicle?.fuelType ?? "",
    cleanTitle: l.vehicle ? l.vehicle.titleStatus !== "Rebuilt title" : true,
    saleOrRent: l.rental ? (l.rental.listingType === "sale" ? "sale" : "rent") : "",
    propertyType: l.rental?.propertyType ?? "",
    bedrooms: l.rental ? String(l.rental.bedrooms) : "",
    bathrooms: l.rental ? String(l.rental.bathrooms) : "",
    address: l.rental?.address ?? "",
    sqft: l.rental?.sqft !== undefined ? String(l.rental.sqft) : "",
    availableFrom: l.rental?.availableFrom
      ? new Date(l.rental.availableFrom).toISOString().slice(0, 10)
      : "",
    laundry: l.rental?.laundry ?? "",
    parking: l.rental?.parking ?? "",
    petsAllowed: l.rental?.petsAllowed ?? false,
    furnished: l.rental?.furnished ?? false,
  };
}

export function kindOf(l: Detail): ComposerKind {
  if (l.rental) return "property";
  if (l.vehicle || l.category === "vehicles") return "vehicle";
  return "item";
}

const parsePrice = (s: string) => {
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
};

/** Titles Facebook generates for vehicles and homes. */
function autoTitle(kind: ComposerKind, f: FormState) {
  if (kind === "vehicle") return [f.year, f.make, f.model].filter(Boolean).join(" ");
  if (kind === "property") {
    if (!f.propertyType) return "";
    if (f.propertyType === "room")
      return f.saleOrRent === "sale" ? "Room for sale" : "Private room for rent";
    const type = propertyTypeLabel(f.propertyType);
    const beds = f.bedrooms ? `${f.bedrooms} ${f.bedrooms === "1" ? "Bed" : "Beds"} ` : "";
    const baths = f.bathrooms ? `${f.bathrooms} ${f.bathrooms === "1" ? "Bath" : "Baths"} ` : "";
    return `${beds}${baths}${type}${f.saleOrRent === "sale" ? " for sale" : ""}`.trim();
  }
  return f.title;
}

function stepNames(kind: ComposerKind) {
  return kind === "item" ? ["details", "meetup", "places"] : ["details", "places"];
}

function draftKey(viewerId: string | null, kind: ComposerKind) {
  return `fb-clone:marketplace-draft:${viewerId ?? "anon"}:${kind}`;
}

function readDraft(key: string): FormState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<FormState>) } : null;
  } catch {
    return null;
  }
}

const TITLES: Record<ComposerKind, string> = {
  item: "Item for sale",
  vehicle: "Vehicle for sale",
  property: "Home for sale or rent",
};

/** /marketplace/create/{item,vehicle,rental} and /marketplace/edit/$listingId */
export function ListingComposer({ kind, editing }: { kind: ComposerKind; editing?: Detail }) {
  const viewer = useViewer();
  const { viewerId } = useViewerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const key = draftKey(viewerId, kind);
  const [f, setF] = useState<FormState>(() =>
    editing ? fromListing(editing) : (readDraft(key) ?? EMPTY),
  );
  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));
  const steps = stepNames(kind);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useM(api.listings.create);
  const update = useM(api.listings.update);

  const price = parsePrice(f.price);
  const title = autoTitle(kind, f);
  const valid =
    f.photos.length > 0 &&
    price !== null &&
    (kind === "item"
      ? !!f.title.trim() && !!f.category && !!f.condition
      : kind === "vehicle"
        ? !!f.vehicleType && !!f.year && !!f.make.trim() && !!f.model.trim()
        : !!f.saleOrRent &&
          !!f.propertyType &&
          !!f.bedrooms &&
          !!f.bathrooms &&
          !!f.address.trim() &&
          !!f.description.trim());

  const last = step === steps.length - 1;

  const submit = async () => {
    if (!valid || price === null) return;
    setBusy(true);
    setError(null);
    const fields = {
      title,
      price,
      category: (kind === "vehicle"
        ? "vehicles"
        : kind === "property"
          ? f.saleOrRent === "sale"
            ? "homesales"
            : "propertyrentals"
          : f.category || "household") as ListingCategory,
      condition: f.condition || undefined,
      brand: kind === "item" ? f.brand || undefined : kind === "vehicle" ? f.make : undefined,
      description: f.description,
      photos: f.photos.map((url) => ({ url })),
      video: f.video ?? undefined,
      neighborhood: f.neighborhood,
      meetup: kind === "item" ? f.meetup : undefined,
      groupIds: f.groupIds,
      vehicle:
        kind === "vehicle"
          ? {
              vehicleType: f.vehicleType,
              make: f.make.trim(),
              model: f.model.trim(),
              year: Number(f.year),
              mileage: f.mileage ? Number(f.mileage.replace(/[^0-9]/g, "")) : undefined,
              bodyStyle: f.bodyStyle || undefined,
              transmission: f.transmission || undefined,
              fuelType: f.fuelType || undefined,
              exteriorColor: f.exteriorColor || undefined,
              titleStatus: f.cleanTitle ? "Clean title" : "Rebuilt title",
            }
          : undefined,
      rental:
        kind === "property" && f.propertyType
          ? {
              propertyType: f.propertyType,
              listingType: f.saleOrRent === "sale" ? ("sale" as const) : ("rent" as const),
              bedrooms: Number(f.bedrooms),
              bathrooms: Number(f.bathrooms),
              sqft: f.sqft ? Number(f.sqft.replace(/[^0-9]/g, "")) : undefined,
              availableFrom: f.availableFrom
                ? new Date(`${f.availableFrom}T12:00:00`).getTime()
                : undefined,
              furnished: f.furnished,
              petsAllowed: f.petsAllowed,
              laundry: f.laundry || undefined,
              parking: f.parking || undefined,
              address: f.address.trim(),
            }
          : undefined,
    };
    try {
      const id = editing
        ? await update({ listingId: editing._id, ...fields })
        : await create(fields);
      try {
        localStorage.removeItem(key);
      } catch {
        // No storage: nothing to clear.
      }
      void navigate({ to: "/marketplace/item/$listingId", params: { listingId: id } });
    } catch (e) {
      setError(
        e instanceof Error ? e.message.replace(/^.*ConvexError: /, "") : "Something went wrong",
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main
        aria-label={TITLES[kind]}
        className="fixed top-14 left-0 z-10 flex h-[calc(100vh-56px)] w-[360px] flex-col bg-card shadow-[0_12px_28px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.1)]"
      >
        <div className="flex items-start justify-between px-4 pt-[21px]">
          <div>
            <Link
              to="/marketplace"
              className="text-[13px] text-secondary leading-4 hover:underline"
            >
              Marketplace
            </Link>
            <h1 className="font-bold text-[24px] text-primary leading-7">
              {editing ? "Edit listing" : TITLES[kind]}
            </h1>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(key, JSON.stringify(f));
                  toast.show("Draft saved");
                } catch {
                  toast.show("Couldn't save your draft");
                }
              }}
              className="mt-[1px] h-9 rounded-md px-3 font-semibold text-[15px] text-link hover:bg-hover"
            >
              Save draft
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
          {steps[step] === "details" && (
            <DetailsStep kind={kind} f={f} set={set} toast={toast.show} />
          )}
          {steps[step] === "meetup" && <MeetupStep f={f} set={set} />}
          {steps[step] === "places" && <PlacesStep f={f} set={set} />}
          {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
        </div>
        <div className="shrink-0">
          <div
            className="flex gap-1 px-4 pb-4"
            role="progressbar"
            aria-label={`Progress, currently on step ${step + 1} of ${steps.length}`}
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          >
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-2 flex-1 rounded",
                  i <= step ? "bg-fb" : "bg-black/20 dark:bg-white/20",
                )}
              />
            ))}
          </div>
          <div className="h-px bg-divider" />
          <div className="flex gap-2 px-4 py-4">
            {step > 0 && (
              <Button
                size="lg"
                className="h-10 flex-1 text-[17px]"
                onClick={() => setStep(step - 1)}
              >
                Previous
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              className="h-10 flex-[2] text-[17px] disabled:text-[#BCC0C4]"
              disabled={!valid || busy}
              onClick={() => (last ? void submit() : setStep(step + 1))}
            >
              {busy ? (
                <Spinner size={18} className="text-white" />
              ) : last ? (
                editing ? (
                  "Update"
                ) : (
                  "Publish"
                )
              ) : (
                "Next"
              )}
            </Button>
          </div>
        </div>
      </main>
      <section className="hidden h-[calc(100vh-56px)] py-8 pr-[54px] pl-[54px] min-[900px]:ml-[360px] min-[900px]:block">
        <Preview kind={kind} f={f} title={title} price={price} seller={viewer} />
      </section>
      {toast.node}
    </div>
  );
}

/* ───────────── Step 1: details ───────────── */

type StepProps = { f: FormState; set: (p: Partial<FormState>) => void };

function DetailsStep({
  kind,
  f,
  set,
  toast,
}: StepProps & { kind: ComposerKind; toast: (m: string) => void }) {
  const viewer = useViewer();
  const [more, setMore] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <Avatar src={viewer.avatar} size={40} />
        <div>
          <p className="font-semibold text-[15px] text-primary leading-5">{viewer.name}</p>
          <p className="flex items-center gap-1 text-[13px] text-secondary leading-4">
            Listing to Marketplace · <Globe size={12} /> Public
          </p>
        </div>
      </div>
      <PhotoPicker f={f} set={set} toast={toast} kind={kind} />

      {kind === "vehicle" ? (
        <VehicleFields f={f} set={set} />
      ) : kind === "property" ? (
        <PropertyFields f={f} set={set} />
      ) : (
        <>
          <h2 className="mt-5 font-semibold text-[17px] text-primary leading-5">Required</h2>
          <p className="text-[15px] text-secondary leading-5">Be as descriptive as possible.</p>
          <div className="mt-3 flex flex-col gap-4">
            <TextField
              label="Title"
              value={f.title}
              onChange={(title) => set({ title })}
              maxLength={100}
            />
            <TextField
              label="Price"
              value={f.price}
              prefix="$"
              inputMode="numeric"
              onChange={(v) => set({ price: v.replace(/[^0-9]/g, "") })}
            />
            <SelectField
              label="Category"
              value={f.category}
              options={ITEM_CATEGORIES}
              onChange={(category) => set({ category })}
            />
            <SelectField
              label="Condition"
              value={f.condition}
              options={CONDITIONS}
              onChange={(condition) => set({ condition })}
            />
            <TextArea
              label="Description"
              value={f.description}
              onChange={(description) => set({ description })}
            />
          </div>
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore(!more)}
            className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-hover"
          >
            <span className="flex-1">
              <span className="block font-semibold text-[17px] text-primary leading-5">
                More details
              </span>
              <span className="block text-[15px] text-secondary leading-5">
                Attract more interest by including more details.
              </span>
            </span>
            <ChevronDown
              size={20}
              className={cn("text-icon transition-transform", more && "rotate-180")}
            />
          </button>
          {more && (
            <div className="mt-2 flex flex-col gap-4">
              <TextField label="Brand" value={f.brand} onChange={(brand) => set({ brand })} />
              <SelectField
                label="Location"
                value={f.neighborhood}
                options={HOODS}
                onChange={(neighborhood) => set({ neighborhood })}
              />
            </div>
          )}
          <div className="mt-3 h-px bg-divider" />
          <ToggleBlock
            icon={<RocketIcon size={24} />}
            title="Boost listing after publish"
            body="Add a step to boost your listing after it publishes, to help you reach more potential buyers by turning it into an ad."
            checked={f.boost}
            onChange={(boost) => set({ boost })}
          />
          <ToggleBlock
            icon={<LockIcon size={24} />}
            title="Hide from friends"
            body={
              <>
                This listing is still public. If you hide this listing from friends, they won't see
                it in most cases. <span className="font-semibold text-link">Learn more</span>
              </>
            }
            checked={f.hideFromFriends}
            onChange={(hideFromFriends) => set({ hideFromFriends })}
          />
        </>
      )}
      <p className="mt-6 text-[13px] text-secondary leading-4">
        Marketplace items are public and can be seen by anyone on or off Facebook. Items like
        animals, drugs, weapons, counterfeits, and other items that infringe intellectual property
        aren't allowed on Marketplace. See our{" "}
        <span className="font-semibold text-link">Commerce Policies</span>.
      </p>
    </>
  );
}

function ToggleBlock({
  icon,
  title,
  body,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 flex gap-3">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[17px] text-primary leading-5">{title}</p>
        <p className="mt-0.5 text-[13px] text-secondary leading-4">{body}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} size="md" />
    </div>
  );
}

function PhotoPicker({
  f,
  set,
  toast,
  kind,
}: StepProps & { toast: (m: string) => void; kind: ComposerKind }) {
  const photoLimit = kind === "property" ? MAX_PROPERTY_PHOTOS : 10;
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const getUploadUrl = useM(api.posts.generateUploadUrl);
  const photoUrl = useM(api.listings.photoUrl);
  const [pending, setPending] = useState(0);
  const photosRef = useRef(f.photos);
  photosRef.current = f.photos;

  const add = async (files: FileList | File[]) => {
    const images = [...files].filter((x) => x.type.startsWith("image/"));
    const room = photoLimit - photosRef.current.length - pending;
    if (images.length > room) toast(`You can add up to ${photoLimit} photos`);
    const take = images.slice(0, Math.max(0, room));
    setPending((n) => n + take.length);
    for (const file of take) {
      try {
        const url = await getUploadUrl({});
        const storageId = (await uploadFile(url, file)) as Id<"_storage">;
        const served = await photoUrl({ storageId });
        set({ photos: [...photosRef.current, served] });
        photosRef.current = [...photosRef.current, served];
      } catch {
        toast("Couldn't upload a photo");
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const [videoPending, setVideoPending] = useState(false);
  const addVideo = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast("Choose a video file");
    let probed: Awaited<ReturnType<typeof probeVideo>>;
    try {
      probed = await probeVideo(file);
    } catch {
      return toast("Couldn't read that video");
    }
    if (probed.duration > 61) {
      URL.revokeObjectURL(probed.url);
      return toast("Videos can be up to 1 minute long");
    }
    setVideoPending(true);
    try {
      const upload = async (blob: File) => {
        const storageId = (await uploadFile(await getUploadUrl({}), blob)) as Id<"_storage">;
        return photoUrl({ storageId });
      };
      const poster = await captureVideoPoster(probed.url);
      const [url, posterUrl] = await Promise.all([
        upload(file),
        poster ? upload(poster) : Promise.resolve(undefined),
      ]);
      set({
        video: {
          url,
          kind: "video",
          width: probed.width,
          height: probed.height,
          duration: Math.round(probed.duration * 10) / 10,
          poster: posterUrl,
        },
      });
    } catch {
      toast("Couldn't upload the video");
    } finally {
      URL.revokeObjectURL(probed.url);
      setVideoPending(false);
    }
  };

  const tile =
    "flex flex-col items-center justify-center rounded border border-divider text-center hover:bg-hover";
  return (
    <>
      <p className="mt-3 font-semibold text-[13px] text-secondary leading-4">
        Photos · {f.photos.length} / {photoLimit} Videos · {f.video ? 1 : 0} / 1
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={video}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addVideo(file);
          e.target.value = "";
        }}
      />
      {f.photos.length === 0 && pending === 0 && !f.video && !videoPending ? (
        <div
          className="mt-2 grid grid-cols-2 gap-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void add(e.dataTransfer.files);
          }}
        >
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(tile, "h-[162px] justify-start! pt-[30px]")}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-btn">
              <PhotosAddIcon size={20} />
            </span>
            <span className="mt-2 font-semibold text-[17px] text-primary leading-5">
              Add photos
            </span>
            <span className="text-[15px] text-secondary leading-5">or drag and drop</span>
          </button>
          <button
            type="button"
            onClick={() => video.current?.click()}
            className={cn(tile, "h-[162px] justify-start! pt-[30px]")}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-btn">
              <VideoAddIcon size={20} />
            </span>
            <span className="mt-2 font-semibold text-[17px] text-primary leading-5">Add video</span>
            <span className="text-[15px] text-secondary leading-5">or drag and drop</span>
            <span className="text-[13px] text-secondary leading-4">(1 minute max)</span>
          </button>
        </div>
      ) : (
        <div
          className="mt-2 grid grid-cols-3 gap-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void add(e.dataTransfer.files);
          }}
        >
          {f.video && (
            <div className="group relative aspect-square overflow-hidden rounded border border-divider bg-black">
              {f.video.poster ? (
                <img
                  src={f.video.poster}
                  alt="Listing video"
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={f.video.url}
                  muted
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">
                  <PlayGlyph size={18} className="ml-0.5" />
                </span>
              </span>
              <button
                type="button"
                aria-label="Remove video"
                onClick={() => set({ video: null })}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#080809] shadow-base"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {videoPending && (
            <div className="flex aspect-square items-center justify-center rounded border border-divider bg-input">
              <Spinner size={20} />
            </div>
          )}
          {f.photos.map((p, i) => (
            <div
              key={p}
              className="group relative aspect-square overflow-hidden rounded border border-divider"
            >
              <img src={p} alt={`Listing ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => set({ photos: f.photos.filter((x) => x !== p) })}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#080809] shadow-base"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded border border-divider bg-input"
            >
              <Spinner size={20} />
            </div>
          ))}
          {f.photos.length + pending < photoLimit && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn(tile, "aspect-square")}
            >
              <PhotosAddIcon size={20} className="text-icon" />
              <span className="mt-1 font-semibold text-[13px] text-primary">Add photos</span>
            </button>
          )}
          {!f.video && !videoPending && (
            <button
              type="button"
              onClick={() => video.current?.click()}
              className={cn(tile, "aspect-square")}
            >
              <VideoAddIcon size={20} className="text-icon" />
              <span className="mt-1 font-semibold text-[13px] text-primary">Add video</span>
            </button>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-wash px-3 py-3">
        <PhoneIcon size={24} className="shrink-0 text-primary" />
        <p className="flex-1 text-[13px] text-primary leading-4">
          Upload photos directly from your phone.{" "}
          <span className="font-semibold text-link">Learn more</span>
        </p>
        <Button onClick={() => toast("Open Facebook on your phone to add photos to this listing")}>
          Try it
        </Button>
      </div>
    </>
  );
}

function VehicleFields({ f, set }: StepProps) {
  return (
    <>
      <h2 className="mt-5 font-semibold text-[17px] text-primary leading-5">About this vehicle</h2>
      <p className="text-[15px] text-secondary leading-5">
        Help buyers know more about the vehicle you're listing.
      </p>
      <div className="mt-3 flex flex-col gap-4">
        <SelectField
          label="Vehicle type"
          value={f.vehicleType}
          options={opts(VEHICLE_TYPES)}
          onChange={(vehicleType) => set({ vehicleType })}
        />
        <SelectField
          label="Location"
          value={f.neighborhood}
          options={HOODS}
          onChange={(neighborhood) => set({ neighborhood })}
        />
        <SelectField
          label="Year"
          value={f.year}
          options={YEARS}
          onChange={(year) => set({ year })}
        />
        <TextField label="Make" value={f.make} onChange={(make) => set({ make })} />
        <TextField label="Model" value={f.model} onChange={(model) => set({ model })} />
        <TextField
          label="Mileage"
          value={f.mileage}
          inputMode="numeric"
          onChange={(v) => set({ mileage: v.replace(/[^0-9]/g, "") })}
        />
        <TextField
          label="Price"
          value={f.price}
          prefix="$"
          inputMode="numeric"
          onChange={(v) => set({ price: v.replace(/[^0-9]/g, "") })}
        />
        <SelectField
          label="Body style"
          value={f.bodyStyle}
          options={BODY_STYLES}
          onChange={(bodyStyle) => set({ bodyStyle })}
        />
        <SelectField
          label="Exterior color"
          value={f.exteriorColor}
          options={COLORS}
          onChange={(exteriorColor) => set({ exteriorColor })}
        />
        <div className="flex items-center gap-3 px-1 py-1">
          <span className="flex-1 text-[15px] text-primary">This vehicle has a clean title</span>
          <Switch
            checked={f.cleanTitle}
            onChange={(cleanTitle) => set({ cleanTitle })}
            label="Clean title"
            size="md"
          />
        </div>
        <SelectField
          label="Vehicle condition"
          value={f.condition}
          options={CONDITIONS}
          onChange={(condition) => set({ condition })}
        />
        <SelectField
          label="Fuel type"
          value={f.fuelType}
          options={FUELS}
          onChange={(fuelType) => set({ fuelType })}
        />
        <SelectField
          label="Transmission"
          value={f.transmission}
          options={TRANSMISSIONS}
          onChange={(transmission) => set({ transmission })}
        />
        <TextArea
          label="Description"
          value={f.description}
          onChange={(description) => set({ description })}
        />
      </div>
    </>
  );
}

function PropertyFields({ f, set }: StepProps) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      <SelectField
        label="Home for Sale or Rent"
        value={f.saleOrRent}
        options={[
          { value: "rent", label: "Rent" },
          { value: "sale", label: "Sale" },
        ]}
        onChange={(saleOrRent) => set({ saleOrRent })}
      />
      <SelectField
        label={f.saleOrRent === "sale" ? "Property type" : "Rental type"}
        value={f.propertyType}
        options={PROPERTY_TYPES}
        onChange={(propertyType) => set({ propertyType })}
      />
      <SelectField
        label="Number of bedrooms"
        value={f.bedrooms}
        options={COUNTS}
        onChange={(bedrooms) => set({ bedrooms })}
      />
      <SelectField
        label="Number of bathrooms"
        value={f.bathrooms}
        options={BATHS}
        onChange={(bathrooms) => set({ bathrooms })}
      />
      <TextField
        label={f.saleOrRent === "sale" ? "Price" : "Price per month"}
        value={f.price}
        prefix="$"
        inputMode="numeric"
        onChange={(v) => set({ price: v.replace(/[^0-9]/g, "") })}
      />
      <TextField
        label={f.saleOrRent === "sale" ? "Property address" : "Rental address"}
        value={f.address}
        onChange={(address) => set({ address })}
      />
      <SelectField
        label="Neighborhood"
        value={f.neighborhood}
        options={HOODS}
        onChange={(neighborhood) => set({ neighborhood })}
      />
      <TextArea
        label={f.saleOrRent === "sale" ? "Property description" : "Rental description"}
        value={f.description}
        onChange={(description) => set({ description })}
      />
      <h2 className="mt-2 font-semibold text-[17px] text-primary leading-5">Advanced details</h2>
      <TextField
        label="Square feet"
        value={f.sqft}
        inputMode="numeric"
        onChange={(v) => set({ sqft: v.replace(/[^0-9]/g, "") })}
      />
      {f.saleOrRent !== "sale" && (
        <TextField
          label="Date available"
          type="date"
          value={f.availableFrom}
          onChange={(availableFrom) => set({ availableFrom })}
        />
      )}
      <SelectField
        label="Laundry type"
        value={f.laundry}
        options={LAUNDRY}
        onChange={(laundry) => set({ laundry })}
      />
      <SelectField
        label="Parking type"
        value={f.parking}
        options={PARKING}
        onChange={(parking) => set({ parking })}
      />
      <div className="flex items-center gap-3 px-1 py-1">
        <span className="flex-1 text-[15px] text-primary">Pet friendly</span>
        <Switch
          checked={f.petsAllowed}
          onChange={(petsAllowed) => set({ petsAllowed })}
          label="Pet friendly"
          size="md"
        />
      </div>
      <div className="flex items-center gap-3 px-1 py-1">
        <span className="flex-1 text-[15px] text-primary">Furnished</span>
        <Switch
          checked={f.furnished}
          onChange={(furnished) => set({ furnished })}
          label="Furnished"
          size="md"
        />
      </div>
    </div>
  );
}

/* ───────────── Steps 2/3 ───────────── */

function MeetupStep({ f, set }: StepProps) {
  return (
    <>
      <h2 className="mt-2 font-semibold text-[17px] text-primary leading-5">Meetup preferences</h2>
      <p className="mb-2 text-[15px] text-secondary leading-5">
        Buyers will see your preferences and can message you to arrange a meetup.
      </p>
      {MEETUPS.map((m) => (
        <CheckRow
          key={m.value}
          label={`${m.label}`}
          checked={f.meetup.includes(m.value)}
          onToggle={() =>
            set({
              meetup: f.meetup.includes(m.value)
                ? f.meetup.filter((x) => x !== m.value)
                : [...f.meetup, m.value],
            })
          }
        />
      ))}
    </>
  );
}

function PlacesStep({ f, set }: StepProps) {
  const groups = useQ(api.listings.listingTargets, {});
  return (
    <>
      <h2 className="mt-2 font-semibold text-[17px] text-primary leading-5">List in more places</h2>
      <p className="mb-2 text-[15px] text-secondary leading-5">
        Choose where you want your listing to be seen.
      </p>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn">
          <Globe size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-medium text-[15px] text-primary">Marketplace</span>
          <span className="block text-[13px] text-secondary">Public</span>
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded bg-fb">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2">
            <path d="m2.5 6.2 2.3 2.3 4.7-5" />
          </svg>
        </span>
      </div>
      {groups === undefined ? (
        <Spinner className="mx-auto mt-4 block" />
      ) : groups.length === 0 ? (
        <p className="px-2 py-3 text-[15px] text-secondary">
          Join buy and sell groups to list there too.
        </p>
      ) : (
        groups.map((g) => {
          const on = f.groupIds.includes(g._id);
          return (
            <label
              key={g._id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
            >
              <img src={g.cover} alt="" className="h-9 w-9 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[15px] text-primary">
                  {g.name}
                </span>
                <span className="block text-[13px] text-secondary">
                  {g.memberCount.toLocaleString("en-US")} members
                </span>
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() =>
                  set({
                    groupIds: on ? f.groupIds.filter((x) => x !== g._id) : [...f.groupIds, g._id],
                  })
                }
              />
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border-2",
                  on ? "border-fb bg-fb" : "border-secondary",
                )}
                aria-hidden
              >
                {on && (
                  <svg
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                  >
                    <path d="m2.5 6.2 2.3 2.3 4.7-5" />
                  </svg>
                )}
              </span>
            </label>
          );
        })
      )}
    </>
  );
}

/* ───────────── Live preview ───────────── */

function Preview({
  kind,
  f,
  title,
  price,
  seller,
}: {
  kind: ComposerKind;
  f: FormState;
  title: string;
  price: number | null;
  seller: { name: string; avatar: string };
}) {
  const [i, setI] = useState(0);
  const photo = f.photos[Math.min(i, f.photos.length - 1)];
  const hood = NEIGHBORHOODS.find((n) => n.name === f.neighborhood);
  const faded = "text-secondary opacity-70";
  const priceText =
    price === null
      ? null
      : price === 0
        ? "Free"
        : kind === "property" && f.saleOrRent !== "sale"
          ? `${fmtPrice(price)} / Month`
          : fmtPrice(price);
  return (
    <div className="flex h-full flex-col rounded-lg bg-card p-4 shadow-emphasis">
      <h2 className="font-semibold text-[15px] text-primary">Preview</h2>
      <div className="mt-4 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 bg-wash dark:border-white/10">
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-input">
          {photo ? (
            <>
              <img
                src={photo}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
              />
              <img
                src={photo}
                alt="Listing preview"
                className="relative h-full w-full object-contain"
              />
              {f.photos.length > 1 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
                  {f.photos.map((p, k) => (
                    <button
                      key={p}
                      type="button"
                      aria-label={`View photo ${k + 1}`}
                      onClick={() => setI(k)}
                      className={cn(
                        "h-9 w-9 overflow-hidden rounded-[6px]",
                        k !== i && "opacity-60",
                      )}
                    >
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="max-w-[400px] text-center">
              <p className="font-bold text-[24px] text-secondary leading-7">Your listing preview</p>
              <p className="mt-1 text-[20px] text-secondary leading-6">
                As you create your listing, you can preview how it will appear to others on
                Marketplace.
              </p>
            </div>
          )}
        </div>
        <div className="w-[328px] shrink-0 overflow-y-auto bg-card p-4">
          <p
            className={cn(
              "break-words font-bold text-[24px] leading-7",
              title ? "text-primary" : faded,
            )}
          >
            {title || "Title"}
          </p>
          <p
            className={cn(
              "mt-1 text-[17px] leading-[22px]",
              priceText ? "font-medium text-primary" : faded,
            )}
          >
            {priceText ?? "Price"}
          </p>
          <p className="mt-1 text-[13px] text-primary leading-4">
            Listed a few seconds ago in {hood?.city.replace(/, [A-Z]{2}$/, "") ?? "San Francisco"}
          </p>
          <h3 className={cn("mt-6 font-semibold text-[17px] leading-5", faded)}>Details</h3>
          {kind === "item" && f.condition && (
            <div className="mt-2 flex justify-between text-[15px]">
              <span className="text-primary">Condition</span>
              <span className="text-secondary">{conditionLabel(f.condition)}</span>
            </div>
          )}
          {kind === "property" && f.bedrooms && f.bathrooms && (
            <p className="mt-2 text-[15px] text-primary">
              {bedsBaths({ bedrooms: Number(f.bedrooms), bathrooms: Number(f.bathrooms) })}
            </p>
          )}
          {kind === "vehicle" && f.mileage && (
            <p className="mt-2 text-[15px] text-primary">
              Driven {Number(f.mileage).toLocaleString("en-US")} miles
            </p>
          )}
          <p
            className={cn(
              "mt-3 whitespace-pre-wrap break-words text-[15px] leading-5",
              f.description ? "text-primary" : faded,
            )}
          >
            {f.description || "Description will appear here."}
          </p>
          <div className="mt-6 flex items-center justify-between">
            <h3 className={cn("font-semibold text-[17px] leading-5", faded)}>Seller information</h3>
            <span className={cn("text-[15px]", faded)}>Seller details</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Avatar src={seller.avatar} size={48} className="opacity-80" />
            <span className={cn("font-semibold text-[15px]", faded)}>{seller.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

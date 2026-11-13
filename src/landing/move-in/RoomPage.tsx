import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { useToast } from "@/features/marketplace/toast";
import { LandingPage } from "@/landing/shell/LandingPage";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAX_ROOMS, ROOM_KINDS, type RoomKind, SIZE_FT } from "../../../convex/lib/vibe";
import { RoomScan } from "./RoomScan";
import { type Room, VibeCard } from "./VibeCard";
import { VibeMatches } from "./VibeMatches";

const inputCls =
  "h-10 w-full rounded-md border border-divider bg-card px-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb focus:shadow-[0_0_0_1px_var(--fb-blue)]";

function errorText(e: unknown) {
  return e instanceof Error ? e.message.replace(/^.*ConvexError:\s*/, "") : "Something went wrong";
}

/**
 * My Place → Your room (`/landing/place/room`, #25): each room's scan and
 * style vibe. `roomId` picks the room; the first one shows by default.
 */
export function RoomPage({ roomId }: { roomId?: string }) {
  const rooms = useQ(api.rooms.mine, {});
  const [adding, setAdding] = useState(false);
  const room = rooms?.find((r) => r._id === roomId) ?? rooms?.[0];

  return (
    <LandingPage
      title="Your room"
      description="Photograph your room and set its vibe. Muse can suggest one from what you save, like and follow, and Landing uses it to find Marketplace pieces that fit."
    >
      {rooms === undefined ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rooms.length === 0 ? (
        <NewRoomCard first onDone={() => {}} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {rooms.map((r) => (
              <Link
                key={r._id}
                to="/landing/place/room"
                search={{ room: r._id }}
                aria-current={r._id === room?._id ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 font-semibold text-[15px] transition-colors",
                  r._id === room?._id
                    ? "bg-btn-soft text-btn-soft-text"
                    : "bg-btn text-primary hover:brightness-95 dark:hover:brightness-125",
                )}
              >
                {r.name}
              </Link>
            ))}
            {rooms.length < MAX_ROOMS && !adding && (
              <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add a room
              </Button>
            )}
          </div>
          {adding && <NewRoomCard onDone={() => setAdding(false)} />}
          {room && (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                <RoomScan room={room} />
                <RoomDetails key={room._id} room={room} />
                <Link
                  to="/landing/place/unit"
                  search={{ room: room._id }}
                  className="block rounded-lg border border-divider bg-card p-4 font-semibold text-link"
                >
                  Explore in 3D and place furniture
                </Link>
              </div>
              <div className="flex flex-col gap-4">
                <VibeCard key={room._id} room={room} />
                {room.vibe && <VibeMatches roomId={room._id} />}
              </div>
            </div>
          )}
        </div>
      )}
    </LandingPage>
  );
}

function KindSelect({ value, onChange }: { value: RoomKind; onChange: (k: RoomKind) => void }) {
  return (
    <select
      aria-label="Kind of room"
      value={value}
      onChange={(e) => onChange(e.target.value as RoomKind)}
      className={inputCls}
    >
      {ROOM_KINDS.map((k) => (
        <option key={k.id} value={k.id}>
          {k.label}
        </option>
      ))}
    </select>
  );
}

function NewRoomCard({ first, onDone }: { first?: boolean; onDone: () => void }) {
  const create = useM(api.rooms.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [kind, setKind] = useState<RoomKind>("bedroom");
  const [name, setName] = useState("Bedroom");
  const [named, setNamed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Until the person types a name, it follows the kind ("Living room").
  useEffect(() => {
    if (!named) setName(ROOM_KINDS.find((k) => k.id === kind)?.label ?? "Room");
  }, [kind, named]);

  async function submit() {
    setBusy(true);
    try {
      const id = await create({ name, kind });
      onDone();
      void navigate({ to: "/landing/place/room", search: { room: id } });
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">
        {first ? "Start with a room" : "Add a room"}
      </h2>
      <p className="mt-0.5 mb-3 text-[13px] text-secondary">
        {first
          ? "Pick the room you're setting up first. You'll add photos and its vibe next."
          : "Each room gets its own photos and vibe."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <KindSelect value={kind} onChange={setKind} />
        <input
          aria-label="Room name"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setNamed(true);
            setName(e.target.value);
          }}
          className={inputCls}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {!first && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
          {first ? "Create room" : "Add room"}
        </Button>
      </div>
      {toast.node}
    </Card>
  );
}

/** "Bedroom, its 3 photos and its vibe, will be deleted…", naming only what the room has. */
function deleteText(room: Room) {
  const parts = [
    room.photos.length > 0
      ? `its ${room.photos.length} photo${room.photos.length === 1 ? "" : "s"}`
      : null,
    room.vibe ? "its vibe" : null,
  ].filter(Boolean);
  return `${room.name}${parts.length ? `, ${parts.join(" and ")},` : ""} will be deleted. This can't be undone.`;
}

function RoomDetails({ room }: { room: Room }) {
  const update = useM(api.rooms.update);
  const remove = useM(api.rooms.remove);
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(room.name);
  const [kind, setKind] = useState<RoomKind>(room.kind);
  const [width, setWidth] = useState(room.size ? String(room.size.widthFt) : "");
  const [length, setLength] = useState(room.size ? String(room.size.lengthFt) : "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const sizeChanged =
    width !== (room.size ? String(room.size.widthFt) : "") ||
    length !== (room.size ? String(room.size.lengthFt) : "");
  const changed = name.trim() !== room.name || kind !== room.kind || sizeChanged;
  const sizeBlank = !width.trim() && !length.trim();

  async function save() {
    setBusy(true);
    try {
      await update({
        roomId: room._id,
        name,
        kind,
        ...(sizeChanged
          ? { size: sizeBlank ? null : { widthFt: Number(width), lengthFt: Number(length) } }
          : {}),
      });
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold text-[20px] text-primary leading-6">Details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[13px] text-secondary">Name</span>
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span aria-hidden className="font-semibold text-[13px] text-secondary">
            Kind
          </span>
          <KindSelect value={kind} onChange={setKind} />
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className="mb-1 font-semibold text-[13px] text-secondary">
          Floor size in feet (optional, {SIZE_FT.min}–{SIZE_FT.max} each side)
        </legend>
        <div className="flex items-center gap-2">
          <input
            aria-label="Width in feet"
            inputMode="decimal"
            placeholder="Width"
            value={width}
            onChange={(e) => setWidth(e.target.value.replace(/[^\d.]/g, ""))}
            className={cn(inputCls, "w-28")}
          />
          <span className="text-secondary">×</span>
          <input
            aria-label="Length in feet"
            inputMode="decimal"
            placeholder="Length"
            value={length}
            onChange={(e) => setLength(e.target.value.replace(/[^\d.]/g, ""))}
            className={cn(inputCls, "w-28")}
          />
          <span className="text-[15px] text-secondary">ft</span>
        </div>
      </fieldset>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          icon={<Trash2 size={16} />}
          onClick={() => setConfirming(true)}
          className="text-negative"
        >
          Delete room
        </Button>
        <Button variant="primary" disabled={!changed || busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
      <Modal open={confirming} onOpenChange={setConfirming} title="Delete this room?" width={440}>
        <div className="px-4 pb-4">
          <p className="text-[15px] text-primary">{deleteText(room)}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                void remove({ roomId: room._id as Id<"rooms"> })
                  .then(() => {
                    setConfirming(false);
                    void navigate({ to: "/landing/place/room", search: {} });
                  })
                  .catch((e) => toast.show(errorText(e)))
              }
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      {toast.node}
    </Card>
  );
}

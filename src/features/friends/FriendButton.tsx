import { useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal } from "@/ui/overlays";
import { Button, type ButtonProps } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Relation } from "../../../convex/friends";
import { useFriendActions } from "./hooks";
import { PersonCheckGlyph, PersonPlusGlyph, PersonXGlyph } from "./icons";

export type { Relation };

type Variant = NonNullable<ButtonProps["variant"]>;

/**
 * The relation-aware friend button used across the app: "Add friend",
 * "Cancel request", "Respond" (Confirm / Delete request) or "Friends"
 * (with Unfriend). Pass `relation` when the caller already has it;
 * otherwise it is loaded live.
 */
export function FriendButton({
  userId,
  name,
  relation: given,
  variant = "primary",
  className,
}: {
  userId: Id<"users">;
  /** Used by the Unfriend confirmation. */
  name: string;
  relation?: Relation;
  /** Style for the "Add friend" / "Cancel request" / "Respond" states. */
  variant?: Variant;
  className?: string;
}) {
  const live = useQ(api.friends.relation, given ? "skip" : { userId });
  const relation = given ?? live;
  const actions = useFriendActions();
  const [busy, setBusy] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (!relation || relation === "self") return null;
  const icon = (G: typeof PersonPlusGlyph) => <G size={16} />;

  if (relation === "none")
    return (
      <Button
        variant={variant}
        icon={icon(PersonPlusGlyph)}
        disabled={busy}
        onClick={() => run(() => actions.add(userId))}
        className={className}
      >
        Add friend
      </Button>
    );

  if (relation === "outgoing")
    return (
      <Button
        variant={variant}
        icon={icon(PersonXGlyph)}
        disabled={busy}
        onClick={() => run(() => actions.cancel(userId))}
        className={className}
      >
        Cancel request
      </Button>
    );

  if (relation === "incoming")
    return (
      <Menu>
        <MenuTrigger asChild>
          <Button variant={variant} icon={icon(PersonCheckGlyph)} className={className}>
            Respond
          </Button>
        </MenuTrigger>
        <MenuContent width={200} align="start">
          <MenuItem label="Confirm" onSelect={() => run(() => actions.confirm(userId))} />
          <MenuItem label="Delete request" onSelect={() => run(() => actions.decline(userId))} />
        </MenuContent>
      </Menu>
    );

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary" icon={icon(PersonCheckGlyph)} className={className}>
            Friends
          </Button>
        </MenuTrigger>
        <MenuContent width={300} align="start">
          <MenuItem
            icon={<PersonXGlyph size={20} />}
            label="Unfriend"
            onSelect={() => setConfirmUnfriend(true)}
          />
        </MenuContent>
      </Menu>
      <UnfriendDialog
        open={confirmUnfriend}
        onOpenChange={setConfirmUnfriend}
        name={name}
        onConfirm={() => run(() => actions.unfriend(userId))}
      />
    </>
  );
}

/** Facebook's "Unfriend <name>" confirmation. */
export function UnfriendDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Unfriend ${name}`} width={548}>
      <p className="px-4 pt-4 pb-1 text-[15px] text-primary">
        Are you sure you want to remove {name} as your friend?
      </p>
      <div className={cn("flex items-center justify-end gap-2 p-4")}>
        <button
          type="button"
          className="h-9 rounded-md px-3 font-semibold text-[15px] text-link transition-colors hover:bg-hover"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <Button
          variant="primary"
          className="w-[112px]"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  );
}

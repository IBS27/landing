import { Activity, Bell } from "lucide-react";
import { Group, PrefToggle } from "@/features/misc/settings/controls";
import { Modal } from "@/ui/overlays";
import { Button } from "@/ui/primitives";

/** Games rail gear: notification and activity settings for Instant Games. */
export function GameSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Games settings" width={548}>
      <div className="px-2 pt-3 pb-2">
        <Group title="Notifications">
          <PrefToggle
            id="games-notifications"
            Icon={Bell}
            title="Notifications from games"
            sub="Get notified when it's your turn, a friend beats your score or a game you play has news."
          />
        </Group>
        <Group title="Games activity">
          <PrefToggle
            id="games-activity"
            Icon={Activity}
            title="Show games activity"
            sub="Let friends see the games you play and your best scores."
          />
        </Group>
      </div>
      <div className="flex justify-end border-divider border-t px-4 py-3">
        <Button variant="primary" className="min-w-[84px]" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

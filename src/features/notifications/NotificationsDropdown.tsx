import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { BellIcon } from "@/icons";
import { HeaderButton } from "@/layout/HeaderButton";
import { PopoverPanel } from "@/ui/overlays";
import { api } from "../../../convex/_generated/api";
import { NotificationList } from "./NotificationList";

/** Header bell: red badge with the unseen count and a 360px Notifications panel. */
export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const count = useQ(api.notifications.unseenCount, {}) ?? 0;
  const onPage = useRouterState({ select: (s) => s.location.pathname === "/notifications" });
  return (
    <PopoverPanel
      open={open}
      onOpenChange={setOpen}
      width={360}
      alignOffset={-48}
      trigger={
        <HeaderButton
          label="Notifications"
          active={open || onPage}
          count={count}
          aria-expanded={open}
        >
          <BellIcon size={20} />
        </HeaderButton>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotificationList variant="dropdown" onNavigate={() => setOpen(false)} />
      </div>
    </PopoverPanel>
  );
}

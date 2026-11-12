import { MessengerDropdown } from "@/features/messenger/MessengerDropdown";
import { NotificationsDropdown } from "@/features/notifications/NotificationsDropdown";
import { AccountMenu } from "./AccountMenu";
import { MenuDropdown } from "./MenuDropdown";

/**
 * The header's right cluster (Menu, Messenger, Notifications, account) for
 * full-screen surfaces that cover the TopNav: the photo theater's side panel
 * and the story viewer's stage.
 */
export function HeaderActions() {
  return (
    <>
      <MenuDropdown />
      <MessengerDropdown />
      <NotificationsDropdown />
      <AccountMenu />
    </>
  );
}

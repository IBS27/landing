import { NotificationList } from "./NotificationList";

/** /notifications: the same list in a centered 680px card. */
export function NotificationsPage() {
  return (
    <main className="flex justify-center px-4 pt-4 pb-8">
      <div className="w-full max-w-[680px] overflow-hidden rounded-xl bg-card shadow-base">
        <NotificationList variant="page" />
      </div>
    </main>
  );
}

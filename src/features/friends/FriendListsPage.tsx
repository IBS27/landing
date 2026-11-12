import { EmptyPane } from "./FriendsHome";
import { FriendsSubRail } from "./FriendsRail";

/** `/friends/lists`: custom friend lists (none have been created in this world). */
export function FriendListsPage() {
  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <FriendsSubRail title="Custom lists">
        <p className="px-2 pt-4 text-[15px] text-secondary">
          Lists you create to organize your friends will appear here.
        </p>
      </FriendsSubRail>
      <main className="min-w-0 flex-1">
        <EmptyPane text="When you create custom lists, you'll see them here." />
      </main>
    </div>
  );
}

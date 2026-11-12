import { PostsTab } from "./PostsTab";
import { ProfileShell } from "./ProfileLayout";

/** A profile rendered inside the Friends pages' right pane (header + All tab). */
export function ProfilePreview({ username }: { username: string }) {
  return (
    <ProfileShell username={username} embedded>
      <PostsTab />
    </ProfileShell>
  );
}

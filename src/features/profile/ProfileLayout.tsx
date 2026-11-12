import { Outlet, useMatch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { columnPad, ProfileContext } from "./context";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";

/** Header + sticky tabs for one profile; tab content renders below on the grey wash. */
export function ProfileShell({
  username,
  embedded = false,
  children,
}: {
  username: string;
  embedded?: boolean;
  children: ReactNode;
}) {
  const profile = useQ(api.profiles.get, { username });
  if (profile === undefined) return <ProfileSkeleton />;
  if (profile === null) return <ProfileUnavailable />;
  return (
    <ProfileContext.Provider value={{ profile, embedded }}>
      <div className="min-h-[calc(100vh-56px)] bg-wash">
        <ProfileHeader />
        <ProfileTabs />
        <div className={cn("mx-auto w-full max-w-[1186px] pt-4 pb-10", columnPad(embedded))}>
          {children}
        </div>
      </div>
    </ProfileContext.Provider>
  );
}

/** `/$username/*` layout. The post permalink child renders on its own, without the header. */
export function ProfileLayout({ username }: { username: string }) {
  const permalink = useMatch({ from: "/$username/posts/$postId", shouldThrow: false });
  if (permalink) return <Outlet />;
  return (
    <ProfileShell username={username}>
      <Outlet />
    </ProfileShell>
  );
}

function ProfileSkeleton() {
  return (
    <div className="bg-card">
      <div className="mx-auto max-w-[1250px]">
        <Skeleton className="aspect-[1250/463] max-h-[463px] w-full rounded-none rounded-b-lg" />
      </div>
      <div className="mx-auto flex max-w-[1186px] items-center gap-[18px] px-4 pt-6 pb-[26px] min-[1218px]:px-[10px]">
        <Skeleton className="h-[176px] w-[176px] rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

function ProfileUnavailable() {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center">
      <h1 className="font-bold text-[20px] text-secondary">
        This content isn't available right now
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-secondary">
        When this happens, it's usually because the owner only shared it with a small group of
        people, changed who can see it or it's been deleted.
      </p>
      <a
        href="/"
        className="mt-6 rounded-md bg-btn-primary px-12 py-2 font-semibold text-[15px] text-white"
      >
        Go to Feed
      </a>
    </div>
  );
}

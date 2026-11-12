import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useQ, useViewer } from "@/app/viewer";
import { Tooltip } from "@/ui/overlays";
import { Avatar, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type ComposerPanel, CreatePostModal } from "./CreatePostModal";
import { FeelingIcon, LiveVideoIcon, PhotoVideoIcon } from "./icons";

/**
 * The "What's on your mind, <first>?" card (2026 single-row layout). Opens the
 * Create post dialog; posts into a group or onto a friend's timeline when given.
 */
export function Composer({
  groupId,
  groupName,
  timelineUser,
}: {
  groupId?: Id<"groups">;
  groupName?: string;
  timelineUser?: { _id: Id<"users">; firstName: string };
}) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const wallOpen = useQ(
    api.settings.canPostOnTimeline,
    timelineUser ? { userId: timelineUser._id } : "skip",
  );
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ComposerPanel | undefined>();
  const openWith = (p?: ComposerPanel) => {
    setPanel(p);
    setOpen(true);
  };
  const placeholder = timelineUser
    ? `Write something to ${timelineUser.firstName}...`
    : groupId
      ? "Write something..."
      : `What's on your mind, ${viewer.firstName}?`;
  // Hidden like Facebook when the person limited who can post on their profile.
  if (timelineUser && wallOpen !== true) return null;

  return (
    <Card className="rounded-xl px-4 py-3" role="region" aria-label="Create a post">
      <div className="flex items-center gap-2">
        <Link
          to="/$username"
          params={{ username: viewer.username }}
          className="shrink-0 hover:brightness-95"
        >
          <Avatar src={viewer.avatar} size={40} />
        </Link>
        <button
          type="button"
          onClick={() => openWith()}
          className="h-10 min-w-0 flex-1 truncate rounded-full bg-input px-3 text-left text-[17px] text-secondary transition-colors hover:brightness-95 dark:hover:brightness-125"
        >
          {placeholder}
        </button>
        <ComposerButton label="Live video" onClick={() => void navigate({ to: "/live/producer" })}>
          <LiveVideoIcon />
        </ComposerButton>
        <ComposerButton label="Photo/video" onClick={() => openWith("photo")}>
          <PhotoVideoIcon />
        </ComposerButton>
        <ComposerButton label="Feeling/activity" onClick={() => openWith("feeling")}>
          <FeelingIcon />
        </ComposerButton>
      </div>
      <CreatePostModal
        open={open}
        onOpenChange={setOpen}
        initialPanel={panel}
        groupId={groupId}
        groupName={groupName}
        timelineUser={timelineUser}
      />
    </Card>
  );
}

function ComposerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-hover"
      >
        {children}
      </button>
    </Tooltip>
  );
}

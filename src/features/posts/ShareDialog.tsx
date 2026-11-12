import { Link2, Users } from "lucide-react";
import { useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { type Audience, AudienceChip } from "./Audience";
import type { PostView } from "./types";
import { postUrl } from "./util";

/** Facebook's Share sheet: "Share now" to Feed, share into a group, or copy the link. */
export function ShareDialog({ post, onClose }: { post: PostView; onClose: () => void }) {
  const viewer = useViewer();
  const create = useM(api.posts.create);
  const groups = useQ(api.posts.postTargets, {});
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<Audience>("friends");
  const [view, setView] = useState<"main" | "groups">("main");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Sharing a share re-shares the original, as Facebook does.
  const target = post.shared && post.shared !== "unavailable" ? post.shared._id : post._id;

  const share = async (groupId?: Id<"groups">) => {
    setBusy(true);
    try {
      await create({
        sharedPostId: target,
        text: text || undefined,
        privacy: groupId ? undefined : audience,
        groupId,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={view === "groups" ? "Share to a group" : "Share"}
      width={548}
      onBack={view === "groups" ? () => setView("main") : undefined}
    >
      {view === "main" ? (
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Avatar src={viewer.avatar} size={40} />
            <div>
              <p className="font-semibold text-[15px]">{viewer.name}</p>
              <div className="mt-0.5 flex gap-1">
                <span className="inline-flex h-6 items-center rounded-md bg-btn px-2 font-semibold text-[13px]">
                  Feed
                </span>
                <AudienceChip value={audience} onChange={setAudience} />
              </div>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Say something about this..."
            rows={3}
            className="mt-3 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-placeholder"
          />
          <div className="flex justify-end">
            <Button variant="primary" className="px-6" disabled={busy} onClick={() => share()}>
              {busy ? <Spinner size={16} className="text-white" /> : "Share now"}
            </Button>
          </div>
          <div className="mt-4 border-divider border-t pt-3">
            <p className="mb-2 font-bold text-[17px]">Share to</p>
            <div className="flex gap-4">
              <ShareTarget
                label="Group"
                onClick={() => setView("groups")}
                icon={<Users size={24} />}
              />
              <ShareTarget
                label={toast ?? "Copy link"}
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(window.location.origin + postUrl(post))
                    .then(() => setToast("Link copied"));
                }}
                icon={<Link2 size={24} />}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2">
          {groups === undefined ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : groups.length === 0 ? (
            <p className="p-6 text-center text-secondary">You haven't joined any groups yet.</p>
          ) : (
            groups.map((g) => (
              <button
                key={g._id}
                type="button"
                disabled={busy}
                onClick={() => share(g._id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
              >
                <Avatar src={g.cover} size={40} square />
                <span className="flex-1">
                  <span className="block font-medium text-[15px]">{g.name}</span>
                  <span className="block text-secondary text-sm">
                    {g.privacy === "private" ? "Private group" : "Public group"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}

function ShareTarget({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-[72px] flex-col items-center gap-1.5">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95",
        )}
      >
        {icon}
      </span>
      <span className="text-center text-[13px] leading-4">{label}</span>
    </button>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useM } from "@/app/viewer";
import { Modal } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { useProfile } from "./context";
import { pickImage, useSetProfilePhoto } from "./photos";

export const BIO_MAX = 101;

/** Facebook's "Edit profile" dialog: picture, cover, bio and a jump to About. */
export function EditProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { profile } = useProfile();
  const { user } = profile;
  const photo = useSetProfilePhoto();
  const navigate = useNavigate();
  const goAbout = () => {
    onOpenChange(false);
    void navigate({ to: "/$username/about", params: { username: user.username } });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit profile" width={700}>
      <div className="px-4 pb-4">
        <Section
          title="Profile picture"
          action="Edit"
          onAction={() => pickImage((f) => void photo.upload("avatar", f))}
        >
          <div className="flex justify-center py-2">
            <Avatar src={user.avatar} size={168} />
          </div>
        </Section>
        <Section
          title="Cover photo"
          action={user.cover ? "Edit" : "Add"}
          onAction={() => pickImage((f) => void photo.upload("cover", f))}
        >
          <div className="mx-auto aspect-[1250/463] w-full max-w-[500px] overflow-hidden rounded-lg bg-wash">
            {user.cover && <img src={user.cover} alt="" className="h-full w-full object-cover" />}
          </div>
        </Section>
        <BioSection />
        <Section title="Customize your intro" action="Edit" onAction={goAbout}>
          <p className="text-center text-[15px] text-secondary">
            Update your work, education, places and relationship.
          </p>
        </Section>
        <div className="pt-4">
          <Button variant="soft" block onClick={goAbout}>
            Edit your About info
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-divider border-b py-4 last:border-b-0">
      <div className="flex items-center justify-between pb-3">
        <h3 className="font-bold text-[20px] text-primary">{title}</h3>
        <button
          type="button"
          onClick={onAction}
          className="h-9 rounded-md px-2 text-[17px] text-link transition-colors hover:bg-hover"
        >
          {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function BioSection() {
  const { profile } = useProfile();
  const bio = profile.user.bio;
  const [editing, setEditing] = useState(false);
  return (
    <Section title="Bio" action={bio ? "Edit" : "Add"} onAction={() => setEditing(true)}>
      {editing ? (
        <BioEditor initial={bio ?? ""} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-center text-[15px] text-secondary">{bio ?? "Describe yourself..."}</p>
      )}
    </Section>
  );
}

/** Centered textarea with "N characters remaining", Public audience, Cancel / Save. */
export function BioEditor({ initial, onDone }: { initial: string; onDone: () => void }) {
  const update = useM(api.profiles.update);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await update({ bio: text });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <textarea
        // biome-ignore lint/a11y/noAutofocus: the editor opens on an explicit Edit/Add click
        autoFocus
        value={text}
        maxLength={BIO_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe who you are"
        aria-label="Enter bio text"
        className="block h-[86px] w-full resize-none rounded-md border border-divider bg-input px-3 py-2 text-center text-[15px] text-primary outline-none focus:border-fb"
      />
      <p className="pt-1 text-right text-[13px] text-secondary">
        {BIO_MAX - text.length} characters remaining
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={busy || text === initial}>
          Save
        </Button>
      </div>
    </div>
  );
}

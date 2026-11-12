import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ChevronRight,
  CircleHelp,
  MessageCircleMore,
  MessageSquareOff,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { DropdownMenu as DM } from "radix-ui";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/format";
import { MenuContent, Modal, Tooltip } from "@/ui/overlays";
import { DotsIcon } from "./icons";

export type Folder = "archived" | "requests" | "restricted";

function Item({
  icon,
  label,
  chevron,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  chevron?: boolean;
  onSelect: () => void;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className="flex h-9 cursor-pointer select-none items-center gap-3 rounded px-2 text-primary outline-none data-[highlighted]:bg-hover"
    >
      <span className="flex h-5 w-5 items-center justify-center text-icon">{icon}</span>
      <span className="flex-1 font-medium text-[15px]">{label}</span>
      {chevron && <ChevronRight size={20} className="text-icon-secondary" />}
    </DM.Item>
  );
}

const Sep = () => <DM.Separator className="mx-2 my-2 h-px bg-divider" />;

/** "Settings, help and more" (…) menu shared by the dropdown and the Messenger page. */
export function InboxMenu({
  size = 36,
  ghost,
  onNavigate,
}: {
  size?: 32 | 36;
  ghost?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<null | "preferences" | "privacy">(null);
  const go = (folder: Folder) => {
    onNavigate?.();
    void navigate({ to: "/messages", search: { folder } });
  };
  return (
    <>
      <DM.Root modal={false}>
        <Tooltip content="Settings, help and more">
          <DM.Trigger asChild>
            <button
              type="button"
              aria-label="Settings, help and more"
              className={cn(
                "flex items-center justify-center rounded-full aria-expanded:bg-highlight aria-expanded:text-fb aria-expanded:brightness-100",
                ghost
                  ? "text-icon-secondary hover:bg-hover"
                  : "bg-btn text-icon hover:brightness-95 dark:hover:brightness-125",
              )}
              style={{ width: size, height: size }}
            >
              <DotsIcon size={20} />
            </button>
          </DM.Trigger>
        </Tooltip>
        {/* Facebook's notch points up at the "…" button from the panel's square corner. */}
        <MenuContent align="start" arrow>
          <Item
            icon={<Settings size={20} />}
            label="Preferences"
            onSelect={() => setPrefs("preferences")}
          />
          <Sep />
          <Item
            icon={<MessageCircleMore size={20} />}
            label="Message requests"
            onSelect={() => go("requests")}
          />
          <Item
            icon={<Archive size={20} />}
            label="Archived chats"
            onSelect={() => go("archived")}
          />
          <Item
            icon={<MessageSquareOff size={20} />}
            label="Restricted accounts"
            onSelect={() => go("restricted")}
          />
          <Sep />
          <Item
            icon={<ShieldCheck size={20} />}
            label="Privacy & safety"
            chevron
            onSelect={() => setPrefs("privacy")}
          />
          <Sep />
          <Item
            icon={<CircleHelp size={20} />}
            label="Help"
            onSelect={() => {
              onNavigate?.();
              void navigate({ to: "/settings" });
            }}
          />
        </MenuContent>
      </DM.Root>
      <PreferencesModal kind={prefs} onClose={() => setPrefs(null)} />
    </>
  );
}

const PREF_KEY = "fb-clone:messenger-prefs";
type Prefs = Record<string, boolean>;
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

const SECTIONS: Record<
  "preferences" | "privacy",
  { title: string; rows: { key: string; label: string; sub: string; def: boolean }[] }
> = {
  preferences: {
    title: "Preferences",
    rows: [
      {
        key: "previews",
        label: "Show previews",
        sub: "Display message previews in notifications.",
        def: true,
      },
      {
        key: "sounds",
        label: "Notification sounds",
        sub: "Play a sound when you get a new message.",
        def: true,
      },
      {
        key: "callSounds",
        label: "Incoming call sounds",
        sub: "Play a sound when someone calls you.",
        def: true,
      },
      {
        key: "active",
        label: "Show when you're active",
        sub: "Friends and contacts can see when you're active or recently active.",
        def: true,
      },
    ],
  },
  privacy: {
    title: "Privacy & safety",
    rows: [
      {
        key: "readReceipts",
        label: "Read receipts",
        sub: "People will be able to see when you've read their messages.",
        def: true,
      },
      {
        key: "typing",
        label: "Typing indicators",
        sub: "Let people see when you're typing.",
        def: true,
      },
    ],
  },
};

function PreferencesModal({
  kind,
  onClose,
}: {
  kind: null | "preferences" | "privacy";
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const section = SECTIONS[kind ?? "preferences"];
  const toggle = (key: string, def: boolean) => {
    const next = { ...prefs, [key]: !(prefs[key] ?? def) };
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      // Preference applies for this session only.
    }
  };
  return (
    <Modal
      open={kind !== null}
      onOpenChange={(o) => !o && onClose()}
      title={section.title}
      width={548}
    >
      <div className="p-2">
        {section.rows.map((r) => {
          const on = prefs[r.key] ?? r.def;
          return (
            <button
              key={r.key}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(r.key, r.def)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[15px] text-primary">{r.label}</span>
                <span className="block text-[13px] text-secondary leading-4">{r.sub}</span>
              </span>
              <span
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                  on ? "bg-fb" : "bg-btn",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
                    on ? "left-[18px]" : "left-0.5",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarPlus,
  Clapperboard,
  Flag,
  Megaphone,
  NotebookPen,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { MenuGridIcon } from "@/icons";
import { PopoverPanel } from "@/ui/overlays";
import { Divider } from "@/ui/primitives";
import { HeaderButton } from "./HeaderButton";
import { SHORTCUTS, type Shortcut } from "./shortcuts";

const SECTIONS: { title: string; labels: string[] }[] = [
  { title: "Social", labels: ["Events", "Friends", "Groups", "Feeds", "Pages", "Messenger"] },
  { title: "Entertainment", labels: ["Gaming Video", "Play games", "Video", "Reels"] },
  { title: "Shopping", labels: ["Marketplace"] },
  { title: "Personal", labels: ["Memories", "Saved", "Birthdays", "Recent ad activity"] },
  { title: "Professional", labels: ["Ads Manager", "Meta AI"] },
  { title: "Community resources", labels: ["Fundraisers", "Climate Science Center"] },
];

const CREATE: { label: string; icon: ReactNode; to?: string }[] = [
  { label: "Post", icon: <NotebookPen size={20} />, to: "/" },
  { label: "Story", icon: <BookOpen size={20} />, to: "/stories/create" },
  { label: "Reel", icon: <Clapperboard size={20} />, to: "/reel" },
  { label: "Life event", icon: <Star size={20} /> },
];
const CREATE_MORE: { label: string; icon: ReactNode; to?: string }[] = [
  { label: "Page", icon: <Flag size={20} />, to: "/pages" },
  { label: "Ad", icon: <Megaphone size={20} />, to: "/ads-manager" },
  { label: "Group", icon: <Users size={20} />, to: "/groups/create" },
  { label: "Event", icon: <CalendarPlus size={20} />, to: "/events/create" },
  { label: "Marketplace listing", icon: <ShoppingBag size={20} />, to: "/marketplace/create" },
];

export function MenuDropdown() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const byLabel = new Map(SHORTCUTS.map((s) => [s.label, s]));
  const filter = (s: Shortcut) => !q || s.label.toLowerCase().includes(q.toLowerCase());

  return (
    <PopoverPanel
      open={open}
      onOpenChange={setOpen}
      width={608}
      trigger={
        <HeaderButton label="Menu" active={open}>
          <MenuGridIcon size={20} />
        </HeaderButton>
      }
    >
      <div className="flex min-h-0 flex-col bg-wash">
        <h2 className="px-4 pt-4 pb-3 font-bold text-2xl">Menu</h2>
        <div className="flex min-h-0 gap-4 overflow-y-auto px-4 pb-4">
          <div className="min-w-0 flex-1 rounded-lg bg-card p-4 shadow-base">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search menu"
              className="mb-2 h-9 w-full rounded-full bg-input px-4 text-[15px] outline-none placeholder:text-placeholder"
            />
            {SECTIONS.map((sec, i) => {
              const items = sec.labels
                .map((l) => byLabel.get(l))
                .filter((s): s is Shortcut => !!s && filter(s));
              if (items.length === 0) return null;
              return (
                <div key={sec.title}>
                  {i > 0 && <Divider className="my-3" />}
                  <h3 className="mb-1 font-semibold text-[17px]">{sec.title}</h3>
                  {items.map((s) => (
                    <Link
                      key={s.label}
                      to={s.to}
                      onClick={() => setOpen(false)}
                      className="-mx-2 flex items-start gap-3 rounded-lg p-2 hover:bg-hover"
                    >
                      <s.Icon size={36} />
                      <span className="min-w-0">
                        <span className="block font-medium text-[15px]">{s.label}</span>
                        <span className="block text-secondary text-sm">{s.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="h-fit w-[200px] shrink-0 rounded-lg bg-card p-2 shadow-base">
            <h3 className="px-2 py-1 font-bold text-lg">Create</h3>
            {CREATE.map((c) => (
              <CreateRow key={c.label} {...c} onClick={() => setOpen(false)} />
            ))}
            <Divider className="mx-2 my-2" />
            {CREATE_MORE.map((c) => (
              <CreateRow key={c.label} {...c} onClick={() => setOpen(false)} />
            ))}
          </div>
        </div>
      </div>
    </PopoverPanel>
  );
}

function CreateRow({
  label,
  icon,
  to,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick: () => void;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <span className="font-medium text-[15px]">{label}</span>
    </>
  );
  return (
    <Link
      to={to ?? "/"}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-hover"
    >
      {inner}
    </Link>
  );
}

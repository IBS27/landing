import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LogOut,
  MessageSquareWarning,
  Moon,
  Settings,
  Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { type ThemeSetting, useTheme } from "@/app/theme";
import { useViewerContext } from "@/app/viewer";
import { cn } from "@/lib/format";
import { PopoverPanel } from "@/ui/overlays";
import { Avatar, Divider, IconButton } from "@/ui/primitives";
import { api } from "../../convex/_generated/api";

type View = "main" | "profiles" | "display";

function Row({
  icon,
  label,
  sub,
  chevron,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  chevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px]">{label}</span>
        {sub && <span className="block text-secondary text-xs">{sub}</span>}
      </span>
      {chevron && <ChevronRight size={24} className="text-icon-secondary" />}
    </button>
  );
}

export function AccountMenu() {
  const { viewer, switchTo } = useViewerContext();
  const personas = useQuery(api.users.personas);
  const { setting, setSetting } = useTheme();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const navigate = useNavigate();
  if (!viewer) return null;

  const close = () => {
    setOpen(false);
    setView("main");
  };

  return (
    <PopoverPanel
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setView("main");
      }}
      width={360}
      trigger={
        <button
          type="button"
          aria-label="Your profile"
          className="relative h-10 w-10 shrink-0 rounded-full active:scale-95"
        >
          <Avatar src={viewer.avatar} size={40} />
          <span className="absolute -right-0.5 -bottom-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-nav bg-btn">
            <ChevronDown size={10} strokeWidth={3} />
          </span>
        </button>
      }
    >
      <div className="overflow-y-auto p-4">
        {view === "main" && (
          <>
            <div className="rounded-lg bg-card p-1 shadow-[0_2px_12px_var(--shadow-2)]">
              <Link
                to="/$username"
                params={{ username: viewer.username }}
                onClick={close}
                className="flex items-center gap-2 rounded-md p-2 hover:bg-hover"
              >
                <Avatar src={viewer.avatar} size={36} />
                <span className="font-semibold text-[17px]">{viewer.name}</span>
              </Link>
              <Divider className="mx-2 my-1" />
              <button
                type="button"
                onClick={() => setView("profiles")}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-btn p-2 font-semibold text-[15px] hover:brightness-95"
              >
                <Users size={18} /> See all profiles
              </button>
            </div>
            <div className="mt-4 flex flex-col">
              <Row
                icon={<Settings size={20} />}
                label="Settings & privacy"
                chevron
                onClick={() => {
                  close();
                  void navigate({ to: "/settings" });
                }}
              />
              <Row icon={<CircleHelp size={20} />} label="Help & support" chevron />
              <Row
                icon={<Moon size={20} />}
                label="Display & accessibility"
                chevron
                onClick={() => setView("display")}
              />
              <Row icon={<MessageSquareWarning size={20} />} label="Give feedback" sub="CTRL B" />
              <Row
                icon={<LogOut size={20} />}
                label="Log Out"
                onClick={() => setView("profiles")}
              />
            </div>
            <p className="mt-3 px-2 text-[13px] text-secondary leading-4">
              Privacy · Terms · Advertising · Ad Choices · Cookies · More · Meta © 2026
            </p>
          </>
        )}

        {view === "profiles" && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <IconButton label="Back" variant="ghost" onClick={() => setView("main")}>
                <ChevronLeft size={24} />
              </IconButton>
              <h2 className="font-bold text-2xl">Switch profile</h2>
            </div>
            <p className="mb-2 px-2 text-secondary text-sm">
              Demo accounts. Switching changes who you're signed in as.
            </p>
            <div className="flex flex-col">
              {personas?.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    switchTo(p._id);
                    close();
                    void navigate({ to: "/" });
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-2 text-left hover:bg-hover",
                    p._id === viewer._id && "bg-highlight",
                  )}
                >
                  <Avatar src={p.avatar} size={40} />
                  <span className="flex-1 font-medium text-[15px]">{p.name}</span>
                  {p._id === viewer._id && <span className="h-3 w-3 rounded-full bg-fb" />}
                </button>
              ))}
            </div>
          </>
        )}

        {view === "display" && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <IconButton label="Back" variant="ghost" onClick={() => setView("main")}>
                <ChevronLeft size={24} />
              </IconButton>
              <h2 className="font-bold text-2xl">Display & accessibility</h2>
            </div>
            <div className="flex gap-3 px-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn">
                <Moon size={20} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-[17px]">Dark mode</p>
                <p className="text-secondary text-sm">
                  Adjust the appearance of Facebook to reduce glare and give your eyes a break.
                </p>
                {(
                  [
                    ["light", "Off"],
                    ["dark", "On"],
                    ["auto", "Automatic"],
                  ] as [ThemeSetting, string][]
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="-mx-2 mt-1 flex cursor-pointer items-center justify-between rounded-lg p-2 hover:bg-hover"
                  >
                    <span className="font-medium text-[15px]">
                      {label}
                      {value === "auto" && (
                        <span className="block font-normal text-secondary text-xs">
                          We'll automatically adjust the display based on your device's system
                          settings.
                        </span>
                      )}
                    </span>
                    <input
                      type="radio"
                      name="theme"
                      className="h-5 w-5 accent-[var(--fb-blue)]"
                      checked={setting === value}
                      onChange={() => setSetting(value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PopoverPanel>
  );
}

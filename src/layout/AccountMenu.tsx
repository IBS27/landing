import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  CircleAlert,
  FileText,
  Inbox,
  Languages,
  List,
  LockKeyhole,
  Minimize2,
  Moon,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { type ThemeSetting, useTheme } from "@/app/theme";
import { useViewerContext } from "@/app/viewer";
import { AdChoicesGlyph, FOOTER_LINKS } from "@/features/misc/AppRail";
import { GearFilled } from "@/features/misc/icons";
import { FooterLink } from "@/features/policies/FooterLink";
import { cn } from "@/lib/format";
import { PopoverPanel } from "@/ui/overlays";
import { Avatar } from "@/ui/primitives";
import { ReportProblemDialog } from "@/ui/ReportDialog";
import { api } from "../../convex/_generated/api";

type View = "main" | "profiles" | "settings" | "help" | "display";

/* ---------- Filled glyphs (Facebook draws these solid) ---------- */

function HelpFilled() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path
        d="M7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"
        className="stroke-[#e2e5e9] dark:stroke-[#3a3b3c]"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.6" r="1.15" className="fill-[#e2e5e9] dark:fill-[#3a3b3c]" />
    </svg>
  );
}

function ReportFilled() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path
        d="M4 2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5.2l-4.1 3.3A.6.6 0 0 1 5.7 18v-3H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
        fill="currentColor"
      />
      <rect
        x="9"
        y="5"
        width="2"
        height="5.5"
        rx="1"
        className="fill-[#e2e5e9] dark:fill-[#3a3b3c]"
      />
      <circle cx="10" cy="12.6" r="1.1" className="fill-[#e2e5e9] dark:fill-[#3a3b3c]" />
    </svg>
  );
}

function LogoutFilled() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M4 1.8h6.6c.8 0 1.4.6 1.4 1.4V8.6H9.4a1.4 1.4 0 0 0 0 2.8H12v5.4c0 .8-.6 1.4-1.4 1.4H4c-.8 0-1.4-.6-1.4-1.4V3.2c0-.8.6-1.4 1.4-1.4Z" />
      <path
        d="M9.4 10h8M15 7.2l2.8 2.8-2.8 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfilesGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="6.4" r="2.4" />
      <path d="M3.9 12.3c.8-1.6 2.3-2.5 4.1-2.5s3.3.9 4.1 2.5A6 6 0 0 1 8 14a6 6 0 0 1-4.1-1.7Z" />
    </svg>
  );
}

/** Facebook's heavier submenu chevron. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-icon-secondary"
      aria-hidden
    >
      <path d="M8.5 4 16.5 12l-8 8" />
    </svg>
  );
}

/* ---------- Rows ---------- */

function Row({
  icon,
  label,
  sub,
  chevron,
  onClick,
  to,
  search,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  chevron?: boolean;
  onClick?: () => void;
  to?: "/settings" | "/feeds";
  search?: { tab?: string };
}) {
  const cls = "flex min-h-[52px] w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover";
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px] text-primary leading-5">{label}</span>
        {sub && <span className="block text-[13px] text-primary leading-4">{sub}</span>}
      </span>
      {chevron && <Chevron />}
    </>
  );
  if (to)
    return (
      <Link to={to} search={search} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
      >
        <ArrowLeft size={22} />
      </button>
      <h2 className="font-bold text-[24px] text-primary leading-7">{title}</h2>
    </div>
  );
}

function Footer({ onNavigate }: { onNavigate: () => void }) {
  return (
    <p className="mt-3 text-[13px] text-secondary leading-4">
      {FOOTER_LINKS.map((l, i) => (
        <span key={l}>
          {i > 0 && " · "}
          <FooterLink label={l} className="font-semibold hover:underline" onNavigate={onNavigate}>
            {l === "Ad Choices" && <AdChoicesGlyph />}
          </FooterLink>
        </span>
      ))}
    </p>
  );
}

/* ---------- Menu ---------- */

/** `home` is where switching profiles lands: Facebook's feed, or Landing's Home inside Landing. */
export function AccountMenu({ home = "/" }: { home?: "/" | "/landing" }) {
  const { viewer, switchTo } = useViewerContext();
  const personas = useQuery(api.users.personas);
  const { setting, setSetting } = useTheme();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [reporting, setReporting] = useState(false);
  const [compact, setCompact] = useState(false);
  const navigate = useNavigate();

  // Facebook's Ctrl+B shortcut for "Report a problem".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "b") {
        const t = e.target instanceof HTMLElement ? e.target : null;
        if (t?.closest("input,textarea,[contenteditable=true]")) return;
        e.preventDefault();
        setOpen(false);
        setReporting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!viewer) return null;

  const close = () => {
    setOpen(false);
    setView("main");
  };

  return (
    <>
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
            <span className="absolute -right-0.5 -bottom-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-nav bg-btn text-icon">
              <ChevronDown size={10} strokeWidth={3} />
            </span>
          </button>
        }
      >
        <div className="overflow-y-auto px-4 pt-3 pb-4">
          {view === "main" && (
            <>
              <div className="rounded-xl bg-card p-1 shadow-[0_2px_12px_var(--shadow-2)]">
                <Link
                  to="/$username"
                  params={{ username: viewer.username }}
                  onClick={close}
                  className="flex h-[60px] items-center gap-2 rounded-lg px-2 hover:bg-hover"
                >
                  <Avatar src={viewer.avatar} size={36} />
                  <span className="font-semibold text-[17px] text-primary">{viewer.name}</span>
                </Link>
                <div className="mx-3 my-1 h-px bg-divider" />
                <div className="px-2 pt-2 pb-2">
                  <button
                    type="button"
                    onClick={() => setView("profiles")}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-btn font-semibold text-[15px] text-primary hover:brightness-95 dark:hover:brightness-125"
                  >
                    <ProfilesGlyph /> See all profiles
                  </button>
                </div>
              </div>
              <div className="-mx-2 mt-4 flex flex-col">
                <Row
                  icon={<GearFilled />}
                  label="Settings & privacy"
                  chevron
                  onClick={() => setView("settings")}
                />
                <Row
                  icon={<HelpFilled />}
                  label="Help & support"
                  chevron
                  onClick={() => setView("help")}
                />
                <Row
                  icon={<ReportFilled />}
                  label="Report a problem"
                  sub="CTRL B"
                  onClick={() => {
                    close();
                    setReporting(true);
                  }}
                />
                <Row
                  icon={<Moon size={20} fill="currentColor" />}
                  label="Display & accessibility"
                  chevron
                  onClick={() => setView("display")}
                />
                <Row icon={<LogoutFilled />} label="Log out" onClick={() => setView("profiles")} />
              </div>
              <Footer onNavigate={close} />
            </>
          )}

          {view === "settings" && (
            <>
              <SubHeader title="Settings & privacy" onBack={() => setView("main")} />
              <Row icon={<GearFilled />} label="Settings" to="/settings" onClick={close} />
              <Row
                icon={<ShieldCheck size={20} />}
                label="Privacy Checkup"
                to="/settings"
                search={{ tab: "privacy-checkup" }}
                onClick={close}
              />
              <Row
                icon={<LockKeyhole size={20} />}
                label="Privacy Center"
                to="/settings"
                search={{ tab: "privacy-checkup" }}
                onClick={close}
              />
              <Row
                icon={<List size={20} />}
                label="Activity log"
                to="/settings"
                search={{ tab: "activity-log" }}
                onClick={close}
              />
              <Row icon={<Newspaper size={20} />} label="Feed" to="/feeds" onClick={close} />
              <Row
                icon={<Languages size={20} />}
                label="Language"
                to="/settings"
                search={{ tab: "language" }}
                onClick={close}
              />
            </>
          )}

          {view === "help" && (
            <>
              <SubHeader title="Help & support" onBack={() => setView("main")} />
              <Row
                icon={<BookOpen size={20} />}
                label="Help Center"
                to="/settings"
                search={{ tab: "learn" }}
                onClick={close}
              />
              <Row
                icon={<ShieldCheck size={20} />}
                label="Account Status"
                to="/settings"
                search={{ tab: "accounts-center" }}
                onClick={close}
              />
              <Row
                icon={<Inbox size={20} />}
                label="Support Inbox"
                to="/settings"
                search={{ tab: "learn" }}
                onClick={close}
              />
              <Row
                icon={<CircleAlert size={20} />}
                label="Report a problem"
                onClick={() => {
                  close();
                  setReporting(true);
                }}
              />
              <Row
                icon={<FileText size={20} />}
                label="Terms & Policies"
                to="/settings"
                search={{ tab: "terms" }}
                onClick={close}
              />
            </>
          )}

          {view === "profiles" && (
            <>
              <SubHeader title="Switch profile" onBack={() => setView("main")} />
              <div className="flex flex-col">
                {personas?.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      switchTo(p._id);
                      close();
                      void navigate({ to: home });
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2 text-left hover:bg-hover",
                      p._id === viewer._id && "bg-highlight",
                    )}
                  >
                    <Avatar src={p.avatar} size={40} />
                    <span className="flex-1 font-medium text-[15px] text-primary">{p.name}</span>
                    {p._id === viewer._id && <span className="h-3 w-3 rounded-full bg-fb" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === "display" && (
            <>
              <SubHeader title="Display & accessibility" onBack={() => setView("main")} />
              <DisplayGroup
                icon={<Moon size={20} fill="currentColor" />}
                title="Dark mode"
                body="Adjust the appearance of Facebook to reduce glare and give your eyes a break."
                name="theme"
                value={setting}
                onChange={(v) => setSetting(v as ThemeSetting)}
                options={[
                  ["light", "Off"],
                  ["dark", "On"],
                  [
                    "auto",
                    "Automatic",
                    "We'll automatically adjust the display based on your device's system settings.",
                  ],
                ]}
              />
              <DisplayGroup
                icon={<Minimize2 size={20} />}
                title="Compact mode"
                body="Make your font size smaller so more content can fit on the screen."
                name="compact"
                value={compact ? "on" : "off"}
                onChange={(v) => setCompact(v === "on")}
                options={[
                  ["off", "Off"],
                  ["on", "On"],
                ]}
              />
            </>
          )}
        </div>
      </PopoverPanel>
      {reporting && <ReportProblemDialog onClose={() => setReporting(false)} />}
    </>
  );
}

function DisplayGroup({
  icon,
  title,
  body,
  name,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string, string?][];
}) {
  return (
    <div className="mb-2 flex gap-3 px-2 pt-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn text-icon">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[17px] text-primary leading-5">{title}</p>
        <p className="mt-0.5 text-[13px] text-secondary leading-4">{body}</p>
        <div role="radiogroup" aria-label={title} className="mt-1">
          {options.map(([v, label, sub]) => (
            <label
              key={v}
              className="-mx-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg p-2 hover:bg-hover"
            >
              <span className="min-w-0">
                <span className="block font-medium text-[15px] text-primary">{label}</span>
                {sub && <span className="block text-[12px] text-secondary leading-4">{sub}</span>}
              </span>
              <input
                type="radio"
                name={name}
                className="h-5 w-5 shrink-0 accent-[var(--fb-blue)]"
                checked={value === v}
                onChange={() => onChange(v)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

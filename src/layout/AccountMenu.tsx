import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  Inbox,
  Languages,
  List,
  LockKeyhole,
  Megaphone,
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
import { cn } from "@/lib/format";
import { Modal, PopoverPanel } from "@/ui/overlays";
import { Avatar, Button } from "@/ui/primitives";
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
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5V7h-2V4H5v12h6v-3h2v3.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 16.5Z" />
      <path d="M14.3 6.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4l1.3-1.3H9a1 1 0 1 1 0-2h6.6l-1.3-1.3a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function ProfilesGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.6" />
      <circle cx="8" cy="6.6" r="2.2" />
      <path d="M4.2 12.4c.9-1.5 2.2-2.2 3.8-2.2s2.9.7 3.8 2.2" />
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
      {chevron && <ChevronRight size={24} strokeWidth={2} className="text-icon-secondary" />}
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

function Footer() {
  return (
    <p className="mt-2 px-2 text-[13px] text-secondary leading-4">
      {FOOTER_LINKS.map((l, i) => (
        <span key={l}>
          {i > 0 && " · "}
          <button type="button" className="font-semibold hover:underline">
            {l}
            {l === "Ad Choices" && <AdChoicesGlyph />}
          </button>
        </span>
      ))}
      {" · Meta © 2026"}
    </p>
  );
}

/* ---------- Menu ---------- */

export function AccountMenu() {
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
                  className="flex h-[60px] items-center gap-3 rounded-lg px-3 hover:bg-hover"
                >
                  <Avatar src={viewer.avatar} size={36} />
                  <span className="font-semibold text-[17px] text-primary">{viewer.name}</span>
                </Link>
                <div className="mx-3 my-1 h-px bg-divider" />
                <div className="p-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setView("profiles")}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-btn font-semibold text-[15px] text-primary hover:brightness-95 dark:hover:brightness-125"
                  >
                    <ProfilesGlyph /> See all profiles
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-col">
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
              <Footer />
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
                      void navigate({ to: "/" });
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
      {reporting && <ReportDialog onClose={() => setReporting(false)} />}
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

function ReportDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<"improve" | "broken" | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Report a problem"
      width={500}
      onBack={kind && !sent ? () => setKind(null) : undefined}
    >
      {sent ? (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <p className="font-bold text-[20px] text-primary">Thanks for your feedback</p>
          <p className="mt-1 text-[15px] text-secondary">
            We use reports like this to help improve Facebook.
          </p>
          <Button variant="primary" className="mt-5" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : kind === null ? (
        <div className="p-2">
          <Row
            icon={<Megaphone size={20} />}
            label="Help us improve Facebook"
            sub="Tell us how we can make Facebook better."
            chevron
            onClick={() => setKind("improve")}
          />
          <Row
            icon={<CircleAlert size={20} />}
            label="Something went wrong"
            sub="Let us know about a broken feature."
            chevron
            onClick={() => setKind("broken")}
          />
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) setSent(true);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "broken"
                ? "Briefly explain what happened or what's not working."
                : "Tell us what you'd like to see improved."
            }
            aria-label="Details"
            className="min-h-[120px] resize-none rounded-md border border-divider bg-card p-3 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb"
          />
          <Button type="submit" variant="primary" block disabled={!text.trim()}>
            Send
          </Button>
        </form>
      )}
    </Modal>
  );
}

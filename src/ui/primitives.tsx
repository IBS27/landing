import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/format";

/* ---------- Card ---------- */

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("rounded-lg bg-card shadow-base", className)} {...props} />;
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-4 pt-4 pb-2", className)}>
      <h2 className="font-bold text-lg text-primary">{title}</h2>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-divider", className)} />;
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "floating" | "link";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-btn-primary text-white hover:bg-btn-primary-hover",
  secondary: "bg-btn text-btn-text hover:brightness-95 dark:hover:brightness-125",
  soft: "bg-btn-soft text-btn-soft-text hover:brightness-95 dark:hover:brightness-125",
  ghost: "bg-transparent text-secondary hover:bg-hover",
  floating: "bg-btn-floating text-primary shadow-base hover:brightness-95",
  link: "bg-transparent text-link hover:underline px-0",
};
const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-3 text-base",
  lg: "h-10 px-4 text-base",
};

export type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-[filter,background-color] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-btn disabled:text-disabled disabled:active:scale-100",
        variantClass[variant],
        sizeClass[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = ComponentPropsWithoutRef<"button"> & {
  label: string;
  size?: 28 | 32 | 36 | 40;
  variant?: "secondary" | "ghost" | "floating" | "active";
};

/** Round icon button (header circles, card close buttons, chat header actions). */
export function IconButton({
  label,
  size = 36,
  variant = "secondary",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={props.title}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full text-icon transition-colors active:scale-95",
        variant === "secondary" && "bg-btn hover:brightness-95 dark:hover:brightness-125",
        variant === "ghost" && "bg-transparent hover:bg-hover",
        variant === "floating" && "bg-btn-floating shadow-emphasis hover:brightness-95",
        variant === "active" && "bg-highlight text-accent",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({
  src,
  alt = "",
  size = 40,
  online,
  ring,
  live,
  square,
  className,
}: {
  src: string;
  alt?: string;
  size?: number;
  online?: boolean;
  /** Blue story ring. */
  ring?: boolean;
  /** Red ring while the person is broadcasting live. */
  live?: boolean;
  /** Groups and pages use rounded squares. */
  square?: boolean;
  className?: string;
}) {
  const dot = Math.max(8, Math.round(size * 0.25));
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        className={cn(
          "h-full w-full object-cover",
          square ? "rounded-lg" : "rounded-full",
          ring && "outline-[3px] outline-fb outline-offset-0 border-2 border-card",
          live && "outline-2 outline-[#F02849] outline-offset-0 border-2 border-card",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 border border-black/10 dark:border-white/5",
          square ? "rounded-lg" : "rounded-full",
        )}
      />
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-card bg-online"
          style={{
            width: dot + 2,
            height: dot + 2,
            right: size > 40 ? size * 0.04 : -1,
            bottom: size > 40 ? size * 0.04 : -1,
          }}
        />
      )}
    </span>
  );
}

/* ---------- Text bits ---------- */

export function VerifiedBadge({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 13"
      width={size}
      height={size}
      className={cn("inline-block shrink-0 text-fb", className)}
      aria-label="Verified account"
      role="img"
    >
      <path
        fill="currentColor"
        d="M5.07.5a1.5 1.5 0 0 1 1.86 0l.72.57c.16.13.37.2.58.2l.92-.02a1.5 1.5 0 0 1 1.5 1.1l.25.88c.06.2.19.38.36.5l.75.54a1.5 1.5 0 0 1 .57 1.77l-.3.87a1 1 0 0 0 0 .63l.3.87a1.5 1.5 0 0 1-.57 1.77l-.75.54a1 1 0 0 0-.36.5l-.25.89a1.5 1.5 0 0 1-1.5 1.09l-.92-.02a1 1 0 0 0-.58.2l-.72.57a1.5 1.5 0 0 1-1.86 0l-.72-.57a1 1 0 0 0-.58-.2l-.92.02a1.5 1.5 0 0 1-1.5-1.1l-.25-.88a1 1 0 0 0-.36-.5L.92 9.63a1.5 1.5 0 0 1-.57-1.77l.3-.87a1 1 0 0 0 0-.63l-.3-.87A1.5 1.5 0 0 1 .92 3.73l.75-.54a1 1 0 0 0 .36-.5l.25-.89A1.5 1.5 0 0 1 3.78.7l.92.02a1 1 0 0 0 .58-.2Z"
      />
      <path
        fill="#fff"
        d="M8.4 4.4a.6.6 0 0 1 0 .85L5.6 8.05a.6.6 0 0 1-.85 0L3.6 6.9a.6.6 0 1 1 .85-.85l.73.73 2.37-2.38a.6.6 0 0 1 .85 0Z"
      />
    </svg>
  );
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-badge px-[5px] font-semibold text-[12px] text-white leading-none",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("animate-spin text-secondary", className)}
      aria-label="Loading"
      role="img"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".2"
        strokeWidth="3"
      />
      <path
        d="M22 12A10 10 0 0 0 12 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Grey placeholder block used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-btn", className)} />;
}

/* ---------- List rows (left rails, menus, search results) ---------- */

type RowProps = {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

/** The ubiquitous Facebook navigation row: 36px icon, label, optional subtitle, hover wash. */
export function NavRow({
  icon,
  label,
  sub,
  trailing,
  active,
  className,
  onClick,
  to,
  params,
  search,
}: RowProps) {
  const inner = (
    <>
      {icon && <span className="flex shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[15px] text-primary leading-5">
          {label}
        </span>
        {sub && <span className="block truncate text-secondary text-sm">{sub}</span>}
      </span>
      {trailing}
    </>
  );
  const cls = cn(
    "flex w-full min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
    active ? "bg-highlight" : "hover:bg-hover",
    className,
  );
  if (to)
    return (
      <Link to={to} params={params} search={search} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 pt-3 pb-1">
      <h3 className="font-semibold text-[17px] text-secondary">{children}</h3>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-secondary">{icon}</div>}
      <p className="font-bold text-lg text-secondary">{title}</p>
      {body && <p className="mt-1 max-w-sm text-secondary text-base">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

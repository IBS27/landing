import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/overlays";
import { FOOTER_SLUGS, POLICIES } from "./policies";

/**
 * One page-footer link (Privacy · Terms · Advertising · Ad Choices · Cookies ·
 * More): a policy page, or for "More" a small menu of Meta links.
 */
export function FooterLink({
  label,
  className,
  children,
  onNavigate,
}: {
  label: string;
  className?: string;
  /** Extra content after the label (the Ad Choices glyph). */
  children?: ReactNode;
  /** Close the surrounding panel (account menu) on navigation. */
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const slug = FOOTER_SLUGS[label];
  if (slug)
    return (
      <Link
        to="/policies/$page"
        params={{ page: slug }}
        onClick={onNavigate}
        className={className ?? "hover:underline"}
      >
        {label}
        {children}
      </Link>
    );
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button type="button" className={className ?? "hover:underline"}>
          {label}
          {children}
        </button>
      </MenuTrigger>
      <MenuContent width={220} align="start">
        {POLICIES.filter((p) => p.group === "more").map((p) => (
          <MenuItem
            key={p.slug}
            label={p.title}
            onSelect={() => {
              onNavigate?.();
              void navigate({ to: "/policies/$page", params: { page: p.slug } });
            }}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

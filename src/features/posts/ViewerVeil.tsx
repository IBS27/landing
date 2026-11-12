import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Marks a full-screen viewer's own root so it doesn't count as a dialog on top of it. */
export const VIEWER_ATTR = "data-fullscreen-viewer";

const OPEN_DIALOG = `[role=dialog][data-state=open]:not([${VIEWER_ATTR}])`;

/**
 * The shared modal scrim leaves the header's corner clusters undimmed (the
 * TopNav sits above it). Full-screen viewers cover the TopNav, so while a
 * dialog is open over one, veil those two corners too for an even scrim.
 */
export function ViewerCornerVeils() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Header dropdowns are popovers (role=dialog too) and don't dim anything.
    const check = () =>
      setOpen(
        [...document.querySelectorAll(OPEN_DIALOG)].some(
          (el) => !el.closest("[data-radix-popper-content-wrapper]"),
        ),
      );
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => mo.disconnect();
  }, []);
  if (!open) return null;
  // Light mode only: in dark mode the header veil already matches the scrim.
  const veil = "pointer-events-none fixed top-0 z-[61] h-14 bg-[rgba(244,244,244,0.8)] dark:hidden";
  return createPortal(
    <>
      <div aria-hidden className={`${veil} left-0 w-[320px]`} />
      <div aria-hidden className={`${veil} right-0 w-[208px]`} />
    </>,
    document.body,
  );
}

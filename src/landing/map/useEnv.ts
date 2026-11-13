import { type RefObject, useEffect, useState } from "react";

const readDark = () => document.documentElement.classList.contains("dark");

/** Whether the app is in dark mode right now (`.dark` on <html>, set by the theme provider). */
export function useIsDark() {
  const [dark, setDark] = useState(readDark);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(readDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Whether a media query matches, kept current. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** An element's width, kept current as it resizes. */
export function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return width;
}

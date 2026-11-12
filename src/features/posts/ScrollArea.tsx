import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/**
 * Facebook's dialog scroller: native scrolling with the native bar hidden and
 * an 8px rounded thumb drawn 4px from the right edge (draggable), so it shows
 * the same on every platform, including overlay-scrollbar systems.
 */
export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const drag = useRef<{ y: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 1) return setThumb(null);
      const height = Math.max(32, (clientHeight * clientHeight) / scrollHeight);
      const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
      setThumb({ top, height });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(inner);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!drag.current || !el || !thumb) return;
    const ratio = (el.scrollHeight - el.clientHeight) / (el.clientHeight - thumb.height);
    el.scrollTop = drag.current.scrollTop + (e.clientY - drag.current.y) * ratio;
  };

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div ref={scroller} className="scrollbar-none h-full overflow-y-auto overscroll-contain">
        <div ref={content}>{children}</div>
      </div>
      {thumb && (
        <div
          aria-hidden
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, scrollTop: scroller.current?.scrollTop ?? 0 };
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          className="absolute right-1 w-2 rounded-full bg-secondary"
          style={{ top: thumb.top, height: thumb.height }}
        />
      )}
    </div>
  );
}

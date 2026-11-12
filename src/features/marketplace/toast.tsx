import { useCallback, useEffect, useRef, useState } from "react";

/** Facebook's bottom-left snackbar. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const node = msg ? (
    <div
      role="status"
      className="fixed bottom-6 left-6 z-[70] max-w-sm rounded-lg bg-[#242526] px-4 py-3 text-[15px] text-white shadow-elevated dark:bg-[#e4e6eb] dark:text-[#050505]"
    >
      {msg}
    </div>
  ) : null;
  return { show, node };
}

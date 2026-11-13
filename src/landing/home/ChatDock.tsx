import { ArrowUp } from "lucide-react";
import { type FormEvent, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { CHAT_MESSAGE_MAX, pageHref } from "../../../convex/lib/homeChatRules";
import { ItemCards, type RentalActions, RentalCards, SavedLine, Sources, Tally } from "./ChatCards";
import type { ChatMessage } from "./useChatLog";

/** Where the City Profile source goes, which a reply carries when it saved something. */
const PROFILE_HREF = pageHref("profile");

/** Where a chip goes: a chat message, or something the page does itself. */
export type Chip = { label: string; run?: () => void };
/** What the chat is waiting for: Muse's answer, or the furnishing picks. */
export type Pending = "answer" | "furnish" | null;

/**
 * The chat dock, shared by the Map and Apartment tabs: the last two messages
 * as glass bubbles over the stage, with the cards a reply carries (rentals to
 * choose from, pieces placed in the apartment) under its bubble. Scroll over
 * them for older ones; the stage never scrolls from here. Then suggestions
 * and the "Ask Muse" input.
 */
export function ChatDock({
  messages,
  chips,
  pending,
  onSend,
  onSource,
  rentals,
  focusedItem,
  onFocusItem,
}: {
  messages: readonly ChatMessage[];
  chips: readonly Chip[];
  pending: Pending;
  onSend: (text: string) => void;
  /** Follows a source link. The page only ever follows one inside the app. */
  onSource: (href: string) => void;
  rentals: RentalActions;
  focusedItem: string | null;
  onFocusItem: (itemId: string) => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [more, setMore] = useState(false);

  // The log is as tall as its last two turns (CSS caps it against the
  // stage), scrolled to the newest. Cards have fixed heights, so nothing
  // shifts after this; a resize re-measures wrapped text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when messages or the pending bubble change.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const fit = (toEnd: boolean) => {
      // Cards are tall enough over the stage already: a turn with them stands
      // alone, and the turn after one doesn't bring it back into view.
      const turns = [...el.children].slice(-2) as HTMLElement[];
      const items = turns.some((t) => t.querySelector(".lh-cards")) ? turns.slice(-1) : turns;
      const gap = Number.parseFloat(getComputedStyle(el).rowGap) || 0;
      const h = items.reduce((sum, c) => sum + c.offsetHeight, 0) + (items.length - 1) * gap + 8;
      el.style.setProperty("--lh-log-h", `${h}px`);
      if (toEnd) el.scrollTop = el.scrollHeight;
      setMore(el.scrollTop > 2);
    };
    fit(true);
    let width = el.clientWidth;
    let frame = 0;
    const obs = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      // Next frame: resizing the log inside its own observer would loop.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fit(false));
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [messages, pending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending || !text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="lh-dock">
      <div
        ref={log}
        role="log"
        aria-label="Chat with Muse"
        className={cn("lh-log", more && "lh-more")}
        onScroll={(e) => setMore(e.currentTarget.scrollTop > 2)}
        onWheel={(e) => e.stopPropagation()}
      >
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            onSource={onSource}
            rentals={rentals}
            focusedItem={focusedItem}
            onFocusItem={onFocusItem}
          />
        ))}
        {pending && (
          <div className="lh-turn">
            <div
              className="lh-msg lh-muse lh-glass flex items-center gap-2 text-secondary"
              role="status"
            >
              <span className="lh-typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {pending === "furnish" ? (
                <span className="text-[14px]">Picking pieces for your place…</span>
              ) : (
                <span className="sr-only">Muse is answering</span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={!!pending && !c.run}
            onClick={() => (c.run ? c.run() : onSend(c.label))}
            className="lh-glass lh-focus rounded-full px-3 py-1.5 text-[13px] text-primary shadow-base hover:brightness-95 disabled:opacity-50 dark:hover:brightness-125"
          >
            {c.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="lh-input lh-glass bg-card">
        <span
          aria-hidden
          className="bg-gradient-to-r from-[#0866ff] via-[#8b3dff] to-[#ff4f8b] bg-clip-text text-[16px] text-transparent"
        >
          ✦
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MESSAGE_MAX}
          placeholder="Ask Muse"
          aria-label="Ask Muse"
          className="min-w-0 flex-1 bg-transparent px-1.5 text-[16px] text-primary outline-none placeholder:text-secondary"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || !!pending}
          className="lh-focus flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0b0c0f] text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          <ArrowUp size={16} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

/** One turn: the bubble, then what it saved and the cards it carries. */
function Message({
  message: m,
  onSource,
  rentals,
  focusedItem,
  onFocusItem,
}: {
  message: ChatMessage;
  onSource: (href: string) => void;
  rentals: RentalActions;
  focusedItem: string | null;
  onFocusItem: (itemId: string) => void;
}) {
  if (m.who === "me")
    return (
      <div className="lh-turn">
        <div className="lh-msg lh-me">{m.text}</div>
      </div>
    );
  // Don't cite twice what the turn already links: an item card names its listing and its
  // price, and the "Saved" line goes to the City Profile.
  const linked = new Set(m.items?.map((i) => `/marketplace/item/${i.listingId}`));
  if (m.saved?.length) linked.add(PROFILE_HREF);
  const sources = m.sources?.filter((s) => !s.href || !linked.has(s.href)) ?? [];
  return (
    <div className="lh-turn">
      <div className="lh-msg lh-muse lh-glass text-primary">
        {m.text}
        {m.tally && <Tally tally={m.tally} />}
        {sources.length || m.via ? (
          <div className="mt-1.5 flex flex-wrap gap-x-1.5 text-[11px] text-secondary">
            <Sources sources={sources} onSource={onSource} className="max-w-full truncate" dots />
            {m.via && (
              <span>
                {sources.length > 0 && "· "}
                {m.via === "muse"
                  ? "Answered by Muse"
                  : m.via === "rules"
                    ? "Answered by Landing's rules (AI off)"
                    : "From Landing"}
              </span>
            )}
          </div>
        ) : null}
      </div>
      {m.saved?.length ? <SavedLine saved={m.saved} /> : null}
      {m.rentals?.length ? (
        <RentalCards rentals={m.rentals} actions={rentals} onSource={onSource} />
      ) : null}
      {m.items?.length ? (
        <ItemCards items={m.items} focused={focusedItem} onFocusItem={onFocusItem} />
      ) : null}
    </div>
  );
}

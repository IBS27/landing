import { ArrowUp, MessageSquarePlus, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Avatar } from "@/ui/primitives";
import { AppRail, AppRailHeading } from "./AppRail";
import { MetaAIRing } from "./icons";

type Msg = { id: number; from: "you" | "ai"; text: string };
type Chat = { id: number; title: string; messages: Msg[] };

const SUGGESTIONS = [
  { title: "Plan a rainy day", body: "in Seattle with indoor things to do" },
  { title: "Write a caption", body: "for a photo of my dog at the beach" },
  { title: "Suggest a recipe", body: "using salmon, rice and whatever greens I have" },
  { title: "Help me reply", body: "to a friend's birthday post" },
];

/**
 * Local, offline replies. The clone makes no external calls, so Meta AI
 * answers from a small set of topic templates.
 */
function reply(prompt: string, firstName: string): string {
  const p = prompt.toLowerCase();
  if (/^(hi|hey|hello|yo|sup)\b/.test(p) && p.length < 24)
    return `Hi ${firstName}! I'm Meta AI. Ask me to plan something, write a post, or explain a topic and I'll take it from there.`;
  if (
    p.includes("rain") ||
    p.includes("weekend") ||
    p.includes("things to do") ||
    p.includes("seattle")
  )
    return [
      "Here's a cozy rainy-day plan for Seattle:",
      "",
      "1. Morning: coffee and a pastry on Capitol Hill, then browse a bookstore in Fremont.",
      "2. Midday: Pike Place Market for lunch (go early to beat the crowds).",
      "3. Afternoon: an indoor climbing session or a museum on the waterfront.",
      "4. Evening: ramen in the U District and a board game night.",
      "",
      "Want me to turn this into an event and invite friends?",
    ].join("\n");
  if (p.includes("caption"))
    return [
      "A few caption ideas:",
      "",
      '• "Salt water, sandy paws, zero regrets."',
      '• "He found the one stick he was looking for."',
      '• "Beach day: 10/10, would zoom again."',
      "",
      "Tell me the vibe (funny, sweet, short) and I'll tailor one.",
    ].join("\n");
  if (p.includes("recipe") || p.includes("cook") || p.includes("dinner") || p.includes("salmon"))
    return [
      "Try a 20-minute salmon rice bowl:",
      "",
      "1. Season salmon with salt, pepper and a little soy sauce; roast at 425°F for 10–12 minutes.",
      "2. Warm the rice and wilt your greens in a pan with garlic and sesame oil.",
      "3. Flake the salmon over the rice and greens; finish with sesame seeds and a squeeze of lime.",
      "",
      "Want a sauce to go with it?",
    ].join("\n");
  if (p.includes("birthday"))
    return `Here's a warm reply you could post: "Happy birthday! Hope this year brings you as much joy as you bring everyone around you. Let's celebrate soon 🎉" — want it funnier or shorter?`;
  if (p.includes("joke") || p.includes("funny"))
    return "Why did the coffee file a police report? It got mugged. ☕";
  if (p.includes("who are you") || p.includes("what can you do"))
    return "I'm Meta AI, an assistant built into Facebook. I can help you brainstorm, write posts and messages, plan events, and answer questions.";
  return `Good question. Here's a starting point on "${prompt.trim()}":\n\n• Break it into the outcome you want and the first small step.\n• Share what you already know and what's blocking you.\n• I can draft a post, a message, or a checklist from there.\n\nWhat would be most useful?`;
}

/** /meta-ai — a Meta AI chat with local, canned responses. */
export function MetaAIPage() {
  const viewer = useViewer();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const active = chats.find((c) => c.id === activeId) ?? null;

  // Follow the conversation as replies stream in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run whenever the chat content changes
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    const msg: Msg = { id: nextId.current++, from: "you", text: t };
    let chatId = activeId;
    if (chatId === null) {
      chatId = nextId.current++;
      const id = chatId;
      setChats((cs) => [{ id, title: t.slice(0, 40), messages: [msg] }, ...cs]);
      setActiveId(id);
    } else {
      const id = chatId;
      setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, msg] } : c)));
    }
    setDraft("");
    setTyping(true);
    const full = reply(t, viewer.firstName);
    const aiId = nextId.current++;
    const id = chatId;
    // Stream the answer in word by word.
    const words = full.split(/(\s+)/);
    let i = 0;
    const tick = () => {
      i += 3;
      const partial = words.slice(0, i).join("");
      setChats((cs) =>
        cs.map((c) => {
          if (c.id !== id) return c;
          const rest = c.messages.filter((m) => m.id !== aiId);
          return { ...c, messages: [...rest, { id: aiId, from: "ai", text: partial }] };
        }),
      );
      if (i < words.length) setTimeout(tick, 30);
      else setTyping(false);
    };
    setTimeout(tick, 450);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] items-stretch">
      <AppRail
        title="Meta AI"
        label="Meta AI chats"
        action={
          <button
            type="button"
            aria-label="New chat"
            onClick={() => {
              setActiveId(null);
              input.current?.focus();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
          >
            <SquarePen size={18} />
          </button>
        }
      >
        <button
          type="button"
          onClick={() => {
            setActiveId(null);
            input.current?.focus();
          }}
          className={cn(
            "flex min-h-[52px] items-center gap-3 rounded-lg px-2 text-left",
            activeId === null ? "bg-wash dark:bg-hover" : "hover:bg-hover",
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-icon">
            <MessageSquarePlus size={20} />
          </span>
          <span className="font-medium text-[15px] text-primary">New chat</span>
        </button>
        {chats.length > 0 && <AppRailHeading>Recent</AppRailHeading>}
        {chats.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex min-h-11 items-center rounded-lg pr-1",
              c.id === activeId ? "bg-wash dark:bg-hover" : "hover:bg-hover",
            )}
          >
            <button
              type="button"
              onClick={() => setActiveId(c.id)}
              className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[15px] text-primary"
            >
              {c.title}
            </button>
            <button
              type="button"
              aria-label="Delete chat"
              onClick={() => {
                setChats((cs) => cs.filter((x) => x.id !== c.id));
                if (activeId === c.id) setActiveId(null);
              }}
              className="invisible flex h-8 w-8 items-center justify-center rounded-full text-icon-secondary hover:bg-hover group-hover:visible"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </AppRail>

      <main className="flex min-w-0 flex-1 flex-col bg-card">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 py-8">
            {!active ? (
              <div className="flex flex-col items-center pt-[8vh] text-center">
                <MetaAIRing size={72} />
                <h1 className="mt-4 font-bold text-[28px] text-primary leading-8">
                  Ask Meta AI anything
                </h1>
                <p className="mt-2 max-w-md text-[15px] text-secondary">
                  Get answers, brainstorm ideas and write posts, right here on Facebook.
                </p>
                <div className="mt-8 grid w-full grid-cols-2 gap-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => send(`${s.title} ${s.body}`)}
                      className="rounded-xl border border-divider px-4 py-3 text-left transition-colors hover:bg-hover"
                    >
                      <span className="block font-semibold text-[15px] text-primary">
                        {s.title}
                      </span>
                      <span className="block text-[13px] text-secondary">{s.body}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              active.messages.map((m) =>
                m.from === "you" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[75%] whitespace-pre-wrap rounded-[18px] bg-fb px-3 py-2 text-[15px] text-white leading-5">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <MetaAIRing size={28} className="mt-0.5 shrink-0" />
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] text-primary leading-[22px]">
                      {m.text}
                    </p>
                  </div>
                ),
              )
            )}
            {typing && active && active.messages[active.messages.length - 1]?.from === "you" && (
              <div className="flex items-center gap-3">
                <MetaAIRing size={28} className="animate-spin [animation-duration:1.4s]" />
                <span className="text-[13px] text-secondary">Meta AI is thinking…</span>
              </div>
            )}
          </div>
        </div>
        <form
          className="mx-auto w-full max-w-[760px] px-6 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-[24px] bg-input py-1.5 pr-1.5 pl-3">
            <Avatar src={viewer.avatar} size={28} className="mb-1" />
            <textarea
              ref={input}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask Meta AI anything..."
              aria-label="Ask Meta AI anything"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder [field-sizing:content]"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim() || typing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fb text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </div>
          <p className="mt-2 text-center text-[12px] text-secondary">
            Messages are generated by AI and may be inaccurate or inappropriate.
          </p>
        </form>
      </main>
    </div>
  );
}

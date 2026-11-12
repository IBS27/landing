import { X } from "lucide-react";
import { Popover as P } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useM } from "@/app/viewer";
import { mediaSize, uploadFile } from "@/features/posts/util";
import { cn } from "@/lib/format";
import { Tooltip } from "@/ui/overlays";
import { Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CloseIcon,
  GifIcon,
  ImageIcon,
  PlusCircleIcon,
  SendArrowIcon,
  SmileIcon,
  StickerIcon,
  ThumbIcon,
} from "./icons";
import { EMOJIS, type Message, STICKERS } from "./util";

type Variant = "dock" | "page";
type Staged = { id: string; file: File; preview: string };

const TYPING_THROTTLE_MS = 3_000;

/**
 * Messenger composer: attachment icons, "Aa" input with emoji picker, and the
 * send arrow (or the chat's quick-reaction emoji when empty).
 *
 * `conversationId` may be null for a brand-new chat; `ensureConversation`
 * then creates it on first send.
 */
export function Composer({
  conversationId,
  ensureConversation,
  emoji = "👍",
  variant,
  replyTo,
  replyName,
  onCancelReply,
  onSent,
  autoFocus,
  disabled,
}: {
  conversationId: Id<"conversations"> | null;
  ensureConversation?: () => Promise<Id<"conversations">>;
  emoji?: string;
  variant: Variant;
  replyTo?: Message | null;
  replyName?: string;
  onCancelReply?: () => void;
  onSent?: (id: Id<"conversations">) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const send = useM(api.messenger.send);
  const setTyping = useM(api.messenger.setTyping);
  const generateUploadUrl = useM(api.messenger.generateUploadUrl);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  const hasContent = text.trim().length > 0 || staged.length > 0;
  const iconSize = variant === "dock" ? 20 : 20;
  const btn = variant === "dock" ? "h-9 w-9" : "h-9 w-9";

  // Stop the typing indicator when leaving the thread.
  useEffect(() => {
    return () => {
      if (conversationId && lastTyping.current)
        void setTyping({ conversationId, typing: false }).catch(() => {});
    };
  }, [conversationId, setTyping]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, variant === "dock" ? 100 : 160)}px`;
  };

  const onChange = (value: string) => {
    setText(value);
    setCollapsed(true);
    if (!conversationId) return;
    const now = Date.now();
    if (value.trim() && now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now;
      void setTyping({ conversationId, typing: true }).catch(() => {});
    } else if (!value.trim() && lastTyping.current) {
      lastTyping.current = 0;
      void setTyping({ conversationId, typing: false }).catch(() => {});
    }
  };

  const target = async () => conversationId ?? (await ensureConversation?.()) ?? null;

  const submit = async (opts?: { sticker?: string }) => {
    if (sending || disabled) return;
    const body = text.trim();
    const files = staged;
    if (!opts?.sticker && !body && files.length === 0) return;
    setSending(true);
    setText("");
    setStaged([]);
    requestAnimationFrame(resize);
    try {
      const id = await target();
      if (!id) throw new Error("No conversation");
      const images = await Promise.all(
        files.map(async (s) => {
          const [url, size] = await Promise.all([generateUploadUrl({}), mediaSize(s.file)]);
          const storageId = (await uploadFile(url, s.file)) as Id<"_storage">;
          return { storageId, width: size.width, height: size.height };
        }),
      );
      lastTyping.current = 0;
      await send({
        conversationId: id,
        text: opts?.sticker ? undefined : body || undefined,
        images: opts?.sticker ? undefined : images,
        sticker: opts?.sticker,
        replyToId: replyTo?._id,
      });
      if (opts?.sticker && (body || files.length)) {
        // A sticker sent mid-draft leaves the draft alone.
        setText(body);
        setStaged(files);
      } else {
        for (const s of files) URL.revokeObjectURL(s.preview);
      }
      onCancelReply?.();
      onSent?.(id);
    } catch {
      setText(body);
      setStaged(files);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...list]
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    setStaged((s) => [...s, ...next]);
    inputRef.current?.focus();
  };

  const insertEmoji = (e: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const value = text.slice(0, start) + e + text.slice(end);
    onChange(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + e.length, start + e.length);
      resize();
    });
  };

  const showIcons = !text.trim() || !collapsed;

  return (
    <div className="shrink-0">
      {replyTo && (
        <div className="flex items-start gap-2 border-divider border-t px-3 pt-2 pb-1">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-primary leading-4">
              Replying to <b className="font-semibold">{replyName}</b>
            </p>
            <p className="truncate text-[12px] text-secondary leading-4">
              {replyTo.text ??
                (replyTo.attachments.some((a) => a.kind === "image") ? "Photo" : "Attachment")}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="flex h-6 w-6 items-center justify-center rounded-full text-icon-secondary hover:bg-hover"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}
      <div className={cn("flex items-end gap-0.5", variant === "dock" ? "px-1 py-2" : "px-3 py-3")}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {showIcons ? (
          <>
            <ComposerButton
              label="Open more actions"
              className={btn}
              onClick={() => fileRef.current?.click()}
            >
              <PlusCircleIcon size={iconSize} />
            </ComposerButton>
            <ComposerButton
              label="Attach a file"
              className={btn}
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon size={iconSize} />
            </ComposerButton>
            <PickerButton
              label="Choose a sticker"
              className={btn}
              icon={<StickerIcon size={iconSize} />}
            >
              {(close) => (
                <div className="w-[280px] p-2">
                  <p className="px-1 pb-2 font-semibold text-[15px] text-primary">Stickers</p>
                  <div className="grid grid-cols-5 gap-1">
                    {STICKERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          close();
                          void submit({ sticker: s });
                        }}
                        className="flex h-12 items-center justify-center rounded-lg text-[32px] hover:bg-hover"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PickerButton>
            <PickerButton label="Choose a GIF" className={btn} icon={<GifIcon size={iconSize} />}>
              {() => <GifPanel />}
            </PickerButton>
          </>
        ) : (
          <ComposerButton
            label="Open more actions"
            className={btn}
            onClick={() => setCollapsed(false)}
          >
            <PlusCircleIcon size={iconSize} />
          </ComposerButton>
        )}

        <div className="mx-1 flex min-w-0 flex-1 flex-col rounded-[20px] bg-input">
          {staged.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
              {staged.map((s) => (
                <div key={s.id} className="relative shrink-0">
                  <img src={s.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => {
                      URL.revokeObjectURL(s.preview);
                      setStaged((x) => x.filter((y) => y.id !== s.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card text-icon shadow-base"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label="Add photos"
                onClick={() => fileRef.current?.click()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-btn text-icon"
              >
                <ImageIcon size={20} />
              </button>
            </div>
          )}
          <div className="flex items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              disabled={disabled}
              // biome-ignore lint/a11y/noAutofocus: opening a chat focuses its composer, like Facebook
              autoFocus={autoFocus}
              aria-label="Message"
              placeholder="Aa"
              onChange={(e) => {
                onChange(e.target.value);
                resize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
              onPaste={(e) => {
                if (e.clipboardData.files.length) addFiles(e.clipboardData.files);
              }}
              className="block max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 pl-3 text-[15px] text-primary leading-5 outline-none placeholder:text-placeholder"
            />
            <PickerButton
              label="Choose an emoji"
              className="h-9 w-9 shrink-0"
              icon={<SmileIcon size={20} />}
              keepFocus
            >
              {() => (
                <div className="w-[300px] p-2">
                  <div className="grid max-h-[220px] grid-cols-8 gap-0.5 overflow-y-auto">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => insertEmoji(e)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[22px] hover:bg-hover"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PickerButton>
          </div>
        </div>

        {hasContent ? (
          <ComposerButton label="Press Enter to send" className={btn} onClick={() => void submit()}>
            {sending ? <Spinner size={18} /> : <SendArrowIcon size={iconSize} />}
          </ComposerButton>
        ) : (
          <ComposerButton
            label={`Send a ${emoji === "👍" ? "Like" : emoji}`}
            className={btn}
            onClick={() => void submit({ sticker: emoji })}
          >
            {emoji === "👍" ? (
              <ThumbIcon size={iconSize} />
            ) : (
              <span className="text-[20px] leading-none">{emoji}</span>
            )}
          </ComposerButton>
        )}
      </div>
    </div>
  );
}

function ComposerButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-fb transition-colors hover:bg-hover",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function PickerButton({
  label,
  icon,
  className,
  keepFocus,
  children,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  keepFocus?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <Tooltip content={label} side="top">
        <P.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "flex items-center justify-center rounded-full text-fb transition-colors hover:bg-hover",
              className,
            )}
          >
            {icon}
          </button>
        </P.Trigger>
      </Tooltip>
      <P.Portal>
        <P.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={keepFocus ? (e) => e.preventDefault() : undefined}
          className="z-[70] rounded-lg bg-popover shadow-elevated outline-none"
        >
          {children(() => setOpen(false))}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function GifPanel() {
  const [q, setQ] = useState("");
  return (
    <div className="w-[280px] p-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        aria-label="Search GIFs"
        className="h-9 w-full rounded-full bg-input px-3 text-[15px] text-primary outline-none placeholder:text-placeholder"
      />
      <p className="px-2 py-8 text-center text-[13px] text-secondary">
        {q ? `No GIFs found for "${q}"` : "GIFs aren't available right now."}
      </p>
    </div>
  );
}

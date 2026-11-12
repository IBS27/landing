import { DropdownMenu as DM } from "radix-ui";
import type { ReactNode } from "react";

/**
 * Facebook's notification "..." menus: a 12px-radius white card with a soft
 * pointer caret aimed at the button, a heavy drop shadow and 36px rows.
 */
export function CaretMenuContent({
  children,
  width = 344,
}: {
  children: ReactNode;
  width?: number;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align="end"
        sideOffset={16}
        alignOffset={13}
        collisionPadding={8}
        className="z-50 rounded-xl rounded-tr-none bg-popover p-2 outline-none data-[state=open]:animate-[fade-in_120ms_ease-out]"
        style={{
          width,
          filter: "drop-shadow(0 12px 14px rgba(0,0,0,.16)) drop-shadow(0 1px 3px rgba(0,0,0,.12))",
        }}
      >
        {children}
        <svg
          viewBox="0 0 22 12"
          width="22"
          height="12"
          className="absolute -top-[11px] right-0 fill-popover"
          aria-hidden
        >
          <path d="M0 12C8 12 15 8 20.4 1.3c.5-.6 1.6-.3 1.6.5V12Z" />
        </svg>
      </DM.Content>
    </DM.Portal>
  );
}

export function CaretMenuItem({
  icon,
  label,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className="flex h-9 cursor-pointer select-none items-center gap-3 rounded-md px-2 font-medium text-[15px] text-primary leading-5 outline-none data-[highlighted]:bg-hover"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-primary">{icon}</span>
      {label}
    </DM.Item>
  );
}

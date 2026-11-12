import { Link } from "@tanstack/react-router";
import { Check, Forward, MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { RailDivider, RailHeading, RailItem, SideRail } from "@/features/feed/SideRail";
import { CardsGlyph } from "@/features/misc/glyphs";
import { GearFilled } from "@/features/misc/icons";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/ui/overlays";
import { Avatar, Button, Card, IconButton, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { SavedItem } from "../../../convex/saved";

type Kind = "post" | "listing" | "event";
const KIND_LABEL: Record<Kind, string> = {
  post: "Posts",
  listing: "Marketplace",
  event: "Events",
};

/** /saved: everything the viewer saved (posts, listings, events). */
export function SavedPage() {
  const [kind, setKind] = useState<Kind | undefined>(undefined);
  const items = useQ(api.saved.list, kind ? { kind } : {});

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <SideRail
        title="Saved"
        label="List of saved item"
        action={
          <IconButton label="Settings">
            <GearFilled className="text-icon" />
          </IconButton>
        }
      >
        <RailItem
          icon={<CardsGlyph />}
          label="Saved Items"
          selected
          tintRow={false}
          onClick={() => setKind(undefined)}
        />
        <RailDivider />
        <RailHeading>My collections</RailHeading>
        <div className="px-2 pt-8">
          <Button variant="soft" block icon={<Plus size={18} strokeWidth={2.5} />}>
            Create new collection
          </Button>
        </div>
      </SideRail>

      <main className="min-w-0 flex-1 px-4 pt-4 pb-8 min-[900px]:px-8">
        <div className="flex items-center justify-between pt-1 pb-4">
          <h2 className="font-bold text-[20px] text-primary leading-6">
            {kind ? KIND_LABEL[kind] : "All"}
          </h2>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="flex h-9 w-12 items-center justify-center rounded-lg bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
              >
                <SlidersHorizontal size={16} strokeWidth={2.5} />
              </button>
            </MenuTrigger>
            <MenuContent width={220}>
              {([undefined, "post", "listing", "event"] as const).map((k) => (
                <MenuItem
                  key={k ?? "all"}
                  label={k ? KIND_LABEL[k] : "All"}
                  icon={kind === k ? <Check size={18} /> : <span />}
                  onSelect={() => setKind(k)}
                />
              ))}
            </MenuContent>
          </Menu>
        </div>

        {items === undefined ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="flex gap-4 p-4">
                <Skeleton className="h-36 w-36 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2 pt-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="flex h-[87px] items-center justify-center shadow-none">
            <p className="font-bold text-[20px] text-secondary leading-6">
              You do not have any saved items.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <SavedRow key={item._id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  const viewer = useViewer();
  const toggle = useM(api.saved.toggle);
  const source =
    item.kind === "post"
      ? `${item.fromName}'s post`
      : item.kind === "listing"
        ? `${item.fromName}'s listing`
        : `${item.fromName}'s event`;

  return (
    <Card className="flex gap-4 p-4">
      <Link to={item.link.to} params={item.link.params} className="shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            className="h-[144px] w-[144px] rounded-lg border border-black/10 object-cover dark:border-white/5"
          />
        ) : (
          <span className="block h-[144px] w-[144px] rounded-lg bg-btn" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={item.link.to}
          params={item.link.params}
          className="line-clamp-2 font-semibold text-[17px] text-primary leading-[22px] hover:underline"
        >
          {item.title}
        </Link>
        <p className="mt-1 truncate text-[13px] text-secondary leading-4">
          {item.typeLabel}
          {item.fromName && (
            <>
              {" · "}Saved from{" "}
              <Link to={item.link.to} params={item.link.params} className="hover:underline">
                {source}
              </Link>
            </>
          )}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-secondary leading-4">
          <Avatar src={item.fromAvatar ?? viewer.avatar} size={24} />
          Saved to <span className="font-semibold text-primary">For later</span>
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button variant="secondary" className="min-w-[220px]">
            Add to collection
          </Button>
          <button
            type="button"
            aria-label="Share"
            className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
          >
            <Forward size={20} />
          </button>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-icon hover:brightness-95 dark:hover:brightness-125"
              >
                <MoreHorizontal size={20} />
              </button>
            </MenuTrigger>
            <MenuContent width={260} align="start">
              <MenuItem
                label="Unsave"
                icon={<SavedOffIcon />}
                onSelect={() => void toggle({ kind: item.kind, refId: item.refId })}
              />
              <MenuSeparator />
              <MenuItem label="Add to collection" icon={<Plus size={20} />} />
            </MenuContent>
          </Menu>
        </div>
      </div>
    </Card>
  );
}

function SavedOffIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M5.5 2.75h9a1 1 0 0 1 1 1v13.1a.4.4 0 0 1-.65.31L10 13.5l-4.85 3.66a.4.4 0 0 1-.65-.31V3.75a1 1 0 0 1 1-1Z" />
      <path d="m2.5 2.5 15 15" strokeLinecap="round" />
    </svg>
  );
}

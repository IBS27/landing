import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import {
  FriendButton,
  MutualLine,
  type PersonCard,
  PersonPlusGlyph,
  type Relation,
  useFriendActions,
  useRemovedSuggestions,
} from "@/features/friends";
import { cn } from "@/lib/format";
import { Button, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { useProfile } from "./context";

type Tile = PersonCard & { relation: Relation };

/**
 * The "People You May Know" carousel under the profile header (toggled by
 * the chevron). On someone else's profile it suggests their friends.
 */
export function Recommendations() {
  const { profile } = useProfile();
  const { removed, remove } = useRemovedSuggestions();
  const mine = useQ(api.friends.suggestions, profile.isSelf ? { limit: 20 } : "skip");
  const theirs = useQ(api.friends.list, profile.isSelf ? "skip" : { userId: profile.user._id });
  const [sent, setSent] = useState<Set<string>>(new Set());

  const tiles: Tile[] | undefined = useMemo(() => {
    const base: Tile[] | undefined = profile.isSelf
      ? mine?.map((p) => ({ ...p, relation: sent.has(p._id) ? "outgoing" : "none" }))
      : theirs?.filter((p) => p.relation === "none" || p.relation === "outgoing");
    return base?.filter((p) => !removed.has(p._id));
  }, [profile.isSelf, mine, theirs, removed, sent]);

  const scroller = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ start: true, end: false });
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setPos({
      start: el.scrollLeft < 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };
  const scrollBy = (d: number) =>
    scroller.current?.scrollBy({
      left: d * (scroller.current.clientWidth - 100),
      behavior: "smooth",
    });

  if (tiles && tiles.length === 0) return null;

  return (
    <section
      aria-label="People You May Know"
      className="mt-4 rounded-xl bg-card p-3 shadow-[0_1px_2px_var(--shadow-2)] ring-1 ring-divider-soft"
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-semibold text-[17px] text-primary">People You May Know</h2>
        <Link
          to="/friends/suggestions"
          className="rounded-md px-2 py-1 font-semibold text-[15px] text-link hover:bg-hover"
        >
          See all
        </Link>
      </div>
      {tiles === undefined ? (
        <div className="flex h-[289px] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={onScroll}
            className="scrollbar-none -m-2 flex gap-[8px] overflow-x-auto p-2"
          >
            {tiles.map((p) => (
              <RecTile
                key={p._id}
                person={p}
                onRemove={() => remove(p._id)}
                onSent={() => setSent((s) => new Set(s).add(p._id))}
              />
            ))}
          </div>
          {!pos.start && <Arrow side="left" onClick={() => scrollBy(-1)} />}
          {!pos.end && tiles.length > 6 && <Arrow side="right" onClick={() => scrollBy(1)} />}
        </div>
      )}
    </section>
  );
}

function RecTile({
  person,
  onRemove,
  onSent,
}: {
  person: Tile;
  onRemove: () => void;
  onSent: () => void;
}) {
  const { profile } = useProfile();
  const actions = useFriendActions();
  return (
    <div className="relative flex w-[176px] shrink-0 flex-col overflow-hidden rounded-xl border border-divider bg-card shadow-emphasis">
      <Link to="/$username" params={{ username: person.username }} className="block">
        <img
          src={person.avatar}
          alt=""
          className="aspect-square w-full border-divider border-b object-cover hover:brightness-95"
        />
      </Link>
      <button
        type="button"
        aria-label="Remove recommendation"
        onClick={onRemove}
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
      >
        <X size={16} strokeWidth={2.6} />
      </button>
      <div className="flex flex-1 flex-col p-3">
        <Link
          to="/$username"
          params={{ username: person.username }}
          className="truncate font-semibold text-[17px] text-primary leading-5 hover:underline"
        >
          {person.name}
        </Link>
        <div className="mt-1 h-5 text-[15px] text-secondary leading-5">
          <MutualLine person={person} />
        </div>
        <div className="mt-3">
          {profile.isSelf ? (
            person.relation === "outgoing" ? (
              <Button variant="secondary" block onClick={() => void actions.cancel(person._id)}>
                Cancel request
              </Button>
            ) : (
              <Button
                variant="soft"
                block
                icon={<PersonPlusGlyph size={16} className="text-fb" />}
                onClick={() => {
                  onSent();
                  void actions.add(person._id);
                }}
              >
                Add friend
              </Button>
            )
          ) : (
            <FriendButton
              userId={person._id}
              name={person.name}
              relation={person.relation}
              variant="soft"
              className="w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={cn(
        "absolute top-[63px] flex h-12 w-12 items-center justify-center rounded-full bg-btn-floating text-secondary shadow-[0_2px_8px_var(--shadow-1),0_0_0_1px_var(--shadow-1)] hover:brightness-95",
        side === "left" ? "-left-1" : "-right-1",
      )}
    >
      <Icon size={24} />
    </button>
  );
}

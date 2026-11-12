import { useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GroupCard, type GroupCardData } from "./GroupCard";
import { GroupsRail } from "./GroupsRail";
import { ChevronLeftGlyph, ChevronRightGlyph } from "./icons";

/** /groups/discover: Suggested and Popular carousels, then a grid of more suggestions. */
export function DiscoverPage() {
  // Groups joined after this page opened stay listed (with "View group").
  const [since] = useState(() => Date.now());
  const data = useQ(api.groups.discover, { since });
  const [hidden, setHidden] = useState<Set<Id<"groups">>>(new Set());
  const hide = (id: Id<"groups">) => setHidden((s) => new Set(s).add(id));
  const keep = (list: GroupCardData[]) => list.filter((g) => !hidden.has(g._id));

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <GroupsRail active="discover" />
      <main className="min-w-0 flex-1 px-4 pt-4 pb-10 min-[1200px]:px-16">
        <div className="mx-auto w-full max-w-[952px]">
          {data === undefined ? (
            <DiscoverSkeleton />
          ) : (
            <>
              <CarouselSection
                title="Suggested for you"
                subtitle="Groups you might be interested in."
                groups={keep(data.suggested)}
                onHide={hide}
              />
              {data.popular.length > 0 && (
                <CarouselSection
                  title="Popular near you"
                  subtitle="Groups people in your area are in"
                  groups={keep(data.popular)}
                  onHide={hide}
                />
              )}
              <Section title="More suggestions" last>
                <div className="flex flex-wrap gap-2">
                  {keep(data.more).map((g) => (
                    <GroupCard key={g._id} group={g} onHide={() => hide(g._id)} />
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** A titled carousel whose "See all" expands it into a wrapping grid. */
function CarouselSection({
  title,
  subtitle,
  groups,
  onHide,
}: {
  title: string;
  subtitle: string;
  groups: GroupCardData[];
  onHide: (id: Id<"groups">) => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <Section
      title={title}
      subtitle={subtitle}
      action={
        groups.length > 3 && (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="text-[17px] text-link hover:underline"
          >
            {all ? "See less" : "See all"}
          </button>
        )
      }
    >
      {all ? (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <GroupCard key={g._id} group={g} onHide={() => onHide(g._id)} />
          ))}
        </div>
      ) : (
        <Carousel groups={groups} onHide={onHide} />
      )}
    </Section>
  );
}

function Section({
  title,
  subtitle,
  action,
  last,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(!last && "mb-8 border-divider border-b pb-10")}>
      <div className="mb-[21px]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
          {action}
        </div>
        {subtitle && <p className="text-[17px] text-secondary leading-[22px]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/** A row of 3 visible 312px cards; the round Previous / Next buttons sit at the row's vertical middle. */
function Carousel({
  groups,
  onHide,
}: {
  groups: GroupCardData[];
  onHide: (id: Id<"groups">) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ start: true, end: groups.length <= 3 });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setPos({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  };
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * 3 * 320, behavior: "smooth" });

  if (groups.length === 0)
    return <p className="text-[15px] text-secondary">No more suggestions right now.</p>;

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="scrollbar-none flex items-start gap-2 overflow-x-auto pb-5"
      >
        {groups.map((g) => (
          <div key={g._id}>
            <GroupCard group={g} onHide={() => onHide(g._id)} />
          </div>
        ))}
      </div>
      {!pos.start && <ArrowButton side="left" onClick={() => scroll(-1)} />}
      {!pos.end && <ArrowButton side="right" onClick={() => scroll(1)} />}
    </div>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous items" : "Next items"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-card text-icon-secondary shadow-[0_2px_8px_rgba(0,0,0,.1),0_0_0_1px_rgba(0,0,0,.1)] hover:bg-[color-mix(in_srgb,var(--card),#000_4%)]",
        side === "left" ? "-left-6" : "-right-6",
      )}
    >
      {side === "left" ? <ChevronLeftGlyph size={24} /> : <ChevronRightGlyph size={24} />}
    </button>
  );
}

function DiscoverSkeleton() {
  return (
    <div>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[308px] w-[312px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

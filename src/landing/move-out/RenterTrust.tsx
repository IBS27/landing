import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, CalendarDays, Handshake, ShieldCheck, UserCheck, Users } from "lucide-react";
import { type CSSProperties, Fragment } from "react";
import { useQ } from "@/app/viewer";
import { toGroup, toProfile } from "@/landing/links";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Trust = NonNullable<FunctionReturnType<typeof api.subleases.renterTrustFor>>;
type Fact = Trust["facts"][number];

const ICON: Record<Fact["key"], typeof BadgeCheck> = {
  identity: BadgeCheck,
  friends: UserCheck,
  vouches: Handshake,
  mutual_friends: Users,
  mutual_groups: Users,
  tenure: CalendarDays,
};

function Sources({ fact }: { fact: Fact }) {
  return (
    <span className="text-secondary">
      {fact.sourceLabel}
      {fact.sources.length > 0 && ": "}
      {fact.sources.map((s, i) => (
        <Fragment key={s.kind === "person" ? s.user._id : s.slug}>
          {i > 0 && ", "}
          <Link
            {...(s.kind === "person" ? toProfile(s.user) : toGroup({ slug: s.slug }))}
            className="font-semibold text-primary hover:underline"
          >
            {s.kind === "person" ? s.user.name : s.name}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * What the lister's network says about the renter in a sublet chat (#141),
 * each fact with its source. Only the lister gets data; for anyone else, and
 * with nothing to show, it renders nothing. Works the same with AI off.
 */
export function RenterTrust({
  conversationId,
  compact,
  className,
  style,
}: {
  conversationId: Id<"conversations">;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const trust = useQ(api.subleases.renterTrustFor, { conversationId });
  if (!trust || trust.facts.length === 0) return null;
  return (
    <section
      aria-label={`About ${trust.renter.firstName}`}
      style={style}
      className={cn(
        "rounded-lg border border-divider bg-card px-3 py-2.5 text-[13px] leading-[18px]",
        className,
      )}
    >
      <h4 className="flex items-center gap-1.5 font-semibold text-primary">
        <ShieldCheck size={14} className="shrink-0 text-positive" aria-hidden />
        About {trust.renter.firstName}
      </h4>
      <ul className={cn("mt-1.5 flex flex-col", compact ? "gap-1" : "gap-1.5")}>
        {trust.facts.map((f) => {
          const Icon = ICON[f.key];
          return (
            <li key={f.key} className="flex items-start gap-2">
              <Icon size={14} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
              <span className="min-w-0">
                <span className="text-primary">{f.text}</span>
                {" · "}
                <Sources fact={f} />
              </span>
            </li>
          );
        })}
      </ul>
      {!compact && (
        <p className="mt-1.5 text-[12px] text-secondary">
          Only you see this. Landing never uses protected traits.
        </p>
      )}
    </section>
  );
}

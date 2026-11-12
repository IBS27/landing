import { Link } from "@tanstack/react-router";
import { BadgeCheck, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQ } from "@/app/viewer";
import { timeAgo } from "@/lib/citations";
import { cn, plural } from "@/lib/format";
import { Avatar, Button, Card, Divider, Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { UserSummary } from "../../../convex/lib/users";
import type { NetworkVouch } from "../../../convex/lib/vouches";
import { VouchDialog } from "./VouchDialog";
import { relationLine, relationshipLine, viaLine, vouchesTitle } from "./vouchCopy";

/**
 * "Your network" card for a Landing listing view: how the viewer is connected
 * to the lister and who in their network vouches for them, with a button to
 * vouch. Mount it beside the listing: `<ListerNetwork listingId={id} />`.
 * Renders nothing when the listing or lister is unavailable.
 */
export function ListerNetwork({ listingId }: { listingId: Id<"listings"> }) {
  const data = useQ(api.vouches.forListing, { listingId });
  const [vouching, setVouching] = useState(false);

  if (data === undefined)
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
      </Card>
    );
  if (data === null) return null;

  const { lister, relation, vouches } = data;
  return (
    <Card className="p-4" aria-label="Your network">
      <h2 className="font-bold text-md text-primary">Your network</h2>

      <div className="mt-3 flex items-center gap-3">
        <PersonLink person={lister}>
          <Avatar src={lister.avatar} alt={lister.name} size={40} />
        </PersonLink>
        <div className="min-w-0 flex-1">
          <PersonLink person={lister} className="font-semibold text-base text-primary">
            {lister.name}
          </PersonLink>
          <p className="flex items-center gap-1 text-secondary text-sm">
            <Users size={14} aria-hidden className="shrink-0" />
            <span className="truncate">
              {relationLine(relation, lister, data.mutualFriends, data.mutualFriendCount)}
            </span>
          </p>
        </div>
      </div>
      {data.mutualFriends.length > 0 && (
        <AvatarStack people={data.mutualFriends} total={data.mutualFriendCount} />
      )}

      <Divider className="my-3" />

      <h3 className="font-semibold text-base text-primary">
        {vouchesTitle(relation, data.vouchTotal)}
      </h3>
      {vouches.length > 0 && (
        <ul className="mt-2 flex flex-col gap-3">
          {vouches.map((v) => (
            <VouchRow key={v.voucher._id} vouch={v} lister={lister} />
          ))}
        </ul>
      )}
      {data.vouchTotal > vouches.length && (
        <p className="mt-2 text-secondary text-xs">
          And {plural(data.vouchTotal - vouches.length, "more vouch", "more vouches")}
        </p>
      )}
      {vouches.length === 0 && relation !== "you" && (
        <p className="mt-1 text-secondary text-sm">
          {data.partial
            ? `No vouches for ${lister.firstName} found in your network.`
            : `None of your friends or friends of friends have vouched for ${lister.firstName}.`}
        </p>
      )}
      {data.partial && (
        <p className="mt-2 text-secondary text-xs">Only the most recent vouches were checked.</p>
      )}

      {data.canVouch && (
        <Button
          variant={data.viewerVouch ? "secondary" : "soft"}
          block
          className="mt-4"
          icon={<BadgeCheck size={18} aria-hidden />}
          onClick={() => setVouching(true)}
        >
          {data.viewerVouch ? "Edit your vouch" : `Vouch for ${lister.firstName}`}
        </Button>
      )}
      {vouching && (
        <VouchDialog
          subject={lister}
          current={data.viewerVouch}
          onClose={() => setVouching(false)}
        />
      )}
    </Card>
  );
}

function VouchRow({ vouch: v, lister }: { vouch: NetworkVouch; lister: UserSummary }) {
  return (
    <li className="flex gap-3">
      <PersonLink person={v.voucher}>
        <Avatar src={v.voucher.avatar} alt={v.voucher.name} size={36} />
      </PersonLink>
      <div className="min-w-0 flex-1">
        <p className="text-primary text-sm">
          <PersonLink person={v.voucher} className="font-semibold">
            {v.voucher.name}
          </PersonLink>{" "}
          <span className="text-secondary">· {viaLine(v)}</span>
        </p>
        <p className="text-primary text-sm">{relationshipLine(v.relationship, lister)}</p>
        {v.note && <p className="mt-0.5 text-primary text-sm">"{v.note}"</p>}
        <p className="text-secondary text-xs">{timeAgo(v.updatedAt)}</p>
      </div>
    </li>
  );
}

function AvatarStack({ people, total }: { people: UserSummary[]; total: number }) {
  return (
    <div className="mt-2 flex items-center pl-[52px]">
      {people.slice(0, 6).map((p, i) => (
        <PersonLink key={p._id} person={p} className={i > 0 ? "-ml-1.5" : undefined}>
          <Avatar src={p.avatar} alt={p.name} size={24} className="rounded-full ring-2 ring-card" />
        </PersonLink>
      ))}
      {total > 6 && <span className="ml-1.5 text-secondary text-xs">+{total - 6}</span>}
    </div>
  );
}

/** A person's profile. Switch to `toProfile` from `src/landing/links.ts` once #55 merges. */
function PersonLink({
  person,
  className,
  children,
}: {
  person: { username: string; name: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/$username"
      params={{ username: person.username }}
      className={cn("hover:underline", className)}
      title={person.name}
    >
      {children}
    </Link>
  );
}

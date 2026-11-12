import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  BadgeCheck,
  CircleCheck,
  Footprints,
  House,
  Images,
  MapPin,
  MessageCircleWarning,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { toConversation } from "@/landing/links";
import { cn, price, shortAge } from "@/lib/format";
import { Card, Spinner } from "@/ui/primitives";
import type { api } from "../../../convex/_generated/api";
import type { ListingSignal } from "../../../convex/lib/trust";

export type ListingTrust = NonNullable<FunctionReturnType<typeof api.trust.forListing>>;

/* ── Verified levels ──────────────────────────────────────────────────── */

const RELATION: Record<string, string> = {
  you: "you",
  friend: "your friend",
  friend_of_friend: "a friend of a friend",
};

/** The listing's verified levels as pills. Renders nothing when it has none. */
export function VerifiedBadges({ badges }: { badges: ListingTrust["badges"] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => {
        if (b.kind === "identity")
          return (
            <Pill key="identity" icon={<BadgeCheck size={14} />}>
              Identity verified
            </Pill>
          );
        if (b.kind === "property")
          return (
            <Pill key="property" icon={<House size={14} />}>
              Property verified
            </Pill>
          );
        return (
          <Pill key="toured" icon={<Footprints size={14} />}>
            Toured by {b.by.firstName} ({RELATION[b.relation]})
          </Pill>
        );
      })}
    </div>
  );
}

function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#E3F5E5] px-2.5 font-semibold text-[#24832C] text-[13px] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
      {icon}
      {children}
    </span>
  );
}

/* ── Listing signals ──────────────────────────────────────────────────── */

function signalCopy(s: ListingSignal): { icon: ReactNode; title: string; body: string } {
  switch (s.kind) {
    case "low_price":
      return {
        icon: <Tag size={18} />,
        title: `Price is ${s.percentBelow}% below similar listings`,
        body: `Similar ${s.unit === "room" ? "rooms" : `${s.unit}s`} in ${s.area} go for about ${price(s.median)}/mo (${s.comps} listings). A price that seems too good is a common way to rush renters.`,
      };
    case "new_account":
      return {
        icon: <UserRound size={18} />,
        title: "New account with no one you know",
        body: `Joined ${s.daysOld === 0 ? "today" : `${s.daysOld} ${s.daysOld === 1 ? "day" : "days"} ago`}, with no mutual friends or vouches from your network.`,
      };
    case "reused_photos":
      return {
        icon: <Images size={18} />,
        title: "Photos also appear on another listing",
        body: `${s.count === 1 ? "A photo" : `${s.count} photos`} also ${s.count === 1 ? "appears" : "appear"} on “${s.otherListingTitle}”, posted earlier by someone else.`,
      };
    case "lister_far_away":
      return {
        icon: <MapPin size={18} />,
        title: "Lister lives outside the Bay Area",
        body: `Their profile says ${s.listerCity}. Ask who will show you the place in person.`,
      };
  }
}

/** "Things to check" on a listing: each signal with its reason. */
export function ThingsToCheck({ signals }: { signals: ListingSignal[] }) {
  return (
    <Card className="p-4">
      <h2 className="font-bold text-[17px] text-primary leading-5">Things to check</h2>
      {signals.length === 0 ? (
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E3F5E5] text-[#24832C] dark:bg-[#3FBB46]/20 dark:text-[#3FBB46]">
            <CircleCheck size={18} />
          </span>
          <p className="pt-2 text-[15px] text-primary leading-5">
            Nothing stood out about this listing.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {signals.map((s) => {
            const c = signalCopy(s);
            return (
              <li key={s.kind} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4D6] text-[#8A6100] dark:bg-[#F7B928]/20 dark:text-[#F7B928]">
                  {c.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px] text-primary leading-5">{c.title}</div>
                  <p className="mt-0.5 text-[13px] text-secondary leading-[18px]">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-divider border-t pt-3 text-[13px] text-secondary leading-[18px]">
        Pay only after you've seen the place in person and signed a lease.
      </p>
    </Card>
  );
}

/* ── Chat check ───────────────────────────────────────────────────────── */

const CATEGORY_LABEL: Record<string, string> = {
  deposit_before_viewing: "Money before a viewing",
  away_lister: "Can't show it in person",
  untraceable_payment: "Hard-to-reverse payment",
  pressure: "Pressure to decide",
  off_platform: "Moving off Facebook",
};

/** What Ember found in the viewer's chat with the lister, grouped by message. */
export function ChatCheck({
  chat,
  listerFirstName,
}: {
  chat: NonNullable<ListingTrust["chat"]>;
  listerFirstName: string;
}) {
  const checking = chat.status !== "checked";
  const byMessage = new Map<
    string,
    { text: string; createdAt: number; items: typeof chat.flags }
  >();
  for (const f of chat.flags) {
    const row = byMessage.get(f.messageId) ?? { text: f.text, createdAt: f.createdAt, items: [] };
    row.items.push(f);
    byMessage.set(f.messageId, row);
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-[17px] text-primary leading-5">
          Things to check in your chat with {listerFirstName}
        </h2>
        <Link
          {...toConversation(chat.conversationId)}
          className="shrink-0 font-semibold text-[15px] text-link hover:underline"
        >
          Open chat
        </Link>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-secondary">
        {checking ? (
          <>
            <Spinner size={12} /> Reading your chat…
          </>
        ) : chat.via === "fallback" ? (
          "Checked with Landing's scam phrase list"
        ) : (
          <>
            <Sparkles size={12} className="text-[#8A3FFC]" aria-hidden /> Checked by Muse
          </>
        )}
      </div>

      {!checking && byMessage.size === 0 && (
        <p className="mt-3 text-[15px] text-primary leading-5">
          Nothing stood out in your messages so far.
        </p>
      )}
      {byMessage.size > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {[...byMessage.entries()].map(([id, m]) => (
            <li key={id} className="rounded-lg bg-wash p-3 dark:bg-hover">
              <div className="flex items-start gap-2">
                <MessageCircleWarning
                  size={16}
                  className="mt-0.5 shrink-0 text-[#8A6100] dark:text-[#F7B928]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="w-fit max-w-full rounded-[18px] bg-chat-in px-3 py-2 text-[15px] text-primary leading-5">
                    {m.text}
                  </div>
                  <div className="mt-1 text-[12px] text-secondary">
                    {listerFirstName} · {shortAge(m.createdAt)}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {m.items.map((f) => (
                      <li key={f.category} className="text-[13px] leading-[18px]">
                        <span
                          className={cn(
                            "mr-1.5 inline-flex rounded-full bg-[#FFF4D6] px-2 py-0.5 font-semibold text-[#8A6100] text-[12px] dark:bg-[#F7B928]/20 dark:text-[#F7B928]",
                          )}
                        >
                          {CATEGORY_LABEL[f.category] ?? f.category}
                        </span>
                        <span className="text-primary">{f.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

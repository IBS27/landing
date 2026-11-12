import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  BadgeDollarSign,
  Check,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useChatDock } from "@/app/chat-dock";
import { useM, useQ, useViewer } from "@/app/viewer";
import { groupParams } from "@/features/feed/links";
import { cn, plural, price, shortAge } from "@/lib/format";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from "@/ui/overlays";
import { Avatar, Button, Card, Skeleton, Spinner } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { Accordion, RadioRow } from "./filters";
import { gridClass, ListingCardView, priceLabel } from "./grid";
import {
  AlertBellIcon,
  ArchiveIcon,
  BarsIcon,
  BookmarkFill,
  ChartIcon,
  ClockIcon,
  FollowingIcon,
  ListDoc,
  MegaphoneIcon,
  OfferJarIcon,
  PaperPlane,
  SellingTagIcon,
  ShareArrow,
  ShieldIcon,
  TagIcon,
} from "./icons";
import {
  CreateListingButton,
  MainRail,
  MpShell,
  RailDivider,
  RailRow,
  RailTitle,
  SubRailHeader,
} from "./rails";
import { useToast } from "./toast";

/* ───────────── Shared bits ───────────── */

function messagedAgo(ts: number) {
  const age = shortAge(ts);
  return age === "Just now" ? "just now" : `${age} ago`;
}

function Empty({
  art,
  title,
  body,
  action,
}: {
  art: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center text-center">
      {art}
      <h2 className="mt-4 max-w-[720px] font-bold text-[20px] text-secondary leading-6">{title}</h2>
      {body && <p className="mt-1 max-w-[306px] text-[17px] text-secondary leading-5">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ProfileRow() {
  const viewer = useViewer();
  return (
    <RailRow
      bare
      icon={<Avatar src={viewer.avatar} size={36} />}
      label="Marketplace profile"
      to="/$username"
      params={{ username: viewer.username }}
    />
  );
}

/* ───────────── Buying ───────────── */

export type BuyingTab = "activity" | "orders" | "offers" | "alerts" | "following";

function BuyingRail({ active }: { active: BuyingTab | "saved" }) {
  const tab = (t: BuyingTab) => ({
    to: "/marketplace/you",
    search: t === "activity" ? {} : { tab: t },
  });
  return (
    <>
      <SubRailHeader title="Buying" />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <RailRow
          icon={<ClockIcon />}
          label="Recent activity"
          active={active === "activity"}
          {...tab("activity")}
        />
        <RailRow
          icon={<BookmarkFill />}
          label="Saved"
          active={active === "saved"}
          to="/marketplace/saved"
        />
        <RailRow
          icon={<ArchiveIcon />}
          label="Purchased orders"
          active={active === "orders"}
          {...tab("orders")}
        />
        <RailRow
          icon={<OfferJarIcon />}
          label="Submitted offers"
          active={active === "offers"}
          {...tab("offers")}
        />
        <RailRow
          icon={<AlertBellIcon />}
          label="Your alerts"
          active={active === "alerts"}
          {...tab("alerts")}
        />
        <RailRow
          icon={<FollowingIcon />}
          label="Following"
          active={active === "following"}
          {...tab("following")}
        />
        <ProfileRow />
        <CreateListingButton className="mx-2 mt-2" />
      </div>
    </>
  );
}

const BUYING_EMPTY: Record<Exclude<BuyingTab, "activity">, { title: string; body: string }> = {
  orders: { title: "No purchased orders", body: "Items you buy with checkout will appear here." },
  offers: { title: "No submitted offers", body: "Offers you make on items will appear here." },
  alerts: {
    title: "No alerts",
    body: "Turn on Notify Me in a category to get alerts about new listings.",
  },
  following: { title: "Not following anyone", body: "Sellers you follow will appear here." },
};

/** /marketplace/you — Buying › Recent activity (items you've messaged sellers about). */
export function BuyingPage({ tab }: { tab: BuyingTab }) {
  const items = useQ(api.listings.buying, tab === "activity" ? {} : "skip");
  const { openChat } = useChatDock();
  const browse = (
    <Link
      to="/marketplace"
      className="inline-flex h-9 items-center rounded-lg bg-btn-primary px-4 font-semibold text-[15px] text-white hover:bg-btn-primary-hover"
    >
      Browse Marketplace
    </Link>
  );
  let body: ReactNode;
  if (tab !== "activity") body = <Empty art={<ListDoc />} {...BUYING_EMPTY[tab]} action={browse} />;
  else if (items === undefined) body = <ListSkeleton />;
  else if (items.length === 0)
    body = (
      <Empty
        art={<ListDoc />}
        title="No Marketplace Activity"
        body="Items you're buying or selling will appear here."
        action={browse}
      />
    );
  else
    body = (
      <div className="mx-auto max-w-[800px] pt-5">
        <h2 className="font-bold text-[20px] text-primary leading-6">Recent activity</h2>
        <p className="text-[15px] text-secondary">Items you've messaged sellers about</p>
        <Card className="mt-3 divide-y divide-divider rounded-xl">
          {items.map((it) => (
            <div key={it._id} className="flex items-center gap-3 p-4">
              <Link
                to="/marketplace/item/$listingId"
                params={{ listingId: it._id }}
                className="shrink-0"
              >
                {it.photo && (
                  <img src={it.photo} alt="" className="h-20 w-20 rounded-lg object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/marketplace/item/$listingId"
                  params={{ listingId: it._id }}
                  className="block truncate font-semibold text-[17px] text-primary hover:underline"
                >
                  {it.title}
                </Link>
                <p className="text-[15px] text-primary">
                  {priceLabel(it.price)}
                  {it.status !== "active" && (
                    <span className="ml-2 text-secondary">
                      · {it.status === "sold" ? "Sold" : "Pending"}
                    </span>
                  )}
                </p>
                <p className="truncate text-[13px] text-secondary">
                  {it.seller ? `${it.seller.name} · ` : ""}
                  {it.city} · Messaged {messagedAgo(it.lastMessageAt)}
                </p>
              </div>
              <Button
                icon={<MessageCircle size={16} />}
                onClick={() => openChat(it.conversationId)}
              >
                Message
              </Button>
            </div>
          ))}
        </Card>
      </div>
    );
  return <MpShell rail={<BuyingRail active={tab} />}>{body}</MpShell>;
}

/** /marketplace/saved — saved listings. */
export function SavedListingsPage() {
  const items = useQ(api.listings.saved, {});
  const toggle = useM(api.saved.toggle);
  return (
    <MpShell rail={<BuyingRail active="saved" />}>
      {items === undefined ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Empty
          art={<ListDoc />}
          title="No saved items"
          body="When you save items on Marketplace, they'll appear here."
          action={
            <Link
              to="/marketplace"
              className="inline-flex h-9 items-center rounded-lg bg-btn-primary px-4 font-semibold text-[15px] text-white"
            >
              Browse Marketplace
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex h-9 items-center pt-2">
            <h2 className="font-bold text-[20px] text-primary leading-6">Saved items</h2>
          </div>
          <div className={cn(gridClass, "mt-3")}>
            {items.map((l) => (
              <ListingCardView
                key={l._id}
                l={l}
                footer={
                  <Button
                    size="sm"
                    block
                    className="mt-2"
                    icon={<BookmarkFill size={14} />}
                    onClick={() => void toggle({ kind: "listing", refId: l._id })}
                  >
                    Unsave
                  </Button>
                }
              />
            ))}
          </div>
        </>
      )}
    </MpShell>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto max-w-[800px] pt-5">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-24 w-full" />
      <Skeleton className="mt-2 h-24 w-full" />
    </div>
  );
}

/* ───────────── Selling ───────────── */

export type SellingTab = "dashboard" | "listings" | "announcements" | "insights";
type StatusFilter = "all" | "active" | "pending" | "sold";
type SellSort = "newest" | "oldest" | "price_desc" | "price_asc";

export function SellingPage({ tab }: { tab: SellingTab }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SellSort>("newest");
  const data = useQ(api.listings.mine, { status, sort });
  const tabLink = (t: SellingTab) => ({
    to: "/marketplace/you/selling",
    search: t === "listings" ? {} : { tab: t },
  });
  const rail = (
    <>
      <SubRailHeader title="Selling" />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <CreateListingButton className="mx-2" />
        <div className="mt-2">
          <RailRow
            icon={<ChartIcon />}
            label="Seller dashboard"
            active={tab === "dashboard"}
            {...tabLink("dashboard")}
          />
          <RailRow
            icon={tab === "listings" ? <TagIcon /> : <SellingTagIcon />}
            label="Your listings"
            active={tab === "listings"}
            {...tabLink("listings")}
          />
          <RailRow
            icon={<MegaphoneIcon />}
            label="Announcements"
            active={tab === "announcements"}
            {...tabLink("announcements")}
          />
          <RailRow
            icon={<BarsIcon />}
            label="Insights"
            active={tab === "insights"}
            {...tabLink("insights")}
          />
          <ProfileRow />
        </div>
        <Link
          to="/marketplace/you/selling"
          className="mx-2 mt-2 flex h-9 items-center justify-center rounded-lg bg-btn font-semibold text-[15px] text-btn-text hover:brightness-95 dark:hover:brightness-125"
        >
          Manage listings
        </Link>
        {tab === "listings" && (
          <>
            <RailDivider className="mt-3" />
            <div className="pt-4">
              <RailTitle
                action={
                  <button
                    type="button"
                    className="text-[15px] text-link hover:underline"
                    onClick={() => {
                      setStatus("all");
                      setSort("newest");
                    }}
                  >
                    Clear
                  </button>
                }
              >
                Filters
              </RailTitle>
              <div className="mt-3">
                <Accordion label="Sort by">
                  {(
                    [
                      ["newest", "Newest first"],
                      ["oldest", "Oldest first"],
                      ["price_desc", "Price: High to low"],
                      ["price_asc", "Price: Low to high"],
                    ] as const
                  ).map(([v, label]) => (
                    <RadioRow
                      key={v}
                      name="sell-sort"
                      label={label}
                      checked={sort === v}
                      onSelect={() => setSort(v)}
                    />
                  ))}
                </Accordion>
                <Accordion label="Status">
                  {(
                    [
                      ["all", "All"],
                      ["active", "Available"],
                      ["pending", "Pending"],
                      ["sold", "Sold"],
                    ] as const
                  ).map(([v, label]) => (
                    <RadioRow
                      key={v}
                      name="sell-status"
                      label={label}
                      checked={status === v}
                      onSelect={() => setStatus(v)}
                    />
                  ))}
                </Accordion>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  let body: ReactNode;
  if (data === undefined) body = <ListSkeleton />;
  else if (tab === "announcements")
    body = (
      <Empty
        art={<PaperPlane />}
        title="No announcements right now"
        body="Check back for Marketplace news and updates."
      />
    );
  else if (data.totals.active + data.totals.pending + data.totals.sold === 0)
    body = (
      <Empty
        art={<PaperPlane />}
        title="When you start selling, your listings will appear here."
        action={<CreateListingButton className="w-[174px]" />}
      />
    );
  else
    body = (
      <div className="mx-auto max-w-[800px] pt-5">
        {(tab === "dashboard" || tab === "insights") && <Overview totals={data.totals} />}
        {tab === "insights" && (
          <Card className="mt-4 rounded-xl p-4">
            <h2 className="font-bold text-[20px] text-primary leading-6">Listing clicks</h2>
            <div className="mt-3 divide-y divide-divider">
              {data.items.map((l) => (
                <Link
                  key={l._id}
                  to="/marketplace/item/$listingId"
                  params={{ listingId: l._id }}
                  className="flex items-center gap-3 py-2 hover:bg-hover"
                >
                  {l.photo && (
                    <img src={l.photo} alt="" className="h-10 w-10 rounded-md object-cover" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] text-primary">
                    {l.title}
                  </span>
                  <span className="text-[15px] text-secondary">
                    {l.stats.views.toLocaleString("en-US")} clicks
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        {(tab === "listings" || tab === "dashboard") && (
          <>
            <div className={cn("flex items-center justify-between", tab === "dashboard" && "mt-6")}>
              <h2 className="font-bold text-[20px] text-primary leading-6">Your listings</h2>
            </div>
            {data.items.length === 0 ? (
              <p className="mt-6 text-center text-[15px] text-secondary">
                No listings match these filters.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {data.items.map((l) => (
                  <SellingCard key={l._id} l={l} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  return <MpShell rail={rail}>{body}</MpShell>;
}

function Overview({
  totals,
}: {
  totals: {
    active: number;
    pending: number;
    sold: number;
    views: number;
    saves: number;
    chats: number;
  };
}) {
  const stats = [
    { icon: <TagIcon size={18} />, n: totals.active, label: "Active listings" },
    { icon: <Package size={18} />, n: totals.pending, label: "Pending" },
    { icon: <BadgeDollarSign size={18} />, n: totals.sold, label: "Sold" },
    { icon: <Eye size={18} />, n: totals.views, label: "Clicks on listings" },
    { icon: <BookmarkFill size={18} />, n: totals.saves, label: "Saves" },
    { icon: <MessageCircle size={18} />, n: totals.chats, label: "Chats" },
  ];
  return (
    <Card className="rounded-xl p-4">
      <h2 className="font-bold text-[20px] text-primary leading-6">Overview</h2>
      <p className="text-[15px] text-secondary">
        Your Marketplace activity for listings you're selling.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-wash p-3">
            <span className="text-icon">{s.icon}</span>
            <p className="mt-1 font-bold text-[24px] text-primary leading-7">
              {s.n.toLocaleString("en-US")}
            </p>
            <p className="text-[13px] text-secondary">{s.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

type MineItem = FunctionReturnType<typeof api.listings.mine>["items"][number];

const listedFmt = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" });

function SellingCard({ l }: { l: MineItem }) {
  const setStatus = useM(api.listings.setStatus);
  const remove = useM(api.listings.remove);
  const create = useM(api.posts.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const statusText = l.status === "active" ? "Active" : l.status === "pending" ? "Pending" : "Sold";
  return (
    <Card className="flex gap-4 rounded-xl p-4">
      <Link to="/marketplace/item/$listingId" params={{ listingId: l._id }} className="shrink-0">
        {l.photo ? (
          <img src={l.photo} alt="" className="h-[120px] w-[120px] rounded-lg object-cover" />
        ) : (
          <div className="h-[120px] w-[120px] rounded-lg bg-input" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/marketplace/item/$listingId"
          params={{ listingId: l._id }}
          className="block truncate font-semibold text-[17px] text-primary hover:underline"
        >
          {l.title}
        </Link>
        <p className="text-[15px] text-primary">
          {priceLabel(l.price)}
          {l.originalPrice !== null && l.originalPrice > l.price && (
            <span className="ml-1.5 text-secondary line-through">{price(l.originalPrice)}</span>
          )}
        </p>
        <p className="mt-0.5 text-[13px] text-secondary">
          <span
            className={cn(
              "font-semibold",
              l.status === "active"
                ? "text-positive"
                : l.status === "sold"
                  ? "text-negative"
                  : "text-[#C77C02]",
            )}
          >
            {statusText}
          </span>{" "}
          · Listed on {listedFmt.format(l.createdAt)} in {l.city}
        </p>
        <p className="mt-0.5 text-[13px] text-secondary">
          {plural(l.stats.views, "click")} on listing · {plural(l.stats.saves, "save")} ·{" "}
          {plural(l.stats.chats, "chat")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            icon={<Check size={16} strokeWidth={2.5} />}
            onClick={() =>
              void setStatus({
                listingId: l._id,
                status: l.status === "sold" ? "active" : "sold",
              }).then(() =>
                toast.show(l.status === "sold" ? "Marked as available" : "Marked as sold"),
              )
            }
          >
            {l.status === "sold" ? "Mark as available" : "Mark as sold"}
          </Button>
          <Button
            icon={<ShareArrow size={16} />}
            onClick={() =>
              void create({
                attachments: [{ kind: "listing", listingId: l._id }],
                privacy: "friends",
              }).then(() => toast.show("Shared to your Feed"))
            }
          >
            Share
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="More options"
                className="flex h-9 w-12 items-center justify-center rounded-md bg-btn text-btn-text hover:brightness-95 dark:hover:brightness-125"
              >
                <MoreHorizontal size={20} />
              </button>
            </MenuTrigger>
            <MenuContent width={300}>
              <MenuItem
                icon={<Pencil size={18} />}
                label="Edit listing"
                onSelect={() =>
                  void navigate({
                    to: "/marketplace/edit/$listingId",
                    params: { listingId: l._id },
                  })
                }
              />
              <MenuItem
                icon={<Package size={18} />}
                label={l.status === "pending" ? "Mark as available" : "Mark as pending"}
                onSelect={() =>
                  void setStatus({
                    listingId: l._id,
                    status: l.status === "pending" ? "active" : "pending",
                  })
                }
              />
              <MenuItem
                icon={<Eye size={18} />}
                label="View listing"
                onSelect={() =>
                  void navigate({
                    to: "/marketplace/item/$listingId",
                    params: { listingId: l._id },
                  })
                }
              />
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 size={18} />}
                label="Delete listing"
                onSelect={() => setConfirm(true)}
              />
            </MenuContent>
          </Menu>
        </div>
      </div>
      <Modal open={confirm} onOpenChange={setConfirm} title="Delete listing?">
        <p className="p-4 text-[15px] text-primary">
          Are you sure you want to delete this listing? You can't undo this.
        </p>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="link" className="px-3" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await remove({ listingId: l._id });
              setConfirm(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
      {toast.node}
    </Card>
  );
}

/* ───────────── Inbox ───────────── */

export function InboxPage({ role }: { role: "selling" | "buying" }) {
  const navigate = useNavigate();
  const data = useQ(api.listings.inbox, { role });
  const { openChat } = useChatDock();
  const tab = (r: "selling" | "buying", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={role === r}
      onClick={() =>
        void navigate({
          to: "/marketplace/inbox",
          search: r === "selling" ? {} : { tab: r },
          replace: true,
        })
      }
      className={cn(
        "relative flex h-[60px] items-center gap-1.5 px-4 font-semibold text-[15px]",
        role === r ? "text-link" : "rounded-lg text-secondary hover:bg-hover",
      )}
    >
      {label}
      {(data?.unread[r] ?? 0) > 0 && (
        <span className="rounded-full bg-badge px-1.5 text-[12px] text-white leading-[18px]">
          {data?.unread[r]}
        </span>
      )}
      {role === r && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-fb" />}
    </button>
  );
  return (
    <MpShell rail={<MainRail active="inbox" />}>
      <div className="mx-auto max-w-[800px] pt-5">
        <div role="tablist" className="flex rounded-xl bg-card px-4 shadow-base">
          {tab("selling", "Selling")}
          {tab("buying", "Buying")}
        </div>
        <Card className="mt-4 rounded-xl">
          {data === undefined ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : data.rows.length === 0 ? (
            <div className="flex flex-col items-center py-7 text-center">
              <PaperPlane />
              <p className="mt-3 font-bold text-[20px] text-secondary leading-6">No chats</p>
            </div>
          ) : (
            <ul className="p-2">
              {data.rows.map((r) => (
                <li key={r.conversationId}>
                  <button
                    type="button"
                    onClick={() => openChat(r.conversationId)}
                    className="flex min-h-[76px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
                  >
                    <span className="relative shrink-0">
                      {r.listing?.photo ? (
                        <img
                          src={r.listing.photo}
                          alt=""
                          className="h-[60px] w-[60px] rounded-lg object-cover"
                        />
                      ) : (
                        <span className="block h-[60px] w-[60px] rounded-lg bg-input" />
                      )}
                      {r.other && (
                        <Avatar
                          src={r.other.avatar}
                          size={28}
                          className="absolute! -right-1.5 -bottom-1.5 rounded-full ring-2 ring-card"
                        />
                      )}
                    </span>
                    <span className="ml-1 min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[15px] text-primary leading-5",
                          r.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {r.other?.name ?? "Facebook user"} · {r.listing?.title ?? "Listing removed"}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 flex min-w-0 text-[13px] leading-4",
                          r.unread ? "font-semibold text-primary" : "text-secondary",
                        )}
                      >
                        <span className="truncate">
                          {r.lastMessage
                            ? `${r.lastMessage.fromViewer ? "You: " : ""}${r.lastMessage.text}`
                            : ""}
                        </span>
                        {r.lastMessage && (
                          <span className="shrink-0 whitespace-pre">
                            {` · ${shortAge(r.lastMessage.createdAt)}`}
                          </span>
                        )}
                      </span>
                      {r.listing && r.listing.status !== "active" && (
                        <span
                          className={cn(
                            "mt-1 inline-block rounded px-1.5 font-semibold text-[12px] leading-[18px]",
                            r.listing.status === "sold"
                              ? "bg-btn text-secondary"
                              : "bg-[#F7B928]/25 text-[#8a6100] dark:text-[#F7B928]",
                          )}
                        >
                          {r.listing.status === "sold" ? "Sold" : "Pending"}
                        </span>
                      )}
                    </span>
                    {r.unread && (
                      <span className="h-3 w-3 shrink-0 rounded-full bg-fb" title="Unread" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </MpShell>
  );
}

/* ───────────── Notifications / status / groups ───────────── */

export function MpNotificationsPage() {
  const items = useQ(api.listings.notifications, {});
  const { openChat } = useChatDock();
  const navigate = useNavigate();
  return (
    <MpShell rail={<MainRail active="notifications" />}>
      <div className="mx-auto max-w-[680px] pt-5">
        <Card className="rounded-xl p-2">
          <h2 className="px-2 pt-2 pb-1 font-bold text-[24px] text-primary leading-7">
            Notifications
          </h2>
          {items === undefined ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <PaperPlane />
              <p className="mt-3 font-bold text-[20px] text-secondary">No notifications</p>
              <p className="text-[15px] text-secondary">
                Updates about your listings will appear here.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() =>
                  n.conversationId
                    ? openChat(n.conversationId)
                    : n.listing &&
                      void navigate({
                        to: "/marketplace/item/$listingId",
                        params: { listingId: n.listing._id },
                      })
                }
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
              >
                <span className="relative shrink-0">
                  {n.listing?.photo ? (
                    <img
                      src={n.listing.photo}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="block h-14 w-14 rounded-full bg-input" />
                  )}
                  {n.actor && (
                    <Avatar
                      src={n.actor.avatar}
                      size={28}
                      className="absolute! -right-1 -bottom-1 rounded-full ring-2 ring-card"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-primary leading-5">
                    {n.actor && <b className="font-semibold">{n.actor.name} </b>}
                    {n.text}
                  </span>
                  <span
                    className={cn(
                      "block text-[13px]",
                      n.read ? "text-secondary" : "font-semibold text-link",
                    )}
                  >
                    {shortAge(n.createdAt)}
                  </span>
                </span>
                {!n.read && <span className="h-3 w-3 shrink-0 rounded-full bg-fb" />}
              </button>
            ))
          )}
        </Card>
      </div>
    </MpShell>
  );
}

export function MpStatusPage() {
  const viewer = useViewer();
  return (
    <MpShell rail={<MainRail active="status" />}>
      <div className="mx-auto max-w-[680px] pt-5">
        <Card className="rounded-xl p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-highlight text-accent">
            <ShieldIcon size={32} />
          </span>
          <h2 className="mt-3 font-bold text-[20px] text-primary">Your Marketplace access</h2>
          <p className="mt-1 text-[15px] text-secondary">
            {viewer.firstName}, your account is in good standing. You can buy and sell on
            Marketplace.
          </p>
          <div className="mt-4 divide-y divide-divider rounded-lg border border-divider text-left">
            {[
              ["Buying", "You can message sellers and save items."],
              ["Selling", "You can create listings and list in buy and sell groups."],
              ["Commerce Policies", "No violations on your account."],
            ].map(([t, s]) => (
              <div key={t} className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-positive text-white">
                  <Check size={18} strokeWidth={3} />
                </span>
                <span>
                  <span className="block font-semibold text-[15px] text-primary">{t}</span>
                  <span className="block text-[13px] text-secondary">{s}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MpShell>
  );
}

export function BuySellGroupsPage() {
  const groups = useQ(api.listings.buySellGroups, {});
  return (
    <MpShell rail={<MainRail active="groups" />}>
      <div className="pt-2">
        <div className="flex h-9 items-center">
          <h2 className="font-bold text-[20px] text-primary leading-6">Buy and sell groups</h2>
        </div>
        {groups === undefined ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : groups.length === 0 ? (
          <Empty art={<PaperPlane />} title="No buy and sell groups nearby" />
        ) : (
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {groups.map((g) => (
              <Card key={g._id} className="overflow-hidden rounded-xl">
                <Link to="/groups/$groupId" params={groupParams(g)}>
                  <img src={g.cover} alt="" className="h-[130px] w-full object-cover" />
                </Link>
                <div className="p-3">
                  <Link
                    to="/groups/$groupId"
                    params={groupParams(g)}
                    className="line-clamp-2 font-semibold text-[17px] text-primary leading-5 hover:underline"
                  >
                    {g.name}
                  </Link>
                  <p className="mt-1 text-[13px] text-secondary">
                    {g.privacy === "public" ? "Public" : "Private"} group ·{" "}
                    {g.memberCount.toLocaleString("en-US")} members
                  </p>
                  <p className="text-[13px] text-secondary">
                    {g.listingCount} {g.listingCount === 1 ? "listing" : "listings"} for sale
                  </p>
                  <Link
                    to="/groups/$groupId"
                    params={groupParams(g)}
                    className={cn(
                      "mt-3 flex h-9 items-center justify-center rounded-md font-semibold text-[15px]",
                      g.joined ? "bg-btn text-btn-text" : "bg-btn-soft text-btn-soft-text",
                    )}
                  >
                    {g.joined ? "View group" : "Join group"}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MpShell>
  );
}

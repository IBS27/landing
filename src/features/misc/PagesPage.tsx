import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Plus, Rss, UserPlus } from "lucide-react";
import { useState } from "react";
import { useM, useQ } from "@/app/viewer";
import { compactCount } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Avatar, Button, Card, EmptyState, Skeleton, VerifiedBadge } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import type { PageCard } from "../../../convex/pages";
import { AppRail, AppRailDivider, AppRailHeading, AppRailItem, RailGear } from "./AppRail";
import { CompassFilled } from "./icons";

export type PagesView = "discover" | "followed" | "invites" | "business";
export const PAGES_VIEWS: PagesView[] = ["discover", "followed", "invites", "business"];

function BusinessSuiteGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="10" cy="10" r="7.6" strokeWidth="1.8" />
      <path d="M7.5 6.2 11.6 10l-4.1 3.8" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** /pages — "Discover" Pages, Followed Pages, Invites and the viewer's own Pages. */
export function PagesPage({ view }: { view: PagesView }) {
  const navigate = useNavigate();
  const dir = useQ(api.pages.directory, {});
  const [creating, setCreating] = useState(false);
  const go = (v: PagesView) => void navigate({ to: "/pages", search: { view: v } });

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-start">
      <AppRail
        title="Pages"
        label="Page header"
        action={<RailGear label="Edit notification settings" />}
      >
        <div className="px-2 pt-1 pb-2">
          <Button
            variant="soft"
            block
            icon={<Plus size={18} strokeWidth={2.6} />}
            onClick={() => setCreating(true)}
          >
            Create Page
          </Button>
        </div>
        <AppRailDivider />
        <AppRailItem
          large
          icon={<BusinessSuiteGlyph />}
          label="Meta Business Suite"
          selected={view === "business"}
          onClick={() => go("business")}
        />
        <AppRailItem
          large
          icon={<CompassFilled />}
          label="Discover"
          selected={view === "discover"}
          onClick={() => go("discover")}
        />
        <AppRailItem
          large
          icon={<Rss size={20} strokeWidth={2.4} />}
          label="Followed Pages"
          selected={view === "followed"}
          onClick={() => go("followed")}
        />
        <AppRailItem
          large
          icon={<UserPlus size={20} strokeWidth={2.4} />}
          label="Invites"
          selected={view === "invites"}
          onClick={() => go("invites")}
        />
        {dir && dir.yours.length > 0 && (
          <>
            <AppRailDivider />
            <AppRailHeading>Your Pages and profiles</AppRailHeading>
            {dir.yours.map((p) => (
              <AppRailItem
                key={p._id}
                large
                bare
                icon={<Avatar src={p.avatar} size={36} />}
                label={p.name}
                onClick={() =>
                  void navigate({ to: "/$username", params: { username: p.username } })
                }
              />
            ))}
          </>
        )}
      </AppRail>

      <main className="flex min-w-0 flex-1 justify-center px-4 pt-[19px] pb-10">
        <div className="w-full max-w-[818px]">
          {view === "discover" && (
            <>
              <h2 className="pb-4 font-bold text-[24px] text-primary leading-7">Discover Pages</h2>
              {dir && dir.yours.length === 0 && (
                <Card className="mb-4 flex items-center gap-4 rounded-xl p-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-btn-soft text-btn-soft-text">
                    <Plus size={28} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[17px] text-primary">
                      Your Pages and profiles
                    </p>
                    <p className="text-[15px] text-secondary">
                      Create a Page to connect with customers, fans and your community.
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    Create new Page
                  </Button>
                </Card>
              )}
              <PageGrid pages={dir?.discover} />
            </>
          )}
          {view === "followed" && (
            <>
              <h2 className="pb-4 font-bold text-[24px] text-primary leading-7">Followed Pages</h2>
              {dir && dir.followed.length === 0 ? (
                <Card className="rounded-xl">
                  <EmptyState
                    title="You're not following any Pages"
                    body="Pages you follow will show up here."
                    action={
                      <Button variant="primary" onClick={() => go("discover")}>
                        Discover Pages
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <PageGrid pages={dir?.followed} />
              )}
            </>
          )}
          {view === "invites" && (
            <>
              <h2 className="pb-4 font-bold text-[24px] text-primary leading-7">Invites</h2>
              <Card className="rounded-xl">
                <EmptyState
                  icon={<UserPlus size={48} strokeWidth={1.5} />}
                  title="No invites"
                  body="When someone invites you to like or follow a Page, you'll see it here."
                />
              </Card>
            </>
          )}
          {view === "business" && (
            <Card className="rounded-xl p-6">
              <h2 className="font-bold text-[24px] text-primary leading-7">Meta Business Suite</h2>
              <p className="mt-2 max-w-xl text-[15px] text-secondary leading-5">
                Manage all of your business activity across Facebook and Instagram in one place:
                posts, messages, ads and insights.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Create a Page to get started
                </Button>
                <Link to="/ads-manager">
                  <Button variant="secondary">Go to Ads Manager</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </main>
      {creating && <CreatePageDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function PageGrid({ pages }: { pages: PageCard[] | undefined }) {
  if (pages === undefined)
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[300px] rounded-xl" />
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-3">
      {pages.map((p) => (
        <PageTile key={p._id} page={p} />
      ))}
    </div>
  );
}

function PageTile({ page }: { page: PageCard }) {
  const toggle = useM(api.pages.toggleFollow);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex flex-col overflow-hidden rounded-xl">
      <Link to="/$username" params={{ username: page.username }} className="relative block">
        <div className="h-[120px] bg-btn">
          {page.cover && <img src={page.cover} alt="" className="h-full w-full object-cover" />}
        </div>
        <span className="absolute -bottom-8 left-3 rounded-full ring-4 ring-card">
          <Avatar src={page.avatar} size={64} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col px-3 pt-10 pb-3">
        <Link
          to="/$username"
          params={{ username: page.username }}
          className="flex items-center gap-1 font-semibold text-[17px] text-primary leading-5 hover:underline"
        >
          <span className="truncate">{page.name}</span>
          {page.verified && <VerifiedBadge size={14} />}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-secondary">{page.category}</p>
        <p className="truncate text-[13px] text-secondary">
          {compactCount(page.followers)} {page.followers === 1 ? "follower" : "followers"}
        </p>
        {page.bio && (
          <p className="mt-2 line-clamp-2 text-[13px] text-primary leading-4">{page.bio}</p>
        )}
        <div className="mt-auto pt-3">
          <Button
            block
            variant={page.following ? "secondary" : "soft"}
            disabled={busy}
            icon={
              page.following ? (
                <Check size={16} strokeWidth={3} />
              ) : (
                <Rss size={16} strokeWidth={2.6} />
              )
            }
            onClick={async () => {
              setBusy(true);
              try {
                await toggle({ pageId: page._id });
              } finally {
                setBusy(false);
              }
            }}
          >
            {page.following ? "Following" : "Follow"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

const CATEGORIES = [
  "Local business",
  "Restaurant",
  "Coffee shop",
  "Artist",
  "Musician/band",
  "Community",
  "Nonprofit organization",
  "Product/service",
  "Sports team",
  "Personal blog",
];

function CreatePageDialog({ onClose }: { onClose: () => void }) {
  const create = useM(api.pages.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2 && category.trim().length > 0;
  const field =
    "w-full rounded-md border border-divider bg-card px-3 py-2.5 text-[15px] text-primary outline-none placeholder:text-placeholder focus:border-fb";

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Create a Page" width={500}>
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          setError(null);
          try {
            const res = await create({ name, category, bio: bio || undefined });
            onClose();
            void navigate({ to: "/$username", params: { username: res.username } });
          } catch {
            setError("Couldn't create the Page. Try a different name.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-[15px] text-secondary">
          Your Page is where people go to learn more about you. Make sure it has all the info they
          may need.
        </p>
        <input
          className={field}
          placeholder="Page name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={75}
          aria-label="Page name"
        />
        <p className="-mt-2 text-[13px] text-secondary">
          Use the name of your business, brand or organization, or a name that explains what the
          Page is about.
        </p>
        <input
          className={field}
          placeholder="Category (required)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="page-categories"
          aria-label="Category"
        />
        <datalist id="page-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <textarea
          className={`${field} min-h-[88px] resize-none`}
          placeholder="Bio (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={255}
          aria-label="Bio"
        />
        {error && <p className="text-[13px] text-negative">{error}</p>}
        <Button type="submit" variant="primary" block disabled={!valid || busy}>
          Create Page
        </Button>
      </form>
    </Modal>
  );
}

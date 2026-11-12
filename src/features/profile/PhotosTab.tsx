import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { useQ } from "@/app/viewer";
import { CreatePostModal } from "@/features/posts";
import { plural } from "@/lib/format";
import { IconButton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import {
  CardEmpty,
  CardMoreButton,
  CheckinsCard,
  PhotoTile,
  ProfileCard,
  ReelsCard,
  SubTabs,
} from "./cards";
import { possessive, useProfile } from "./context";
import { ImageLightbox } from "./photos";

type Tab = "of" | "yours" | "albums";

/** Photos tab: the Photos card, then Reels and Check-ins. */
export function PhotosTab() {
  const { profile } = useProfile();
  const overview = useQ(api.profiles.overview, { userId: profile.user._id });
  return (
    <div className="flex flex-col gap-4">
      <PhotosCard />
      <ReelsCard />
      <CheckinsCard checkins={overview?.checkins} />
    </div>
  );
}

/** The full-width Photos card: photos of them, their photos, and albums. */
export function PhotosCard() {
  const { profile } = useProfile();
  const { user, isSelf } = profile;
  const data = useQ(api.profiles.photos, { userId: user._id });
  const [tab, setTab] = useState<Tab>("yours");
  const [album, setAlbum] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const first = user.firstName;
  const tabs: { key: Tab; label: string }[] = [
    { key: "of", label: isSelf ? "Photos of you" : `Photos of ${first}` },
    { key: "yours", label: isSelf ? "Your photos" : `${possessive(first)} photos` },
    { key: "albums", label: "Albums" },
  ];

  const grid = "mt-4 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2";
  let body: React.ReactNode = <div className="h-40" />;
  if (data) {
    if (tab === "albums" && album) {
      const a = data.albums.find((x) => x.key === album);
      const items =
        album === "timeline"
          ? data.yours.map((p) => ({
              key: `${p.postId}-${p.index}`,
              node: <PhotoTile photo={p} className="rounded-lg" />,
            }))
          : [
              {
                key: album,
                node: (
                  <button
                    type="button"
                    onClick={() => setViewing(album === "cover" ? data.cover : data.avatar)}
                    className="block aspect-square w-full overflow-hidden rounded-lg"
                  >
                    <img
                      src={(album === "cover" ? data.cover : data.avatar) ?? ""}
                      alt=""
                      className="h-full w-full object-cover hover:brightness-95"
                    />
                  </button>
                ),
              },
            ];
      body = (
        <>
          <div className="mt-3 flex items-center gap-2">
            <IconButton label="Back to albums" variant="ghost" onClick={() => setAlbum(null)}>
              <ArrowLeft size={20} />
            </IconButton>
            <span className="font-semibold text-[17px] text-primary">{a?.name}</span>
          </div>
          <div className={grid}>
            {items.map((i) => (
              <div key={i.key}>{i.node}</div>
            ))}
          </div>
        </>
      );
    } else if (tab === "albums") {
      body = (
        <div className={grid}>
          {isSelf && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="block w-full text-left align-top"
            >
              <span className="flex aspect-square items-center justify-center rounded-lg border border-black/10 bg-btn text-secondary hover:brightness-95 dark:border-white/10">
                <Plus size={40} strokeWidth={1.6} />
              </span>
              <span className="mt-2 block font-semibold text-[15px] text-primary">
                Create album
              </span>
            </button>
          )}
          {data.albums.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAlbum(a.key)}
              className="block w-full text-left align-top"
            >
              <span className="block aspect-square overflow-hidden rounded-lg bg-wash">
                {a.cover && (
                  <img
                    src={a.cover}
                    alt=""
                    className="h-full w-full object-cover hover:brightness-95"
                  />
                )}
              </span>
              <span className="mt-2 block font-semibold text-[15px] text-primary">{a.name}</span>
              <span className="block text-[13px] text-secondary">{plural(a.count, "item")}</span>
            </button>
          ))}
        </div>
      );
    } else {
      const list = tab === "of" ? data.ofYou : data.yours;
      body =
        list.length === 0 ? (
          <CardEmpty>No photos to show</CardEmpty>
        ) : (
          <div className={grid}>
            {list.map((p) => (
              <PhotoTile key={`${p.postId}-${p.index}`} photo={p} className="rounded-lg" />
            ))}
          </div>
        );
    }
  }

  return (
    <ProfileCard
      title="Photos"
      action={
        <div className="flex items-center gap-2">
          {isSelf && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-md px-2 py-1 font-semibold text-[15px] text-link hover:bg-hover"
            >
              Add photos/video
            </button>
          )}
          <CardMoreButton
            label="More options for photos"
            items={[
              ...(isSelf
                ? [{ label: "Upload photo or video", onSelect: () => setAdding(true) }]
                : []),
              { label: "See albums", onSelect: () => setTab("albums") },
            ]}
          />
        </div>
      }
    >
      <SubTabs
        tabs={tabs}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setAlbum(null);
        }}
      />
      {body}
      {isSelf && <CreatePostModal open={adding} onOpenChange={setAdding} initialPanel="photo" />}
      {viewing && <ImageLightbox src={viewing} onClose={() => setViewing(null)} />}
    </ProfileCard>
  );
}

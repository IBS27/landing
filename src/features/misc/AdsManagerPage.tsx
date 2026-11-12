import type { FunctionReturnType } from "convex/server";
import {
  BarChart3,
  Eye,
  Megaphone,
  MousePointerClick,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";

const OBJECTIVES = [
  {
    id: "Awareness",
    Icon: Megaphone,
    body: "Show your ads to people who are most likely to remember them.",
  },
  {
    id: "Traffic",
    Icon: MousePointerClick,
    body: "Send people to a destination, like your website, app or Facebook event.",
  },
  {
    id: "Engagement",
    Icon: Users,
    body: "Get more messages, video views, post engagement or Page likes.",
  },
  { id: "Leads", Icon: UserPlus, body: "Collect leads for your business or brand." },
  {
    id: "App promotion",
    Icon: Smartphone,
    body: "Find new people to install your app and continue using it.",
  },
  {
    id: "Sales",
    Icon: ShoppingCart,
    body: "Find people likely to purchase your product or service.",
  },
] as const;

type Campaign = FunctionReturnType<typeof api.ads.campaigns>[number];

const STATS = [
  { label: "Reach", value: "0", Icon: Eye },
  { label: "Impressions", value: "0", Icon: BarChart3 },
  { label: "Amount spent", value: "$0.00", Icon: ShoppingCart },
];

const COLUMNS = [
  "Campaign",
  "Delivery",
  "Budget",
  "Results",
  "Reach",
  "Impressions",
  "Amount spent",
];

/** /ads-manager: campaigns overview; "Create" adds drafts, "Review and publish" sends them live. */
export function AdsManagerPage() {
  const viewer = useViewer();
  const [tab, setTab] = useState<"Campaigns" | "Ad sets" | "Ads">("Campaigns");
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const campaigns = useQ(api.ads.campaigns, {}) ?? [];
  const create = useM(api.ads.create);
  const setOn = useM(api.ads.setOn);
  const [q, setQ] = useState("");
  const rows = campaigns.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const drafts = campaigns.filter((c) => c.status === "draft");

  return (
    <main className="px-6 pt-5 pb-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex items-center gap-3 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-btn-soft text-btn-soft-text">
            <BarChart3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[24px] text-primary leading-7">Ads Manager</h1>
            <p className="text-[13px] text-secondary">Ad account · {viewer.name}</p>
          </div>
          <Button
            variant={drafts.length ? "primary" : "secondary"}
            onClick={() => setReviewing(true)}
          >
            Review and publish{drafts.length > 0 && ` (${drafts.length})`}
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          {STATS.map(({ label, value, Icon }) => (
            <Card key={label} className="flex items-center gap-3 rounded-xl p-4">
              <Icon size={20} className="text-icon-secondary" />
              <div>
                <p className="text-[13px] text-secondary">{label}</p>
                <p className="font-bold text-[20px] text-primary">{value}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden rounded-xl">
          <div className="flex border-divider border-b px-2">
            {(["Campaigns", "Ad sets", "Ads"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "relative px-4 py-3 font-semibold text-[15px]",
                  tab === t ? "text-fb" : "text-secondary hover:bg-hover",
                )}
              >
                {t}
                {tab === t && (
                  <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-fb" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="primary"
              icon={<Plus size={18} strokeWidth={2.6} />}
              onClick={() => setCreating(true)}
            >
              Create
            </Button>
            <label className="ml-auto flex h-9 w-[280px] items-center gap-2 rounded-md border border-divider px-2">
              <Search size={16} className="text-icon-secondary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search to filter by name"
                aria-label="Search campaigns"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-placeholder"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-wash text-secondary">
                <tr>
                  <th className="w-16 px-3 py-2 font-semibold">Off/On</th>
                  {COLUMNS.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id} className="border-divider border-t">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.on}
                        aria-label={`Turn ${c.name} ${c.on ? "off" : "on"}`}
                        onClick={() => void setOn({ campaignId: c._id, on: !c.on })}
                        className={cn(
                          "relative h-5 w-9 rounded-full",
                          c.on ? "bg-fb" : "bg-[#8f9297]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]",
                            c.on ? "left-[18px]" : "left-0.5",
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold text-link">{c.name}</td>
                    <td className="px-3 py-2 text-primary">
                      <Delivery campaign={c} />
                    </td>
                    <td className="px-3 py-2 text-primary">${c.dailyBudget.toFixed(2)} Daily</td>
                    <td className="px-3 py-2 text-secondary">—</td>
                    <td className="px-3 py-2 text-secondary">—</td>
                    <td className="px-3 py-2 text-secondary">—</td>
                    <td className="px-3 py-2 text-primary">$0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <BarChart3 size={48} strokeWidth={1.4} className="text-icon-secondary" />
              <p className="mt-3 font-bold text-[20px] text-primary">
                {campaigns.length
                  ? "No campaigns match your search"
                  : "You don't have any campaigns yet"}
              </p>
              <p className="mt-1 max-w-md text-[15px] text-secondary">
                Create a campaign to reach new people, get more messages or promote your Page.
              </p>
              {campaigns.length === 0 && (
                <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
                  Create campaign
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
      {creating && (
        <CreateCampaign
          onClose={() => setCreating(false)}
          onCreate={(objective) => {
            void create({ objective });
            setCreating(false);
          }}
        />
      )}
      {reviewing && (
        <ReviewAndPublish
          drafts={drafts}
          audience={viewer.city ?? "United States"}
          onCreate={() => {
            setReviewing(false);
            setCreating(true);
          }}
          onClose={() => setReviewing(false)}
        />
      )}
    </main>
  );
}

function CreateCampaign({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (o: string) => void;
}) {
  const [pick, setPick] = useState<string>("Awareness");
  const chosen = OBJECTIVES.find((o) => o.id === pick) ?? OBJECTIVES[0];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Create new campaign" width={720}>
      <div className="flex gap-4 p-4">
        <div className="w-[260px] shrink-0">
          <p className="pb-2 font-semibold text-[15px] text-primary">Choose a campaign objective</p>
          {OBJECTIVES.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                pick === o.id ? "bg-highlight" : "hover:bg-hover",
              )}
            >
              <input
                type="radio"
                name="objective"
                checked={pick === o.id}
                onChange={() => setPick(o.id)}
                className="h-4 w-4 accent-[var(--fb-blue)]"
              />
              <o.Icon size={20} className="text-icon" />
              <span className="font-medium text-[15px] text-primary">{o.id}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-wash p-6 text-center">
          <chosen.Icon size={56} strokeWidth={1.4} className="text-fb" />
          <p className="mt-3 font-bold text-[20px] text-primary">{chosen.id}</p>
          <p className="mt-1 text-[15px] text-secondary">{chosen.body}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-divider border-t p-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onCreate(pick)}>
          Continue
        </Button>
      </div>
    </Modal>
  );
}

/** Ads Manager's Delivery column: a status dot and label. */
function Delivery({ campaign: c }: { campaign: Campaign }) {
  const [dot, label] =
    c.status === "draft"
      ? ["bg-[#8f9297]", "In draft"]
      : c.on
        ? ["bg-online", "Active"]
        : ["bg-[#8f9297]", "Off"];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}

/** "Review and publish": what's about to go live, then Publish. */
function ReviewAndPublish({
  drafts,
  audience,
  onCreate,
  onClose,
}: {
  drafts: Campaign[];
  audience: string;
  onCreate: () => void;
  onClose: () => void;
}) {
  const publish = useM(api.ads.publishDrafts);
  const [state, setState] = useState<"review" | "publishing" | "done">("review");
  const [published, setPublished] = useState(0);
  const total = drafts.reduce((sum, d) => sum + (d.on ? d.dailyBudget : 0), 0);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Review and publish" width={640}>
      {state === "done" ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-online text-white">
            <Megaphone size={28} />
          </span>
          <p className="mt-3 font-bold text-[20px] text-primary">
            {published === 1 ? "Your campaign is published" : `${published} campaigns published`}
          </p>
          <p className="mt-1 max-w-md text-[15px] text-secondary">
            Your ads are being reviewed and will start delivering once they're approved. Most ads
            are reviewed within 24 hours.
          </p>
          <Button variant="primary" className="mt-5 px-8" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <BarChart3 size={48} strokeWidth={1.4} className="text-icon-secondary" />
          <p className="mt-3 font-bold text-[20px] text-primary">No edits to review</p>
          <p className="mt-1 max-w-md text-[15px] text-secondary">
            Create a campaign, then come back here to review and publish it.
          </p>
          <Button variant="primary" className="mt-5" onClick={onCreate}>
            Create campaign
          </Button>
        </div>
      ) : (
        <>
          <div className="p-4">
            <p className="text-[15px] text-secondary">
              You're about to publish{" "}
              {drafts.length === 1 ? "1 campaign" : `${drafts.length} campaigns`}. Review the
              details below.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {drafts.map((d) => {
                const o = OBJECTIVES.find((x) => x.id === d.objective) ?? OBJECTIVES[0];
                return (
                  <li key={d._id} className="flex gap-3 rounded-lg border border-divider p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-btn-soft text-btn-soft-text">
                      <o.Icon size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[15px] text-primary">{d.name}</p>
                      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-0.5 text-[13px]">
                        <dt className="text-secondary">Objective</dt>
                        <dd className="text-primary">{d.objective}</dd>
                        <dt className="text-secondary">Budget</dt>
                        <dd className="text-primary">${d.dailyBudget.toFixed(2)} daily</dd>
                        <dt className="text-secondary">Audience</dt>
                        <dd className="text-primary">{audience} · Ages 18–65+</dd>
                        <dt className="text-secondary">Placements</dt>
                        <dd className="text-primary">Advantage+ placements</dd>
                        <dt className="text-secondary">Schedule</dt>
                        <dd className="text-primary">
                          {d.on ? "Starts as soon as it's approved" : "Off (won't deliver)"}
                        </dd>
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[13px] text-secondary">
              Estimated daily spend: <b className="text-primary">${total.toFixed(2)}</b>. By
              clicking Publish, you agree to Meta's Terms and Advertising Policies.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-divider border-t p-3">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              className="px-6"
              disabled={state === "publishing"}
              onClick={() => {
                setState("publishing");
                publish({}).then(
                  (n) => {
                    setPublished(n);
                    setState("done");
                  },
                  () => setState("review"),
                );
              }}
            >
              Publish
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

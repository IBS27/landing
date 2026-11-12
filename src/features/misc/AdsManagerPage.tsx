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
import { useViewer } from "@/app/viewer";
import { cn } from "@/lib/format";
import { Modal } from "@/ui/overlays";
import { Button, Card } from "@/ui/primitives";

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

type Campaign = { id: number; name: string; objective: string; on: boolean; budget: number };

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

/** /ads-manager — campaigns overview with a working "Create" flow (local drafts). */
export function AdsManagerPage() {
  const viewer = useViewer();
  const [tab, setTab] = useState<"Campaigns" | "Ad sets" | "Ads">("Campaigns");
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [q, setQ] = useState("");
  const rows = campaigns.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

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
          <Button variant="secondary">Review and publish</Button>
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
                  <tr key={c.id} className="border-divider border-t">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.on}
                        aria-label={`Turn ${c.name} ${c.on ? "off" : "on"}`}
                        onClick={() =>
                          setCampaigns((cs) =>
                            cs.map((x) => (x.id === c.id ? { ...x, on: !x.on } : x)),
                          )
                        }
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
                    <td className="px-3 py-2 text-primary">{c.on ? "In draft" : "Off"}</td>
                    <td className="px-3 py-2 text-primary">${c.budget.toFixed(2)} Daily</td>
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
            setCampaigns((cs) => [
              ...cs,
              {
                id: Date.now(),
                name: `New ${objective} Campaign`,
                objective,
                on: true,
                budget: 20,
              },
            ]);
            setCreating(false);
          }}
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

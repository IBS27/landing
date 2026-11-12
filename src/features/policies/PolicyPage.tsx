import { RailDivider, RailHeading, RailItem, SideRail } from "@/features/feed/SideRail";
import { PageUnavailable } from "@/layout/PageUnavailable";
import { Card } from "@/ui/primitives";
import { POLICIES, policyBySlug } from "./policies";

/** /policies/<slug>: Facebook's Terms and Policies pages (rail of policies + the document). */
export function PolicyPage({ slug }: { slug: string }) {
  const policy = policyBySlug(slug);
  if (!policy) return <PageUnavailable />;
  const row = (p: (typeof POLICIES)[number]) => (
    <RailItem
      key={p.slug}
      icon={<p.Icon size={20} />}
      label={p.title}
      selected={p.slug === slug}
      to={`/policies/${p.slug}`}
    />
  );
  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-wash">
      <SideRail title="Terms and Policies" label="Terms and Policies">
        {POLICIES.filter((p) => p.group === "policies").map(row)}
        <RailDivider />
        <RailHeading>More from Meta</RailHeading>
        {POLICIES.filter((p) => p.group === "more").map(row)}
      </SideRail>
      <main className="min-w-0 flex-1 px-4 py-6">
        <Card className="mx-auto max-w-[760px] rounded-xl px-10 py-8">
          <p className="flex items-center gap-2 text-[13px] text-secondary">
            <policy.Icon size={16} />
            {policy.group === "policies" ? "Terms and Policies" : "Meta"}
          </p>
          <h1 className="mt-2 font-bold text-[32px] text-primary leading-[38px]">{policy.title}</h1>
          <p className="mt-1 text-[15px] text-secondary">Effective {policy.updated}</p>
          <p className="mt-5 text-[17px] text-primary leading-6">{policy.intro}</p>
          {policy.sections.map((s) => (
            <section key={s.heading} className="mt-6 border-divider border-t pt-5">
              <h2 className="font-bold text-[20px] text-primary leading-6">{s.heading}</h2>
              <p className="mt-2 text-[15px] text-primary leading-[22px]">{s.body}</p>
            </section>
          ))}
        </Card>
      </main>
    </div>
  );
}

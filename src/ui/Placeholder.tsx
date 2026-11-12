import { Card } from "./primitives";

/** Temporary page body while a surface is being built. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-6">
      <Card className="p-6">
        <h1 className="font-bold text-xl">{title}</h1>
        <p className="mt-1 text-secondary">Coming soon.</p>
      </Card>
    </div>
  );
}

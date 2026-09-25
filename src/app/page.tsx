import { PlatformStatus } from "@/shared/components/PlatformStatus";

export default function OverviewPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-zinc-600">
          Requirements enter as raw text and leave as an explained, quantified sprint plan. Each component is developed
          in its own repository and reached through the API gateway.
        </p>
      </header>
      <PlatformStatus />
    </div>
  );
}

import { PageHeader } from "@/shared/components/PageHeader";
import { PlatformStatus } from "@/shared/components/PlatformStatus";

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Platform overview"
        description="Requirements enter as raw text and leave as an explained, quantified sprint plan. Each component is developed in its own repository and reached through the API gateway."
      />
      <PlatformStatus />
    </div>
  );
}

"use client";

import { ConstructionIcon } from "lucide-react";

import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge, type Status } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { getModule, type ModuleSlug } from "@/shared/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

/** Starting page for a module until its owner builds the real one. */
export function ModulePlaceholder({ slug }: { slug: ModuleSlug }) {
  const info = getModule(slug);
  const health = usePlatformHealth();
  const status: Status = health.isPending ? "unknown" : health.data?.components[slug]?.status ?? "down";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={info.name} description={info.description}>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
          <StatusBadge status={status} />
          <span>Owner: @{info.owner}</span>
        </div>
      </PageHeader>

      <Card className="border border-dashed bg-transparent ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ConstructionIcon aria-hidden className="size-4 text-muted-foreground" />
            <h2>This page has not been built yet</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              Pages go in <code className="text-foreground">src/app/(modules)/{slug}/</code>; components, hooks and API calls
              for this module in private folders inside it (for example <code className="text-foreground">_components/</code>).
              List the pages in <code className="text-foreground">_nav.ts</code> there to show them in the sidebar.
            </li>
            <li>
              Build with the shared UI kit in <code className="text-foreground">src/shared/ui/</code> (shadcn/ui on Radix):
              it follows the platform&apos;s theme, dark mode and keyboard rules.
            </li>
            <li>
              Call the component through the gateway: <code className="text-foreground">gatewayFetch(&quot;api/v1/{slug}/…&quot;)</code>.
            </li>
            <li>
              Request and response shapes: <code className="text-foreground">contracts/{slug}/</code>. Interactive API docs while
              the service runs: <code className="text-foreground">http://localhost:{info.apiPort}/docs</code>.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { StatusBadge, type Status } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { getModule, type ModuleSlug } from "@/shared/modules";

/** Starting page for a module until its owner builds the real one. */
export function ModulePlaceholder({ slug }: { slug: ModuleSlug }) {
  const info = getModule(slug);
  const health = usePlatformHealth();
  const status: Status = health.isPending ? "unknown" : health.data?.components[slug]?.status ?? "down";

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{info.name}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="text-zinc-600">{info.description}</p>
        <p className="text-sm text-zinc-500">Owner: @{info.owner}</p>
      </header>

      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-700">
        <h2 className="mb-2 font-medium text-zinc-900">This page has not been built yet</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Pages go in <code>src/app/(modules)/{slug}/</code>; components, hooks and API calls for this module in private
            folders inside it (for example <code>_components/</code>).
          </li>
          <li>
            Call the component through the gateway: <code>gatewayFetch(&quot;api/v1/{slug}/…&quot;)</code>.
          </li>
          <li>
            Request and response shapes: <code>contracts/{slug}/</code>. Interactive API docs while the service runs:{" "}
            <code>http://localhost:{info.apiPort}/docs</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}

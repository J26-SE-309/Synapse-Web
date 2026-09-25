"use client";

import Link from "next/link";

import { GATEWAY_URL } from "@/shared/api/gateway";
import { StatusBadge, type Status } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { MODULES } from "@/shared/modules";

export function PlatformStatus() {
  const health = usePlatformHealth();
  const gatewayStatus: Status = health.isPending ? "unknown" : health.isError ? "down" : "up";

  return (
    <section aria-labelledby="platform-status" className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <h2 id="platform-status" className="font-medium">
            API gateway
          </h2>
          <p className="text-sm text-zinc-500">{GATEWAY_URL}</p>
        </div>
        <StatusBadge status={gatewayStatus} />
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((entry, index) => {
          const component = health.data?.components[entry.slug];
          const status: Status = health.isPending ? "unknown" : component?.status ?? "down";
          return (
            <li key={entry.slug} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Component {index + 1}</p>
                <StatusBadge status={status} />
              </div>
              <h3 className="mt-1 font-medium">
                <Link href={`/${entry.slug}`} className="hover:underline">
                  {entry.name}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{entry.description}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Owner @{entry.owner} · API port {entry.apiPort}
                {component?.version ? ` · v${component.version}` : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

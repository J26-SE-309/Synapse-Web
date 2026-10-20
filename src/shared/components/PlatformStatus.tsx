"use client";

import { ServerIcon } from "lucide-react";

import { GATEWAY_URL } from "@/shared/api/gateway";
import { StatusBadge, type Status } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { MODULES } from "@/shared/modules";
import { NAV_MODULES } from "@/shared/navigation";

/** The gateway and each component's service: running or not, who owns it, and where it listens. */
export function PlatformStatus() {
  const health = usePlatformHealth();
  const gatewayStatus: Status = health.isPending ? "unknown" : health.isError ? "down" : "up";

  const rows = [
    { key: "gateway", icon: ServerIcon, name: "API gateway", detail: GATEWAY_URL, status: gatewayStatus, mono: true },
    ...MODULES.map((entry, index) => {
      const component = health.data?.components[entry.slug];
      return {
        key: entry.slug,
        icon: NAV_MODULES[index].icon,
        name: entry.name,
        detail: `Owner @${entry.owner} · API port ${entry.apiPort}${component?.version ? ` · v${component.version}` : ""}`,
        status: (health.isPending ? "unknown" : component?.status ?? "down") as Status,
        mono: false,
      };
    }),
  ];

  return (
    <ul aria-label="Platform status" className="divide-y overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft)">
      {rows.map(({ key, icon: Icon, name, detail, status, mono }) => (
        <li key={key} className="flex items-center gap-4 px-5 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className={mono ? "truncate font-mono text-xs text-muted-foreground" : "truncate text-xs text-muted-foreground"}>{detail}</p>
          </div>
          <StatusBadge status={status} />
        </li>
      ))}
    </ul>
  );
}

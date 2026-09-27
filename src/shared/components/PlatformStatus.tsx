"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { GATEWAY_URL } from "@/shared/api/gateway";
import { StatusBadge, type Status } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { MODULES } from "@/shared/modules";
import { NAV_MODULES } from "@/shared/navigation";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";

export function PlatformStatus() {
  const health = usePlatformHealth();
  const gatewayStatus: Status = health.isPending ? "unknown" : health.isError ? "down" : "up";

  return (
    <section aria-labelledby="platform-status" className="space-y-4">
      <h2 id="platform-status" className="sr-only">
        Platform status
      </h2>
      <Card size="sm">
        <CardHeader>
          <CardTitle>API gateway</CardTitle>
          <CardDescription className="font-mono text-xs">{GATEWAY_URL}</CardDescription>
          <CardAction>
            <StatusBadge status={gatewayStatus} />
          </CardAction>
        </CardHeader>
      </Card>

      <ol className="grid gap-4 md:grid-cols-2">
        {MODULES.map((entry, index) => {
          const component = health.data?.components[entry.slug];
          const status: Status = health.isPending ? "unknown" : component?.status ?? "down";
          const Icon = NAV_MODULES[index].icon;
          return (
            <li key={entry.slug} className="flex">
              <Card className="flex-1">
                <CardHeader>
                  <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <Icon aria-hidden className="size-4" />
                    Component {index + 1}
                  </p>
                  <CardAction>
                    <StatusBadge status={status} />
                  </CardAction>
                  <CardTitle>
                    <h3>{entry.name}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground">{entry.description}</CardContent>
                <CardFooter className="justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Owner @{entry.owner} · API port {entry.apiPort}
                    {component?.version ? ` · v${component.version}` : ""}
                  </span>
                  <Link
                    href={`/${entry.slug}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Open <span className="sr-only">{entry.shortName}</span>
                    <ArrowRightIcon aria-hidden className="size-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { ChevronRightIcon, WaypointsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { cn } from "@/shared/lib/utils";
import { isCurrent, NAV_MODULES, PLATFORM_PAGES, type NavModule } from "@/shared/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/shared/ui/sidebar";

function ModuleItem({ entry, pathname }: { entry: NavModule; pathname: string }) {
  const { setOpenMobile } = useSidebar();
  const inModule = isCurrent(pathname, entry.href);
  const Icon = entry.icon;

  if (entry.pages.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={inModule} tooltip={entry.title}>
          <Link href={entry.href} aria-current={inModule ? "page" : undefined} onClick={() => setOpenMobile(false)}>
            <Icon aria-hidden />
            <span>{entry.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={inModule} className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={inModule} tooltip={entry.title}>
          <Link href={entry.href} onClick={() => setOpenMobile(false)}>
            <Icon aria-hidden />
            <span>{entry.title}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction aria-label={`Show or hide the ${entry.title} pages`}>
            <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {entry.pages.map((page) => {
              const current = isCurrent(pathname, page.href, page.href === entry.href);
              return (
                <SidebarMenuSubItem key={page.href}>
                  <SidebarMenuSubButton asChild isActive={current}>
                    <Link href={page.href} aria-current={current ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                      <span>{page.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function PlatformHealthSummary() {
  const health = usePlatformHealth();
  const { setOpenMobile } = useSidebar();
  const statuses = Object.values(health.data?.components ?? {});
  const running = statuses.filter((entry) => entry.status === "up").length;
  const state = health.isPending ? "checking" : health.isError ? "down" : running === statuses.length ? "up" : "partial";
  const text = {
    checking: "Checking services…",
    down: "Gateway not reachable",
    up: `All ${statuses.length} services running`,
    partial: `${running} of ${statuses.length} services running`,
  }[state];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="sm" tooltip={text}>
          <Link href="/" onClick={() => setOpenMobile(false)}>
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                state === "up" && "bg-success",
                state === "partial" && "bg-warning",
                state === "down" && "bg-danger",
                state === "checking" && "bg-muted-foreground",
              )}
            />
            <span className="text-muted-foreground">{text}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Synapse">
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <WaypointsIcon aria-hidden className="size-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Synapse</span>
                  <span className="truncate text-xs text-muted-foreground">Agile requirements platform</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Main" className="flex flex-col gap-2">
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PLATFORM_PAGES.map((page) => {
                const current = isCurrent(pathname, page.href, page.href === "/");
                const Icon = page.icon;
                return (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton asChild isActive={current} tooltip={page.title}>
                      <Link href={page.href} aria-current={current ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                        <Icon aria-hidden />
                        <span>{page.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Components</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MODULES.map((entry) => (
                <ModuleItem key={entry.slug} entry={entry} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <PlatformHealthSummary />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

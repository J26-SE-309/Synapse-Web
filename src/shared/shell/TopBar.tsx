"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { breadcrumbs } from "@/shared/navigation";
import { ProjectSwitcher } from "@/shared/projects/ProjectSwitcher";
import { ThemeToggle } from "@/shared/theme/ThemeToggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { Kbd } from "@/shared/ui/kbd";
import { Separator } from "@/shared/ui/separator";
import { SidebarTrigger } from "@/shared/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export function TopBar() {
  const crumbs = breadcrumbs(usePathname());

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="-ml-1" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Sidebar <Kbd>Ctrl</Kbd>
          <Kbd>B</Kbd>
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                {index > 0 ? <BreadcrumbSeparator className="hidden sm:block" /> : null}
                <BreadcrumbItem className={last ? "min-w-0" : "hidden sm:inline-flex"}>
                  {last ? (
                    <BreadcrumbPage className="truncate">{crumb.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.title}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <ProjectSwitcher className="w-40 sm:w-56" />
      <ThemeToggle />
    </header>
  );
}

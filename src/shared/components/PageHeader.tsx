import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** A page's title (its one h1), what it is for, and its main actions. */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  eyebrow,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A small tile with the page's icon, left of the title. */
  icon?: LucideIcon;
  /** A short line above the title, e.g. the project or the component. */
  eyebrow?: ReactNode;
  /** Extra lines under the description, e.g. badges. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="mt-0.5 hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-chart-3/10 text-primary ring-1 ring-primary/15 sm:flex">
            <Icon aria-hidden className="size-6" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {description ? <p className="max-w-3xl text-[0.9375rem]/relaxed text-muted-foreground">{description}</p> : null}
          {children}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

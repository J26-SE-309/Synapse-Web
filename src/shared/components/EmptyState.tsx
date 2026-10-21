import type { ComponentType, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * A friendly empty, first-step or error state: a drawing, what is going on in a sentence, and what to do next.
 * The drawing is decorative; the title and description carry the meaning.
 */
export function EmptyState({
  illustration: Illustration,
  title,
  description,
  actions,
  size = "default",
  className,
  headingLevel = "h2",
}: {
  illustration: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "sm";
  className?: string;
  headingLevel?: "h1" | "h2" | "h3" | "p";
}) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 text-center text-balance",
        size === "default" ? "gap-5 px-6 py-12" : "gap-3 px-4 py-8",
        className,
      )}
    >
      <Illustration className={size === "default" ? "w-56 max-w-full" : "w-40 max-w-full"} />
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <Heading className={cn("font-semibold tracking-tight", size === "default" ? "text-lg" : "text-base")}>{title}</Heading>
        {description ? <div className="text-sm/relaxed text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Consistent responsive width and vertical rhythm for application pages. */
export function PageContainer({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return <div id={id} className={cn("mx-auto w-full max-w-7xl space-y-5", className)}>{children}</div>;
}

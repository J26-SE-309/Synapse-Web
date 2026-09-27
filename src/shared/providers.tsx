"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ProjectProvider } from "@/shared/projects/ProjectProvider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function Providers({ initialProjectId, children }: { initialProjectId: string | null; children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ProjectProvider initialProjectId={initialProjectId}>{children}</ProjectProvider>
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

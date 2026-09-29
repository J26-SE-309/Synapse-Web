import type { ReactNode } from "react";

import { AppSidebar } from "@/shared/shell/AppSidebar";
import { TopBar } from "@/shared/shell/TopBar";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";

/**
 * The frame every page sits in: the sidebar (collapses to icons with Ctrl+B, or slides in on phones), the top bar
 * with where you are, the project and the theme, and the page itself.
 */
export function AppShell({ sidebarOpen, children }: { sidebarOpen: boolean; children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <AppSidebar />
      {/* min-w-0: wide content (tables, boards) scrolls inside its own box instead of widening the page */}
      <SidebarInset className="min-w-0">
        <TopBar />
        <div id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

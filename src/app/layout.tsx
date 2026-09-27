import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { PROJECT_COOKIE } from "@/shared/projects/cookie";
import { Providers } from "@/shared/providers";
import { AppShell } from "@/shared/shell/AppShell";
import { THEME_SCRIPT } from "@/shared/theme/script";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Synapse", template: "%s · Synapse" },
  description: "AI-assisted agile requirements quality, traceability and planning platform.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1220" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The sidebar's open state and the chosen project come back from cookies, so the first render already
  // matches them (every page is rendered per request; login will require that anyway, NFR5).
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const projectId = cookieStore.get(PROJECT_COOKIE)?.value || null;

  return (
    <html lang="en" className={cn(sans.variable, mono.variable)} suppressHydrationWarning>
      <head>
        {/* Light or dark before the first paint, so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <Providers initialProjectId={projectId}>
          <AppShell sidebarOpen={sidebarOpen}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Sidebar } from "@/shared/components/Sidebar";
import { Providers } from "@/shared/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Synapse", template: "%s · Synapse" },
  description: "AI-assisted agile requirements quality, traceability and planning platform.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white">
              <Sidebar />
            </aside>
            <main className="flex-1 p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

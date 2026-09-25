"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MODULES } from "@/shared/modules";

const LINKS = [{ href: "/", label: "Overview" }, ...MODULES.map((entry) => ({ href: `/${entry.slug}`, label: entry.shortName }))];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-5 py-6">
        <p className="text-lg font-semibold tracking-tight">Synapse</p>
        <p className="text-xs text-zinc-500">Agile requirements platform</p>
      </div>
      <ul className="space-y-1 px-3">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? "bg-zinc-900 font-medium text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

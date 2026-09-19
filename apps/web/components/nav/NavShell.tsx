"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Bottom tab bar on mobile (thumb reach, one hand), left sidebar on desktop.
 * Same nav model, same active-state logic — just two renderings of it,
 * so "onde estou" never depends on screen size.
 */
export function NavShell({
  items,
  brand,
  children,
}: {
  items: NavItem[];
  brand: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-surface md:flex md:flex-col">
        <div className="flex h-16 items-center px-6">{brand}</div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-surface-muted hover:text-ink-900"
                )}
              >
                <item.icon size={20} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-ink-100 bg-surface px-4 md:hidden">
          {brand}
        </header>

        <main className="flex-1 pb-20 md:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-surface/95 backdrop-blur md:hidden">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-brand-600" : "text-ink-400"
                )}
              >
                <item.icon size={22} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

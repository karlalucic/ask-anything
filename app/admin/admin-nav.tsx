import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin/runs", label: "Generations", active: "runs" },
  { href: "/admin/cost", label: "Costs", active: "costs" },
] as const;

export function AdminNav({
  active,
  children,
}: {
  active?: "home" | "runs" | "costs";
  children?: ReactNode;
}) {
  return (
    <header className="px-6 pt-6">
      <div className="liquid-glass mx-auto flex max-w-6xl flex-col gap-4 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-6 sm:py-3">
        <Link href="/admin" className="font-mono text-sm text-white/45 transition-colors duration-150 hover:text-white">
          admin
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = active === item.active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm transition-colors duration-150 ${
                  isActive ? "bg-white text-black" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {children}
        </nav>
      </div>
    </header>
  );
}

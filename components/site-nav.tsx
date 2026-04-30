import Link from "next/link";
import type { ReactNode } from "react";

export function SiteNav({ children, minimal = false }: { children?: ReactNode; minimal?: boolean }) {
  return (
    <header className="px-6 pt-6">
      <div className="liquid-glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3">
        <Link href="/" className="font-display text-xl font-normal text-white">
          ask anything
        </Link>
        {children ? (
          <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
        ) : minimal ? (
          <span className="size-1 rounded-full bg-white/30" aria-hidden />
        ) : null}
      </div>
    </header>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export function SiteNav({ children, minimal = false }: { children?: ReactNode; minimal?: boolean }) {
  return (
    <header className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:pt-6">
      <div className="liquid-glass mx-auto flex min-h-14 max-w-6xl items-center justify-between rounded-2xl px-4 py-2 sm:rounded-full sm:px-6 sm:py-3">
        <Link href="/" className="font-display text-lg font-normal text-white sm:text-xl">
          ask anything
        </Link>
        {children ? (
          <div className="flex min-w-0 items-center justify-end gap-2 max-sm:[&>*:not(:last-child)]:hidden sm:gap-3">{children}</div>
        ) : minimal ? (
          <span className="size-1 rounded-full bg-white/30" aria-hidden />
        ) : null}
      </div>
    </header>
  );
}

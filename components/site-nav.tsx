import Link from "next/link";
import type { ReactNode } from "react";

export function SiteNav({ children, minimal = false }: { children?: ReactNode; minimal?: boolean }) {
  return (
    <header className="px-3 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:pt-6">
      <div className="liquid-glass mx-auto flex max-w-6xl flex-wrap items-center gap-2 rounded-2xl px-3 py-2 sm:min-h-14 sm:flex-nowrap sm:justify-between sm:rounded-full sm:px-6 sm:py-3">
        <Link href="/" className="shrink-0 font-display text-lg font-normal text-white sm:text-xl">
          ask anything
        </Link>
        {children ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none sm:flex-nowrap sm:gap-3 max-sm:[&>*]:min-h-11 max-sm:[&>a]:inline-flex max-sm:[&>a]:items-center max-sm:[&>a]:rounded-full max-sm:[&>button]:min-w-11">
            {children}
          </div>
        ) : minimal ? (
          <span className="size-1 rounded-full bg-white/30" aria-hidden />
        ) : null}
      </div>
    </header>
  );
}

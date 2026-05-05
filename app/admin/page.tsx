import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, LibraryBig } from "lucide-react";
import { AdminNav } from "@/app/admin/admin-nav";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

interface UsageCostRow {
  cost_usd: number;
}

function fmtUsd(n: number): string {
  if (!n) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) notFound();

  const service = createSupabaseServiceClient();
  // eslint-disable-next-line react-hooks/purity -- server component renders once per request
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();
  const [{ count: generationCount }, { count: completeCount }, { data: recentCosts }] = await Promise.all([
    service.from("generations").select("id", { count: "exact", head: true }),
    service.from("generations").select("id", { count: "exact", head: true }).eq("status", "complete"),
    service.from("provider_usage_events").select("cost_usd").gte("created_at", since7d).limit(5000),
  ]);
  const cost7d = ((recentCosts ?? []) as UsageCostRow[]).reduce((sum, row) => sum + Number(row.cost_usd), 0);

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminNav active="home" />

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-2xl font-normal leading-snug text-white">Admin dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
            Start with the generation library to review user outputs, or open costs to inspect spend by user, provider, and stage.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/runs" className="liquid-glass group rounded-xl p-6 transition-all duration-150 hover:bg-white/5">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="flex size-11 items-center justify-center rounded-full bg-white text-black">
                <LibraryBig className="size-5" aria-hidden />
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45 group-hover:text-white/70">
                Open
              </span>
            </div>
            <h2 className="text-xl font-medium text-white">Generation library</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              View every generated audiobook, open the player, read scripts, and inspect prompt details.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs text-white/40">
              <span>{generationCount ?? 0} total</span>
              <span>{completeCount ?? 0} complete</span>
            </div>
          </Link>

          <Link href="/admin/cost" className="liquid-glass group rounded-xl p-6 transition-all duration-150 hover:bg-white/5">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="flex size-11 items-center justify-center rounded-full bg-white text-black">
                <BarChart3 className="size-5" aria-hidden />
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45 group-hover:text-white/70">
                Open
              </span>
            </div>
            <h2 className="text-xl font-medium text-white">Cost dashboard</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              See estimated generation spend by user, provider, stage, and recent prompt.
            </p>
            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/40">
              <span>{fmtUsd(cost7d)} in the last 7 days</span>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}

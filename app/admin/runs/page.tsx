import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { GenerationStatus } from "@/lib/types";

const PAGE_SIZE = 24;

interface AdminGenerationRow {
  id: string;
  topic: string;
  title: string | null;
  duration: number;
  status: GenerationStatus;
  user_id: string;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface UsageCostRow {
  generation_id: string | null;
  cost_usd: number;
}

const STATUS_VARIANT: Record<GenerationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  outlining: "secondary",
  researching: "secondary",
  drafting: "secondary",
  aggregating: "secondary",
  synthesizing: "secondary",
  complete: "default",
  failed: "destructive",
  canceling: "outline",
  canceled: "outline",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAudioDuration(seconds: number | null): string {
  if (!seconds) return "No audio";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtUsd(n: number): string {
  if (!n) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function userLabel(profile: ProfileRow | undefined, userId: string): string {
  if (profile?.email) return profile.email;
  if (profile?.display_name) return profile.display_name;
  return `user:${userId.slice(0, 8)}`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) notFound();

  const query = await searchParams;
  const currentPage = Math.max(1, Number(firstParam(query.page) ?? "1") || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const service = createSupabaseServiceClient();
  const { data, count } = await service
    .from("generations")
    .select("id, topic, title, duration, status, user_id, audio_path, audio_duration_seconds, created_at, completed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const generations = (data ?? []) as AdminGenerationRow[];
  const generationIds = generations.map((g) => g.id);
  const userIds = Array.from(new Set(generations.map((g) => g.user_id)));

  const [{ data: profileRows }, { data: costRows }] = await Promise.all([
    userIds.length > 0
      ? service.from("profiles").select("id, email, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    generationIds.length > 0
      ? service.from("provider_usage_events").select("generation_id, cost_usd").in("generation_id", generationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map(((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const costByGenerationId = new Map<string, number>();
  for (const row of (costRows ?? []) as UsageCostRow[]) {
    if (!row.generation_id) continue;
    costByGenerationId.set(row.generation_id, (costByGenerationId.get(row.generation_id) ?? 0) + Number(row.cost_usd));
  }

  const total = count ?? generations.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="px-6 pt-6">
        <div className="liquid-glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3">
          <span className="font-mono text-sm text-white/40">admin / runs</span>
          <div className="flex items-center gap-3">
            <Link href="/admin/cost" className="text-sm text-white/50 transition-colors duration-150 hover:text-white">
              Cost
            </Link>
            <Link href="/account" className="text-sm text-white/50 transition-colors duration-150 hover:text-white">
              Account
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-normal leading-snug text-white">All generations</h1>
            <p className="mt-1 text-sm text-white/40">
              Browse every generation, open the detail page, play completed audio, and inspect the final script.
            </p>
          </div>
          <p className="font-mono text-xs text-white/30">
            {total} total · page {currentPage} of {totalPages}
          </p>
        </div>

        {generations.length > 0 ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {generations.map((generation) => {
              const playable = generation.status === "complete" && Boolean(generation.audio_path);
              return (
                <Link
                  key={generation.id}
                  href={`/admin/runs/${generation.id}`}
                  className="liquid-glass flex min-h-56 flex-col justify-between rounded-xl p-5 transition-all duration-150 hover:bg-white/5"
                >
                  <div>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <Badge variant={STATUS_VARIANT[generation.status]}>{generation.status}</Badge>
                      <span className="font-mono text-xs text-white/35">{fmtUsd(costByGenerationId.get(generation.id) ?? 0)}</span>
                    </div>
                    <h2 className="line-clamp-2 text-base font-medium leading-snug text-white/85">
                      {generation.title ?? generation.topic}
                    </h2>
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/45">{generation.topic}</p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="border-t border-white/10 pt-3">
                      <p className="truncate text-xs text-white/50">{userLabel(profileById.get(generation.user_id), generation.user_id)}</p>
                      <p className="mt-1 font-mono text-[10px] text-white/25">{generation.id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/35">
                      <span>{formatDate(generation.created_at)}</span>
                      <span>·</span>
                      <span>{generation.duration}m target</span>
                      <span>·</span>
                      <span>{formatAudioDuration(generation.audio_duration_seconds)}</span>
                    </div>
                    <span className={cn(buttonVariants({ size: "sm", variant: playable ? "default" : "outline" }), "w-full")}>
                      {playable ? "Open player" : "Open details"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <div className="liquid-glass rounded-xl py-20 text-center">
            <p className="text-sm text-white/30">No generations yet.</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-6">
          {hasPrevious ? (
            <Link href={`/admin/runs?page=${currentPage - 1}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={`/admin/runs?page=${currentPage + 1}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

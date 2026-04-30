import { notFound } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

interface UsageRow {
  id: number;
  generation_id: string | null;
  user_id: string | null;
  chapter_idx: number | null;
  stage: string;
  provider: string;
  model: string;
  variant: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  tool_calls: number;
  web_search_requests: number;
  tts_characters: number | null;
  cost_usd: number;
  duration_ms: number | null;
  attempt: number;
  created_at: string;
}

interface GenerationRow {
  id: string;
  topic: string;
  title: string | null;
  duration: number;
  status: string;
  user_id: string;
  created_at: string;
}

function fmtUsd(n: number): string {
  if (!n) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default async function AdminCostPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) notFound();

  const service = createSupabaseServiceClient();

  // 50 most recent generations (any user)
  const { data: gens } = await service
    .from("generations")
    .select("id, topic, title, duration, status, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const generations = (gens ?? []) as GenerationRow[];
  const generationIds = generations.map((g) => g.id);

  // All usage events for those generations + the unattached (style_*) events from the last 24h
  // eslint-disable-next-line react-hooks/purity -- server component renders once per request
  const now = Date.now();
  const since = new Date(now - 24 * 3600_000).toISOString();
  const { data: events } = await service
    .from("provider_usage_events")
    .select("*")
    .or(`generation_id.in.(${generationIds.join(",") || "00000000-0000-0000-0000-000000000000"}),and(generation_id.is.null,created_at.gte.${since})`)
    .order("created_at", { ascending: false })
    .limit(2000);

  const usage = (events ?? []) as UsageRow[];

  // Aggregate per-generation
  const perGenCost = new Map<string, number>();
  const perGenStage = new Map<string, Record<string, number>>();
  for (const e of usage) {
    if (!e.generation_id) continue;
    perGenCost.set(e.generation_id, (perGenCost.get(e.generation_id) ?? 0) + Number(e.cost_usd));
    const stages = perGenStage.get(e.generation_id) ?? {};
    stages[e.stage] = (stages[e.stage] ?? 0) + Number(e.cost_usd);
    perGenStage.set(e.generation_id, stages);
  }

  // Roll-ups
  const since24h = now - 24 * 3600_000;
  const since7d = now - 7 * 24 * 3600_000;
  let total24h = 0;
  let total7d = 0;
  let totalAll = 0;
  const perProvider: Record<string, number> = {};
  const perStage: Record<string, number> = {};
  for (const e of usage) {
    const t = new Date(e.created_at).getTime();
    const c = Number(e.cost_usd);
    totalAll += c;
    if (t >= since24h) total24h += c;
    if (t >= since7d) total7d += c;
    perProvider[e.provider] = (perProvider[e.provider] ?? 0) + c;
    perStage[e.stage] = (perStage[e.stage] ?? 0) + c;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="px-6 pt-6">
        <div className="liquid-glass mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3">
          <span className="font-mono text-sm text-white/40">admin / cost</span>
          <span className="text-xs text-white/30">last 50 generations + 24h unattached</span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        {/* Roll-ups */}
        <section className="grid grid-cols-3 gap-3">
          {[
            ["24h", total24h],
            ["7d", total7d],
            ["all (sample)", totalAll],
          ].map(([label, value]) => (
            <div key={label as string} className="liquid-glass rounded-xl px-4 py-3">
              <p className="text-xs text-white/40">{label}</p>
              <p className="mt-1 font-mono text-lg text-white">{fmtUsd(value as number)}</p>
            </div>
          ))}
        </section>

        {/* Per-provider + per-stage */}
        <section className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-white/70">By provider</h3>
            <div className="liquid-glass divide-y divide-white/10 rounded-xl">
              {Object.entries(perProvider).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2">
                  <span className="font-mono text-xs text-white/60">{k}</span>
                  <span className="font-mono text-xs text-white">{fmtUsd(v)}</span>
                </div>
              ))}
              {Object.keys(perProvider).length === 0 && (
                <div className="px-4 py-3 text-xs text-white/40">No usage data yet.</div>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-white/70">By stage</h3>
            <div className="liquid-glass divide-y divide-white/10 rounded-xl">
              {Object.entries(perStage).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2">
                  <span className="font-mono text-xs text-white/60">{k}</span>
                  <span className="font-mono text-xs text-white">{fmtUsd(v)}</span>
                </div>
              ))}
              {Object.keys(perStage).length === 0 && (
                <div className="px-4 py-3 text-xs text-white/40">No usage data yet.</div>
              )}
            </div>
          </div>
        </section>

        {/* Per-generation table */}
        <section>
          <h3 className="mb-3 text-sm font-medium text-white/70">Recent generations</h3>
          <div className="liquid-glass divide-y divide-white/10 rounded-xl">
            {generations.map((g) => {
              const total = perGenCost.get(g.id) ?? 0;
              const stages = perGenStage.get(g.id) ?? {};
              return (
                <div key={g.id} className="px-4 py-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-white/30 shrink-0 w-20 truncate">{g.id.slice(0, 8)}</span>
                    <span className="text-sm text-white/80 truncate flex-1">{g.title ?? g.topic}</span>
                    <span className="text-xs text-white/40 shrink-0">{g.duration}m</span>
                    <span className="text-xs text-white/40 shrink-0 w-20 truncate">{g.status}</span>
                    <span className="font-mono text-sm text-white shrink-0 w-20 text-right">{fmtUsd(total)}</span>
                  </div>
                  {Object.keys(stages).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2 pl-[5.5rem]">
                      {Object.entries(stages).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                        <span key={s} className="text-[10px] font-mono text-white/40">
                          {s} {fmtUsd(c)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {generations.length === 0 && (
              <div className="px-4 py-3 text-xs text-white/40">No generations yet.</div>
            )}
          </div>
        </section>

        {/* Recent raw events */}
        <section>
          <h3 className="mb-3 text-sm font-medium text-white/70">Recent events ({usage.length})</h3>
          <div className="liquid-glass max-h-[600px] divide-y divide-white/10 overflow-y-auto rounded-xl">
            {usage.slice(0, 200).map((e) => (
              <div key={e.id} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                <span className="font-mono text-white/20 shrink-0 w-12">{e.id}</span>
                <span className="font-mono text-white/40 shrink-0 w-16 truncate">{e.stage}</span>
                <span className="font-mono text-white/30 shrink-0 w-16 truncate">{e.provider}</span>
                <span className="font-mono text-white/30 shrink-0 w-32 truncate">{e.model}</span>
                {e.chapter_idx != null && <span className="text-white/30 shrink-0 w-8">ch{e.chapter_idx}</span>}
                <span className="font-mono text-white/40 shrink-0 w-20 text-right">
                  {e.input_tokens ?? "—"}/{e.output_tokens ?? "—"}
                </span>
                {e.tool_calls > 0 && <span className="text-white/30 shrink-0">{e.tool_calls}t</span>}
                {e.web_search_requests > 0 && <span className="text-white/30 shrink-0">{e.web_search_requests}ws</span>}
                {e.tts_characters != null && <span className="text-white/30 shrink-0">{e.tts_characters}c</span>}
                {e.duration_ms != null && <span className="text-white/20 shrink-0 w-16 text-right">{e.duration_ms}ms</span>}
                <span className="font-mono text-white shrink-0 w-20 text-right">{fmtUsd(Number(e.cost_usd))}</span>
              </div>
            ))}
            {usage.length === 0 && (
              <div className="px-4 py-3 text-xs text-white/40">No usage events yet — generate a podcast to start populating this view.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

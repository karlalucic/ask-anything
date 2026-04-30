import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import { isAdminUser } from "@/lib/admin";

export default async function AdminRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) redirect("/");

  const serviceClient = createSupabaseServiceClient();

  const { data: gen } = await serviceClient
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", id)
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (!gen) notFound();

  const { data: events } = await serviceClient
    .from("run_events")
    .select("*")
    .eq("generation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  const generation = toGenerationWithChapters(gen);

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="px-6 pt-6">
        <div className="liquid-glass mx-auto flex max-w-4xl items-center justify-between rounded-full px-6 py-3">
          <span className="font-mono text-sm text-white/40">admin / runs / {id}</span>
          {generation.triggerRunId && (
            <a
              href={`https://cloud.trigger.dev/runs/${generation.triggerRunId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/50 transition-colors duration-150 hover:text-white"
            >
              Open in Trigger.dev
            </a>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-10">
        {/* Generation summary */}
        <section>
          <h2 className="mb-4 text-lg font-medium text-white">{generation.title ?? generation.topic}</h2>
          <div className="liquid-glass divide-y divide-white/10 rounded-xl">
            {[
              ["ID", generation.id],
              ["Status", generation.status],
              ["Topic", generation.topic],
              ["Duration", generation.duration],
              ["Created", generation.createdAt],
              ["Completed", generation.completedAt ?? "—"],
              ["Trigger Run ID", generation.triggerRunId ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start px-4 py-3 gap-6">
                <span className="text-xs text-white/40 w-32 shrink-0">{k}</span>
                <span className="text-xs font-mono text-white/70 break-all">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Error */}
        {generation.error && (
          <section>
            <h3 className="text-sm font-semibold mb-3 text-red-400">Error</h3>
            <pre className="overflow-auto rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-400">
              {JSON.stringify(generation.error, null, 2)}
            </pre>
          </section>
        )}

        {/* Chapters */}
        {generation.chapters.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 text-white">Chapters ({generation.chapters.length})</h3>
            <div className="liquid-glass divide-y divide-white/10 rounded-xl">
              {generation.chapters.map((c) => (
                <div key={c.idx} className="px-4 py-3 flex items-start gap-4">
                  <span className="text-xs text-white/20 tabular-nums w-4 shrink-0">{c.idx}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80">{c.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{c.status}</p>
                    {c.error && <p className="text-xs text-red-500 mt-1">{c.error.code}: {(c.error as { message?: string }).message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Run events timeline */}
        <section>
          <h3 className="text-sm font-semibold mb-3 text-white">Run events ({events?.length ?? 0})</h3>
          <div className="liquid-glass max-h-[600px] divide-y divide-white/10 overflow-y-auto rounded-xl">
            {((events ?? []) as unknown[]).map((ev) => {
              const e = ev as { id: number; kind: string; stage: string; provider?: string; chapter_idx?: number; duration_ms?: number; error?: unknown; created_at: string };
              return (
              <div key={e.id} className={`px-4 py-3 flex items-start gap-3 ${e.kind === "error" ? "bg-red-500/10" : ""}`}>
                <span className="text-xs text-white/20 tabular-nums w-6 shrink-0">{e.id}</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${e.kind === "error" ? "text-red-400" : "text-white/60"}`}>{e.stage}</span>
                    {e.provider && <span className="text-xs text-white/40">{e.provider}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${e.kind === "error" ? "bg-red-500/10 text-red-400" : "bg-white/10 text-white/50"}`}>{e.kind}</span>
                    {e.chapter_idx != null && <span className="text-xs text-white/40">ch{e.chapter_idx}</span>}
                    {e.duration_ms && <span className="text-xs text-white/20">{e.duration_ms}ms</span>}
                  </div>
                  {e.error != null && (
                    <pre className="text-xs text-red-400 bg-red-950/40 rounded p-2 overflow-auto">
                      {JSON.stringify(e.error, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-xs text-white/20 shrink-0">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
              );
            })}
          </div>
        </section>

        {/* Config snapshot */}
        <section>
          <details>
            <summary className="text-sm font-semibold cursor-pointer select-none text-white">Config snapshot</summary>
            <pre className="liquid-glass mt-3 overflow-auto rounded-xl p-4 text-xs text-white/60">
              {JSON.stringify({ topic: generation.topic, duration: generation.duration, familiarity: generation.familiarity, intent: generation.intent, voice: generation.voice, styleCard: generation.styleCard, sourcesConfig: generation.sourcesConfig }, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}

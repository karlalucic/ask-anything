"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toChapter, toGeneration } from "@/lib/supabase/mappers";
import type { Generation, Chapter, GenerationStatus } from "@/lib/types";

const STAGE_ORDER: GenerationStatus[] = ["queued", "outlining", "researching", "drafting", "aggregating", "synthesizing", "complete"];

const STAGE_LABEL: Record<string, string> = {
  queued: "queued",
  outlining: "outlining",
  researching: "researching",
  drafting: "drafting",
  aggregating: "polishing",
  synthesizing: "narrating",
  complete: "complete",
};

function stageIndex(status: GenerationStatus): number {
  return STAGE_ORDER.indexOf(status);
}

interface Props {
  generationId: string;
  initialGeneration: Generation;
  initialChapters: Chapter[];
}

export function GenerationProgress({ generationId, initialGeneration, initialChapters }: Props) {
  const [generation, setGeneration] = useState(initialGeneration);
  const [chapters, setChapters] = useState(initialChapters);
  const lastEventAt = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatest = useCallback(async () => {
    const res = await fetch(`/api/generations/${generationId}`);
    if (res.ok) {
      const json = await res.json();
      setGeneration(json.generation);
      setChapters(json.generation.chapters ?? []);
    }
  }, [generationId]);

  useEffect(() => {
    const terminal = ["complete", "failed", "canceled"];
    if (terminal.includes(generation.status)) return;
    lastEventAt.current = Date.now();

    const supabase = getSupabaseBrowserClient();

    const genChannel = supabase
      .channel(`generation:${generationId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generations", filter: `id=eq.${generationId}` }, (payload: { new: Record<string, unknown> }) => {
        lastEventAt.current = Date.now();
        setGeneration((prev) => ({ ...prev, ...toGeneration(payload.new) }));
      })
      .subscribe();

    const chapterChannel = supabase
      .channel(`chapters:${generationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters", filter: `generation_id=eq.${generationId}` }, (payload: { new: Record<string, unknown> }) => {
        lastEventAt.current = Date.now();
        setChapters((prev) => {
          const updated = toChapter(payload.new);
          const idx = prev.findIndex((c) => c.idx === updated.idx);
          if (idx === -1) return [...prev, updated];
          return prev.map((c) => c.idx === updated.idx ? updated : c);
        });
      })
      .subscribe();

    // Fallback polling if Realtime goes quiet for 90s
    pollTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt.current > 90_000) {
        fetchLatest();
      }
    }, 10_000);

    return () => {
      supabase.removeChannel(genChannel);
      supabase.removeChannel(chapterChannel);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [generationId, generation.status, fetchLatest]);

  const currentStageIdx = stageIndex(generation.status as GenerationStatus);
  const isTerminal = ["complete", "failed", "canceled"].includes(generation.status);

  return (
    <div className="space-y-8">
      {/* Stage strip */}
      <div>
        <div className="flex items-center gap-0 mb-4">
          {STAGE_ORDER.filter((s) => s !== "queued").map((stage, i) => {
            const idx = stageIndex(stage);
            const done = currentStageIdx > idx;
            const active = currentStageIdx === idx && !isTerminal;
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-white" : active ? "bg-white animate-pulse" : "bg-white/20"}`} />
                {i < STAGE_ORDER.length - 2 && <div className={`flex-1 h-px ${done ? "bg-white/60" : "bg-white/10"}`} />}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-white/50">
          {generation.status === "failed" ? (
            <span className="text-red-400">{(generation.error as { message?: string } | null)?.message ?? "generation failed"}</span>
          ) : generation.status === "canceled" ? (
            "canceled"
          ) : (
            STAGE_LABEL[generation.status] ?? generation.status
          )}
          {generation.stageProgress?.research && ["researching", "drafting"].includes(generation.status) && (
            <span className="ml-2 text-white/30">
              {generation.stageProgress.research.done}/{generation.stageProgress.research.total} chapters
            </span>
          )}
        </p>
      </div>

      {/* Error card */}
      {generation.status === "failed" && generation.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-300">
                {generation.error.stage} · {generation.error.code}
              </p>
              <p className="text-sm text-red-400 mt-1">{(generation.error as { message?: string }).message ?? "An error occurred"}</p>
              {generation.error.provider && (
                <span className="mt-2 inline-block rounded-full border border-red-500/30 px-2 py-0.5 text-xs text-red-400">
                  {generation.error.provider} · {generation.error.code}
                </span>
              )}
            </div>
          </div>
          <details className="mt-3">
            <summary className="text-xs text-red-400 cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 overflow-auto rounded-lg border border-red-500/20 bg-black/40 p-3 text-xs text-red-300">
              {JSON.stringify(generation.error, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Chapter checklist */}
      {chapters.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/50">Chapters</h3>
          {chapters.map((c) => (
            <div key={c.idx} className="flex items-center gap-3 py-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                c.status === "done" ? "bg-white" :
                c.status === "failed" ? "bg-red-500" :
                ["researching", "drafting"].includes(c.status) ? "bg-white/60 animate-pulse" :
                "bg-white/20"
              }`} />
              <span className={`text-sm ${c.status === "done" ? "text-white/70" : "text-white/30"}`}>
                {c.title}
              </span>
              {c.status === "failed" && c.error && (
                <span className="text-xs text-red-400">{c.error.code}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

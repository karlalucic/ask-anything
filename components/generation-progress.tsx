"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toChapter, toGeneration } from "@/lib/supabase/mappers";
import type { Generation, Chapter, GenerationStatus } from "@/lib/types";

const STAGE_ORDER: GenerationStatus[] = ["queued", "outlining", "researching", "drafting", "aggregating", "synthesizing", "complete"];

const STAGE_LABEL: Record<string, string> = {
  queued: "queued",
  outlining: "writing the outline",
  researching: "researching the story",
  drafting: "drafting chapters",
  aggregating: "polishing the script",
  synthesizing: "recording narration",
  complete: "complete",
};

const STAGE_COPY: Record<string, string> = {
  queued: "warming up",
  outlining: "shaping the story arc",
  researching: "gathering facts and sources",
  drafting: "writing each chapter",
  aggregating: "weaving chapters together",
  synthesizing: "voicing your script",
};

const CHAPTER_STATUS_LABEL: Record<string, string> = {
  researching: "researching",
  drafting: "drafting",
  done: "ready",
  failed: "failed",
};

function stageIndex(status: GenerationStatus): number {
  return STAGE_ORDER.indexOf(status);
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  generationId: string;
  initialGeneration: Generation;
  initialChapters: Chapter[];
}

export function GenerationProgress({ generationId, initialGeneration, initialChapters }: Props) {
  const router = useRouter();
  const [generation, setGeneration] = useState(initialGeneration);
  const [chapters, setChapters] = useState(initialChapters);
  const lastEventAt = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshedForAudioRef = useRef(false);

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

    // Fallback polling. Tight enough to feel live even when Realtime isn't
    // enabled on the generations / chapters tables (a Supabase publication
    // setting that's easy to forget). Starts polling after 12s of silence,
    // then every 4s. With Realtime enabled the timer fires harmlessly and
    // the silence threshold is rarely hit since events keep arriving.
    pollTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt.current > 12_000) {
        fetchLatest();
      }
    }, 4_000);

    return () => {
      supabase.removeChannel(genChannel);
      supabase.removeChannel(chapterChannel);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [generationId, generation.status, fetchLatest]);

  useEffect(() => {
    if (generation.status !== "complete" || !generation.audioPath || refreshedForAudioRef.current) return;
    refreshedForAudioRef.current = true;
    router.refresh();
  }, [generation.audioPath, generation.status, router]);

  const currentStageIdx = stageIndex(generation.status as GenerationStatus);
  const isTerminal = ["complete", "failed", "canceled"].includes(generation.status);

  const startedAtMs = useMemo(() => {
    return generation.createdAt ? new Date(generation.createdAt).getTime() : null;
  }, [generation.createdAt]);

  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (isTerminal || startedAtMs == null) return;
    const tick = () => setElapsedMs(Date.now() - startedAtMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTerminal, startedAtMs]);

  const chapterCounts = useMemo(() => {
    const total = chapters.length;
    const researching = chapters.filter((c) => c.status === "researching").length;
    const drafting = chapters.filter((c) => c.status === "drafting").length;
    const done = chapters.filter((c) => c.status === "done").length;
    return { total, researching, drafting, done };
  }, [chapters]);

  const stageDetail =
    generation.status === "researching" && chapterCounts.total > 0
      ? `${chapterCounts.done + chapterCounts.drafting} of ${chapterCounts.total} researched`
      : generation.status === "drafting" && chapterCounts.total > 0
      ? `${chapterCounts.done} of ${chapterCounts.total} drafted`
      : generation.status === "synthesizing" && generation.stageProgress?.tts
      ? `chunk ${generation.stageProgress.tts.done} of ${generation.stageProgress.tts.total}`
      : null;

  return (
    <div className="space-y-8">
      {/* Stage strip */}
      <div>
        <div className="flex items-center gap-0 mb-4">
          {STAGE_ORDER.filter((s) => s !== "queued").map((stage, i, arr) => {
            const idx = stageIndex(stage);
            const done = currentStageIdx > idx;
            const active = currentStageIdx === idx && !isTerminal;
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className={`relative shrink-0 ${active ? "w-2.5 h-2.5" : "w-2 h-2"} rounded-full transition-all ${done ? "bg-white" : active ? "bg-white" : "bg-white/15"}`}>
                  {active && <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />}
                </div>
                {i < arr.length - 1 && <div className={`flex-1 h-px transition-colors ${done ? "bg-white/60" : "bg-white/10"}`} />}
              </div>
            );
          })}
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">
              {generation.status === "failed" ? (
                <span className="text-red-400">{(generation.error as { message?: string } | null)?.message ?? "generation failed"}</span>
              ) : generation.status === "canceled" ? (
                "canceled"
              ) : (
                <>
                  {STAGE_LABEL[generation.status] ?? generation.status}
                  {stageDetail && <span className="ml-2 text-white/30 tabular-nums">· {stageDetail}</span>}
                </>
              )}
            </p>
            {!isTerminal && STAGE_COPY[generation.status] && (
              <p className="mt-1 text-xs text-white/30">{STAGE_COPY[generation.status]}</p>
            )}
          </div>
          {!isTerminal && (
            <span className="text-xs tabular-nums text-white/30">{formatElapsed(elapsedMs)}</span>
          )}
        </div>
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
      {chapters.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-medium text-white/50">Chapters</h3>
            {chapterCounts.total > 0 && !isTerminal && (
              <span className="text-xs tabular-nums text-white/30">
                {chapterCounts.done}/{chapterCounts.total}
              </span>
            )}
          </div>
          {chapters.map((c) => {
            const isActive = ["researching", "drafting"].includes(c.status);
            const isDone = c.status === "done";
            const isFailed = c.status === "failed";
            return (
              <div key={c.idx} className="flex items-center gap-3 py-1.5">
                <div className={`relative w-1.5 h-1.5 rounded-full shrink-0 ${
                  isDone ? "bg-white" :
                  isFailed ? "bg-red-500" :
                  isActive ? "bg-white/70" :
                  "bg-white/15"
                }`}>
                  {isActive && <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-50" />}
                </div>
                <span className={`text-sm flex-1 truncate ${isDone ? "text-white/80" : isActive ? "text-white/60" : "text-white/30"}`}>
                  {c.title}
                </span>
                {isActive && (
                  <span className="text-xs text-white/30 italic">{CHAPTER_STATUS_LABEL[c.status]}</span>
                )}
                {isDone && (
                  <span className="text-xs text-white/30">ready</span>
                )}
                {isFailed && c.error && (
                  <span className="text-xs text-red-400">{c.error.code}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : !isTerminal && currentStageIdx >= stageIndex("outlining") && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/50">Chapters</h3>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/15 shrink-0" />
              <div className="h-3 flex-1 max-w-[60%] rounded bg-white/5 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

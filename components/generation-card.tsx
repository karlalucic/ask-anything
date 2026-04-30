import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Generation, GenerationStatus } from "@/lib/types";

const STATUS_LABEL: Record<GenerationStatus, string> = {
  queued: "queued",
  outlining: "outlining",
  researching: "researching",
  drafting: "drafting",
  aggregating: "polishing",
  synthesizing: "narrating",
  complete: "complete",
  failed: "failed",
  canceled: "canceled",
};

const STATUS_VARIANT: Record<GenerationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  outlining: "secondary",
  researching: "secondary",
  drafting: "secondary",
  aggregating: "secondary",
  synthesizing: "secondary",
  complete: "default",
  failed: "destructive",
  canceled: "outline",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function GenerationCard({ generation, sharedBy }: { generation: Generation; sharedBy?: string | null }) {
  const isTerminal = ["complete", "failed", "canceled"].includes(generation.status);
  const isActive = !isTerminal;

  return (
    <Link
      href={`/listen/${generation.id}`}
      className="liquid-glass block rounded-xl px-5 py-4 transition-all duration-150 hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-white/80">{generation.title ?? generation.topic}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/30">{formatDate(generation.createdAt)}</span>
            {generation.audioDurationSeconds && (
              <>
                <span className="text-xs text-white/30">·</span>
                <span className="text-xs text-white/30">{formatDuration(generation.audioDurationSeconds)}</span>
              </>
            )}
            {isActive && generation.stageProgress && (
              <>
                <span className="text-xs text-white/30">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-white/30">
                  <span className="size-1 rounded-full bg-white animate-pulse" />
                  in progress
                </span>
              </>
            )}
            {sharedBy && (
              <>
                <span className="text-xs text-white/30">·</span>
                <span className="truncate text-xs text-white/30">Shared by {sharedBy}</span>
              </>
            )}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[generation.status]} className="shrink-0">
          {STATUS_LABEL[generation.status]}
        </Badge>
      </div>
    </Link>
  );
}

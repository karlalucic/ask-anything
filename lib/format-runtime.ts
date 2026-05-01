/**
 * Format the wall-clock time spent generating a podcast (created_at to
 * completed_at) as `m:ss` or `h:mm:ss`. Returns null if either timestamp is
 * missing or the elapsed time is negative.
 */
export function formatGenerationRuntime(
  createdAt: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  if (!createdAt || !completedAt) return null;
  const startMs = new Date(createdAt).getTime();
  const endMs = new Date(completedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const elapsedSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const s = elapsedSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

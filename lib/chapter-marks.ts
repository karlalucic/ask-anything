import type { Chapter } from "./types";
import type { ChapterMark } from "@/components/audio-player";

/**
 * Compute per-chapter start timestamps for navigation. We allocate the total
 * audio duration across chapters proportional to each chapter's draft word
 * count. This is approximate; voice cadence and punctuation cause the
 * mapping to drift a few seconds per chapter, but it's accurate enough to
 * jump close to a chapter boundary, and exact-stamp ffprobe-during-stitch is
 * a separate (heavier) change.
 *
 * Returns an empty array if the inputs aren't ready (chapters missing drafts
 * or audio duration unknown). Callers should treat that as "no chapter nav".
 */
export function buildChapterMarks(
  chapters: Chapter[],
  audioDurationSeconds: number | null | undefined,
): ChapterMark[] {
  if (!audioDurationSeconds || audioDurationSeconds <= 0) return [];
  if (!chapters || chapters.length === 0) return [];

  const wordCounts = chapters.map((c) =>
    c.draft ? c.draft.trim().split(/\s+/).filter(Boolean).length : 0,
  );
  const totalWords = wordCounts.reduce((sum, n) => sum + n, 0);
  if (totalWords === 0) return [];

  let runningWords = 0;
  return chapters.map((c, i) => {
    const startSeconds = (runningWords / totalWords) * audioDurationSeconds;
    runningWords += wordCounts[i];
    return {
      idx: c.idx,
      title: c.title,
      startSeconds,
    };
  });
}

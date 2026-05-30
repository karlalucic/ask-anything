import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildDraftPrompt } from "../lib/prompts/draft";
import { setChapterStatus, logRunEvent } from "../lib/supabase/progress";
import { recordProviderUsage } from "../lib/usage/record";
import { AppError, truncateForStorage } from "../lib/errors";
import { normalizeChapterResearch } from "../lib/research";
import type { ChapterPlan, ChapterResearch, StyleCard } from "../lib/types";

export const chapterDraft = task({
  id: "chapter-draft",
  // Bumped from 2 to 6 to match chapter-research. Lets all chapters draft in
  // parallel instead of in 3 sequential batches.
  queue: { name: "chapter-draft", concurrencyLimit: 6 },
  maxDuration: 600,
  run: async (payload: {
    generationId: string;
    userId?: string;
    chapterIdx: number;
    chapter: ChapterPlan;
    research: ChapterResearch;
    styleCard: StyleCard;
    totalChapters: number;
    prevChapter?: { title: string; thesis: string } | null;
    nextChapter?: { title: string; thesis: string } | null;
  }) => {
    const { generationId, userId, chapterIdx, chapter, styleCard, totalChapters, prevChapter, nextChapter } = payload;
    const research = normalizeChapterResearch(payload.research);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Idempotency: skip if already done
    const { data: existing } = await supabase
      .from("chapters")
      .select("draft, status")
      .eq("generation_id", generationId)
      .eq("idx", chapterIdx)
      .single();

    if (existing?.draft && existing.status === "done") {
      logger.info("Chapter draft already complete, skipping", { generationId, chapterIdx });
      return existing.draft as string;
    }

    const startTime = Date.now();

    await logRunEvent({
      generationId,
      chapterIdx,
      stage: "draft",
      provider: "anthropic",
      kind: "call",
      attempt: 1,
      payload: { model: "claude-opus-4-8", targetWords: chapter.targetWords },
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let response: Anthropic.Message;

    const { system, user } = buildDraftPrompt({
      chapter,
      research,
      styleCard,
      chapterNumber: chapterIdx + 1,
      totalChapters,
      isFirst: chapterIdx === 0,
      isLast: chapterIdx === totalChapters - 1,
      prevChapter,
      nextChapter,
    });

    try {
      response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 8192,
        // Style card + instructions are identical for every chapter in this
        // generation, so cache the system prefix and chapters 2..N read it back
        // at the cached-input rate.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      });
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      await logRunEvent({
        generationId,
        chapterIdx,
        stage: "draft",
        provider: "anthropic",
        kind: "error",
        attempt: 1,
        error: truncateForStorage({ status: errObj.status, message: errObj.message }),
      });
      throw new AppError(
        {
          stage: "draft",
          provider: "anthropic",
          code: "api_error",
          upstreamStatus: errObj.status,
          upstreamBody: truncateForStorage(errObj.message),
          attempt: 1,
          generationId,
          chapterIdx,
          retriable: true,
        },
        `Anthropic API error during drafting: ${errObj.message}`,
        err as Error,
      );
    }

    // Record usage IMMEDIATELY: before any throwing logic (max_tokens check, downstream upload).
    await recordProviderUsage({
      generationId,
      userId,
      chapterIdx,
      stage: "draft",
      provider: "anthropic",
      model: "claude-opus-4-8",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      durationMs: Date.now() - startTime,
    });

    if (response.stop_reason === "max_tokens") {
      throw new AppError(
        {
          stage: "draft",
          provider: "anthropic",
          code: "max_tokens",
          attempt: 1,
          generationId,
          chapterIdx,
          retriable: true,
        },
        "Draft response truncated by max_tokens; consider reducing targetWords",
      );
    }

    const draft = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    await logRunEvent({
      generationId,
      chapterIdx,
      stage: "draft",
      provider: "anthropic",
      kind: "call",
      attempt: 1,
      durationMs: Date.now() - startTime,
      response: {
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        wordCount: draft.split(/\s+/).length,
      },
    });

    await setChapterStatus(generationId, chapterIdx, "done", { draft });
    logger.info("Chapter draft complete", { generationId, chapterIdx, wordCount: draft.split(/\s+/).length });
    return draft;
  },
});

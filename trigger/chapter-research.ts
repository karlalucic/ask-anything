import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildResearchSystemPrompt, buildResearchUserPrompt, RESEARCH_TOOLS } from "../lib/prompts/research";
import { setChapterStatus, logRunEvent } from "../lib/supabase/progress";
import { BartlettError, truncateForStorage } from "../lib/errors";
import { normalizeChapterResearch } from "../lib/research";
import type { ChapterPlan, ChapterResearch } from "../lib/types";

const MAX_ITERATIONS = 5;

export const chapterResearch = task({
  id: "chapter-research",
  queue: { name: "chapter-research", concurrencyLimit: 2 },
  maxDuration: 600,
  run: async (payload: { generationId: string; chapterIdx: number; chapter: ChapterPlan }) => {
    const { generationId, chapterIdx, chapter } = payload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Idempotency: skip if already done
    const { data: existing } = await supabase
      .from("chapters")
      .select("research, status")
      .eq("generation_id", generationId)
      .eq("idx", chapterIdx)
      .single();

    if (existing?.research && existing.status === "done" || existing?.status === "drafting") {
      logger.info("Chapter research already complete, skipping", { generationId, chapterIdx });
      return normalizeChapterResearch(existing.research);
    }

    await setChapterStatus(generationId, chapterIdx, "researching");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildResearchUserPrompt(chapter) },
    ];

    let research: ChapterResearch | null = null;
    const startTime = Date.now();

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      await logRunEvent({
        generationId,
        chapterIdx,
        stage: "research",
        provider: "anthropic",
        kind: "call",
        attempt: iteration + 1,
        payload: { model: "claude-sonnet-4-6", messageCount: messages.length, iteration },
      });

      let response: Anthropic.Message;
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: buildResearchSystemPrompt(),
          messages,
          tools: RESEARCH_TOOLS as Anthropic.Tool[],
        });
      } catch (err: unknown) {
        const errObj = err as { status?: number; message?: string };
        await logRunEvent({
          generationId,
          chapterIdx,
          stage: "research",
          provider: "anthropic",
          kind: "error",
          attempt: iteration + 1,
          error: truncateForStorage({ status: errObj.status, message: errObj.message }),
        });
        throw new BartlettError(
          {
            stage: "research",
            provider: "anthropic",
            code: "api_error",
            upstreamStatus: errObj.status,
            upstreamBody: truncateForStorage(errObj.message),
            attempt: iteration + 1,
            generationId,
            chapterIdx,
            retriable: true,
          },
          `Anthropic API error during research: ${errObj.message}`,
          err as Error,
        );
      }

      await logRunEvent({
        generationId,
        chapterIdx,
        stage: "research",
        provider: "anthropic",
        kind: "call",
        attempt: iteration + 1,
        durationMs: Date.now() - startTime,
        response: {
          stopReason: response.stop_reason,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          toolUseCount: response.content.filter((b) => b.type === "tool_use").length,
        },
      });

      // Check for done tool call
      const doneBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "done",
      );

      if (doneBlock) {
        research = normalizeChapterResearch(doneBlock.input);
        break;
      }

      // Log each tool call
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      for (const tu of toolUses) {
        await logRunEvent({
          generationId,
          chapterIdx,
          stage: "research",
          provider: "anthropic",
          kind: "tool_call",
          attempt: iteration + 1,
          payload: { toolName: tu.name, inputDigest: JSON.stringify(tu.input).slice(0, 200) },
        });
      }

      if (response.stop_reason === "end_turn" || toolUses.length === 0) break;

      // Continue the loop
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: toolUses.map((tu) => ({
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: "Search completed. Please continue researching or call done.",
        })),
      });
    }

    if (!research) {
      throw new BartlettError(
        {
          stage: "research",
          provider: "anthropic",
          code: "tool_use_loop_exceeded",
          attempt: MAX_ITERATIONS,
          generationId,
          chapterIdx,
          retriable: true,
        },
        `web_search loop exhausted ${MAX_ITERATIONS} iterations without calling done`,
      );
    }

    await setChapterStatus(generationId, chapterIdx, "drafting", { research });
    logger.info("Chapter research complete", { generationId, chapterIdx });
    return research;
  },
});

import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { execa } from "execa";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PostHog } from "posthog-node";
import { buildOutlinePrompt, parseOutlineResponse } from "../lib/prompts/outline";
import { buildAggregatePrompt, parseAggregateResponse } from "../lib/prompts/aggregate";
import { setGenerationStatus, bumpProgress, logRunEvent } from "../lib/supabase/progress";
import { recordProviderUsage } from "../lib/usage/record";
import { AppError, truncateForStorage } from "../lib/errors";
import { chapterResearch } from "./chapter-research";
import { chapterDraft } from "./chapter-draft";
import { ttsChunk } from "./tts-chunk";
import type { ChapterPlan, StyleCard, FamiliarityLevel, IntentType, VoiceId, SourcesConfig } from "../lib/types";
import { getDurationWords } from "../lib/types";

const MAX_CHUNK_CHARS = 12000;
const AGGREGATION_MAX_OUTPUT_TOKENS = 16000;
const MODEL_AGGREGATION_WORD_LIMIT = 10000;

interface GeneratePayload {
  generationId: string;
  userId: string;
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  voice: VoiceId;
  styleCard: StyleCard;
  sourcesConfig: SourcesConfig;
}

function isChapterPlanArray(value: unknown): value is ChapterPlan[] {
  return Array.isArray(value) && value.every((item) => {
    const chapter = item as Partial<ChapterPlan>;
    return Boolean(
      chapter
      && typeof chapter.title === "string"
      && typeof chapter.thesis === "string"
      && typeof chapter.researchBrief === "string"
      && Array.isArray(chapter.searchQueries)
      && Array.isArray(chapter.evidenceNeeded)
      && typeof chapter.targetWords === "number",
    );
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function assembleScriptFromDrafts(drafts: string[]): string {
  return drafts
    .map((draft) => draft.trim())
    .filter(Boolean)
    .join("\n\n");
}

function shouldUseModelAggregation(targetWords: number): boolean {
  return targetWords <= MODEL_AGGREGATION_WORD_LIMIT;
}

function isScriptLongEnough(script: string, targetWords: number): boolean {
  return countWords(script) >= Math.floor(targetWords * 0.7);
}

function isUsableAggregate(script: string, draftWords: number, targetWords: number): boolean {
  return countWords(script) >= Math.floor(Math.min(draftWords, targetWords) * 0.75);
}

export const generateAudiobook = task({
  id: "generate-audiobook",
  maxDuration: 10800,
  run: async (payload: GeneratePayload) => {
    const { generationId, userId, topic, duration, familiarity, intent, voice, styleCard, sourcesConfig } = payload;
    const targetTotalWords = getDurationWords(duration);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const posthog = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
      ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          flushAt: 1,
          flushInterval: 0,
        })
      : null;

    const startedAt = Date.now();

    try {
      // ── Stage 1: Outline ──────────────────────────────────────────────────
      const { data: existingGeneration } = await supabase
        .from("generations")
        .select("outline, audio_path, full_script")
        .eq("id", generationId)
        .single();

      if (existingGeneration?.audio_path) {
        logger.info("Generation already has final audio, skipping", { generationId });
        return { audioPath: existingGeneration.audio_path, durationSeconds: 0 };
      }

      let chapters: ChapterPlan[] = isChapterPlanArray(existingGeneration?.outline)
        ? existingGeneration.outline
        : [];

      if (chapters.length === 0) {
        await setGenerationStatus(generationId, "outlining");
        logger.info("Stage 1: Generating outline", { generationId, topic });

        const outlinePrompt = buildOutlinePrompt({ topic, duration, familiarity, intent, styleCard });

        const outlineStart = Date.now();
        await logRunEvent({ generationId, stage: "outline", provider: "anthropic", kind: "call", attempt: 1, payload: { model: OUTLINE_MODEL } });

        let outlineResponse: Anthropic.Message;
        try {
          outlineResponse = await anthropic.messages.stream({
            model: OUTLINE_MODEL,
            max_tokens: OUTLINE_MAX_TOKENS,
            messages: [{ role: "user", content: outlinePrompt }],
          }).finalMessage();
        } catch (err: unknown) {
          const e = err as { status?: number; message?: string };
          throw new AppError({ stage: "outline", provider: "anthropic", code: "api_error", upstreamStatus: e.status, attempt: 1, generationId, retriable: true }, `Outline failed: ${e.message}`, err as Error);
        }

        // Record usage IMMEDIATELY. Provider has already charged; row must exist
        // even if downstream parse/upload throws.
        await recordProviderUsage({
          generationId,
          userId,
          stage: "outline",
          provider: "anthropic",
          model: OUTLINE_MODEL,
          inputTokens: outlineResponse.usage.input_tokens,
          outputTokens: outlineResponse.usage.output_tokens,
          cachedInputTokens: outlineResponse.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: outlineResponse.usage.cache_creation_input_tokens ?? 0,
          webSearchRequests: outlineResponse.usage.server_tool_use?.web_search_requests ?? 0,
          durationMs: Date.now() - outlineStart,
        });

        const outlineText = outlineResponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

        try {
          chapters = parseOutlineResponse(outlineText);
        } catch (err: unknown) {
          throw new AppError({ stage: "outline", provider: "anthropic", code: "schema_mismatch", attempt: 1, generationId, retriable: false }, "Failed to parse outline JSON", err as Error);
        }

        await logRunEvent({ generationId, stage: "outline", provider: "anthropic", kind: "call", attempt: 1, durationMs: Date.now() - outlineStart, response: { chapterCount: chapters.length, model: OUTLINE_MODEL } });
        await supabase.from("generations").update({ outline: chapters }).eq("id", generationId);
      } else {
        await logRunEvent({ generationId, stage: "outline", provider: "internal", kind: "info", response: { reusedChapterCount: chapters.length } });
      }

      await supabase.from("chapters").upsert(
        chapters.map((c, idx) => ({
          generation_id: generationId,
          idx,
          title: c.title,
          thesis: c.thesis,
          research_brief: c.researchBrief,
          search_queries: c.searchQueries,
          evidence_needed: c.evidenceNeeded,
          target_words: c.targetWords,
        })),
        { onConflict: "generation_id,idx", ignoreDuplicates: true },
      );

      // ── Stage 2: Research ─────────────────────────────────────────────────
      await setGenerationStatus(generationId, "researching");
      await bumpProgress(generationId, "research", { done: 0, total: chapters.length });
      logger.info("Stage 2: Researching chapters", { generationId, chapterCount: chapters.length });

      const researchBatch = await tasks.batchTriggerAndWait<typeof chapterResearch>(
        "chapter-research",
        chapters.map((chapter, i) => ({
          payload: { generationId, userId, chapterIdx: i, chapter, sourcesConfig },
        })),
      );

      const researchResults = researchBatch.runs.map((run, i) => {
        if (!run.ok) {
          throw new AppError({ stage: "research", provider: "anthropic", code: "child_task_failed", attempt: 1, generationId, chapterIdx: i, retriable: true }, `Chapter ${i} research failed`);
        }
        return run.output;
      });
      await bumpProgress(generationId, "research", { done: chapters.length, total: chapters.length });

      // ── Stage 3: Drafting ─────────────────────────────────────────────────
      await setGenerationStatus(generationId, "drafting");
      await bumpProgress(generationId, "drafting", { done: 0, total: chapters.length });
      logger.info("Stage 3: Drafting chapters", { generationId });

      const draftBatch = await tasks.batchTriggerAndWait<typeof chapterDraft>(
        "chapter-draft",
        chapters.map((chapter, i) => ({
          payload: {
            generationId,
            userId,
            chapterIdx: i,
            chapter,
            research: researchResults[i],
            styleCard,
            totalChapters: chapters.length,
          },
        })),
      );

      const drafts = draftBatch.runs.map((run, i) => {
        if (!run.ok) {
          throw new AppError({ stage: "draft", provider: "anthropic", code: "child_task_failed", attempt: 1, generationId, chapterIdx: i, retriable: true }, `Chapter ${i} draft failed`);
        }
        return run.output;
      });
      await bumpProgress(generationId, "drafting", { done: chapters.length, total: chapters.length });

      // ── Stage 4: Aggregation ──────────────────────────────────────────────
      await setGenerationStatus(generationId, "aggregating");

      let fullScript: string;
      // When the audio was synthesized from per-chapter text (local concat or
      // a fallback from aggregation), we keep that decomposition so the TTS
      // stage can chunk along chapter boundaries instead of arbitrary 12k
      // marks. When the polished aggregate script is used, the drafts are no
      // longer a structural match for the audio, so we keep null and fall
      // back to monolithic chunking.
      let chapterTexts: string[] | null = null;
      if (existingGeneration?.full_script && isScriptLongEnough(existingGeneration.full_script, targetTotalWords)) {
        fullScript = existingGeneration.full_script;
        logger.info("Stage 4: Reusing cached full_script", { generationId, wordCount: countWords(fullScript) });
        await logRunEvent({ generationId, stage: "aggregate", provider: "internal", kind: "info", response: { reused: true } });
      } else {
        if (existingGeneration?.full_script) {
          await logRunEvent({
            generationId,
            stage: "aggregate",
            provider: "internal",
            kind: "info",
            response: { reused: false, reason: "cached_script_too_short", wordCount: countWords(existingGeneration.full_script), targetTotalWords },
          });
        }

        if (!shouldUseModelAggregation(targetTotalWords)) {
          fullScript = assembleScriptFromDrafts(drafts);
          chapterTexts = drafts.map((d) => d.trim()).filter(Boolean);
          logger.info("Stage 4: Assembled long script locally", { generationId, wordCount: countWords(fullScript), targetTotalWords });
          await logRunEvent({
            generationId,
            stage: "aggregate",
            provider: "internal",
            kind: "info",
            response: { mode: "local_assembly", reason: "target_exceeds_model_output_budget", wordCount: countWords(fullScript), targetTotalWords },
          });
          await supabase.from("generations").update({ full_script: fullScript }).eq("id", generationId);
        } else {
          logger.info("Stage 4: Aggregating script", { generationId });

          const draftWords = drafts.reduce((sum, draft) => sum + countWords(draft), 0);
          const { system: aggregateSystem, user: aggregateUser } = buildAggregatePrompt({
            chapters: chapters.map((c, i) => ({ title: c.title, draft: drafts[i] })),
            styleCard,
            targetTotalWords,
          });

          const aggStart = Date.now();
          await logRunEvent({ generationId, stage: "aggregate", provider: "anthropic", kind: "call", attempt: 1 });

          let aggResponse: Anthropic.Message;
          try {
            aggResponse = await anthropic.messages.stream({
              model: AGGREGATION_MODEL,
              max_tokens: AGGREGATION_MAX_OUTPUT_TOKENS,
              system: [{ type: "text", text: aggregateSystem, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content: aggregateUser }],
            }).finalMessage();
          } catch (err: unknown) {
            const e = err as { status?: number; message?: string };
            throw new AppError({ stage: "aggregate", provider: "anthropic", code: "api_error", upstreamStatus: e.status, attempt: 1, generationId, retriable: true }, `Aggregation failed: ${e.message}`, err as Error);
          }

          await recordProviderUsage({
            generationId,
            userId,
            stage: "aggregate",
            provider: "anthropic",
            model: AGGREGATION_MODEL,
            inputTokens: aggResponse.usage.input_tokens,
            outputTokens: aggResponse.usage.output_tokens,
            cachedInputTokens: aggResponse.usage.cache_read_input_tokens ?? 0,
            cacheCreationInputTokens: aggResponse.usage.cache_creation_input_tokens ?? 0,
            webSearchRequests: aggResponse.usage.server_tool_use?.web_search_requests ?? 0,
            durationMs: Date.now() - aggStart,
          });

          const aggregateText = aggResponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
          // Aggregation now returns structured JSON: { chapters: [{ idx, polished }] }.
          // Parsing it lets us keep per-chapter TTS chunking after the polish pass.
          // The alternative (treating the polished text as one big string and chunking
          // monolithically) leaves TTS concurrency on the floor and reintroduces
          // arbitrary mid-paragraph audio boundaries we'd just removed at the draft
          // stage.
          const polishedChapters = parseAggregateResponse(aggregateText, chapters.length);
          const polishedScript = polishedChapters?.join("\n\n") ?? "";
          const polishedFitsBudget = polishedChapters && isUsableAggregate(polishedScript, draftWords, targetTotalWords);

          if (aggResponse.stop_reason === "max_tokens" || !polishedChapters || !polishedFitsBudget) {
            fullScript = assembleScriptFromDrafts(drafts);
            chapterTexts = drafts.map((d) => d.trim()).filter(Boolean);
            await logRunEvent({
              generationId,
              stage: "aggregate",
              provider: "internal",
              kind: "info",
              response: {
                mode: "local_assembly",
                reason: aggResponse.stop_reason === "max_tokens"
                  ? "aggregate_max_tokens"
                  : !polishedChapters
                    ? "aggregate_parse_failed"
                    : "aggregate_too_short",
                aggregateWordCount: countWords(polishedScript || aggregateText),
                draftWords,
                targetTotalWords,
              },
            });
          } else {
            fullScript = polishedScript;
            chapterTexts = polishedChapters;
          }

          await logRunEvent({ generationId, stage: "aggregate", provider: "anthropic", kind: "call", attempt: 1, durationMs: Date.now() - aggStart, response: { stopReason: aggResponse.stop_reason, wordCount: countWords(fullScript) } });
          await supabase.from("generations").update({ full_script: fullScript }).eq("id", generationId);
        }
      }

      // ── Stage 5: TTS ──────────────────────────────────────────────────────
      await setGenerationStatus(generationId, "synthesizing");
      logger.info("Stage 5: TTS synthesis", { generationId });

      // Per-chapter chunking when chapterTexts is available: each chapter
      // becomes one or more chunks (split further only if it exceeds
      // MAX_CHUNK_CHARS). Boundaries land at chapter ends, which are natural
      // pause points for the listener instead of arbitrary mid-paragraph
      // splits. The aggregation path falls back to monolithic chunking
      // because the polished script no longer maps 1:1 to drafts.
      const chunks = chapterTexts
        ? chapterTexts.flatMap((text) => splitIntoChunks(text, MAX_CHUNK_CHARS))
        : splitIntoChunks(fullScript, MAX_CHUNK_CHARS);
      await bumpProgress(generationId, "tts", { done: 0, total: chunks.length });

      const ttsBatch = await tasks.batchTriggerAndWait<typeof ttsChunk>(
        "tts-chunk",
        chunks.map((text, i) => ({
          payload: { generationId, userId, chunkIdx: i, text, voice },
        })),
      );

      const chunkPaths = ttsBatch.runs.map((run, i) => {
        if (!run.ok) {
          throw new AppError({ stage: "tts", provider: "xai", code: "child_task_failed", attempt: 1, generationId, retriable: true }, `TTS chunk ${i} failed`);
        }
        return run.output;
      });
      await bumpProgress(generationId, "tts", { done: chunks.length, total: chunks.length });

      // Download chunks and stitch with ffmpeg. These are plain Supabase
      // storage HTTP calls (not Trigger.dev wait functions), so Promise.all
      // is safe; saves several seconds for a typical 10-20 chunk run.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${generationId}-`));

      const localPaths = await Promise.all(
        chunkPaths.map(async (chunkPath, i) => {
          const { data, error } = await supabase.storage.from("tts-chunks").download(chunkPath);
          if (error || !data) {
            throw new AppError({ stage: "stitch", provider: "supabase", code: "download_failed", attempt: 1, generationId, retriable: true }, `Failed to download chunk ${i}: ${error?.message}`);
          }
          const localPath = path.join(tmpDir, `${i}.mp3`);
          fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
          return localPath;
        }),
      );

      const concatListPath = path.join(tmpDir, "list.txt");
      fs.writeFileSync(concatListPath, localPaths.map((p) => `file '${path.basename(p)}'`).join("\n"));

      const outPath = path.join(tmpDir, "out.mp3");

      try {
        // Re-encode through libmp3lame instead of -c copy. With per-chapter
        // chunks (~6 boundaries on a 20-min generation) and xAI returning
        // chunks whose MP3 frames don't always line up byte-for-byte,
        // stream-copy concat produces corrupted frames at the joins:
        // mid-word cuts, dropouts, "stops randomly" on playback. Re-encoding
        // normalizes the entire output stream and adds 5-10s of CPU on
        // stitch; small price for clean audio.
        await execa(
          "ffmpeg",
          [
            "-f", "concat",
            "-safe", "0",
            "-i", concatListPath,
            "-c:a", "libmp3lame",
            "-b:a", "128k",
            "-ar", "24000",
            outPath,
          ],
          { cwd: tmpDir, stdio: "pipe" },
        );
      } catch (err: unknown) {
        const e = err as { stderr?: string };
        throw new AppError({ stage: "stitch", provider: "ffmpeg", code: "concat_failed", upstreamBody: truncateForStorage(e.stderr), attempt: 1, generationId, retriable: true }, `ffmpeg concat failed: ${e.stderr}`, err as Error);
      }

      // Get duration
      let durationSeconds = 0;
      try {
        const { stdout } = await execa("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", outPath], {
          stdio: "pipe",
        });
        durationSeconds = Math.round(parseFloat(stdout));
      } catch {
        // Non-fatal; duration just won't be set
      }

      // Upload final MP3
      const audioPath = `${userId}/${generationId}.mp3`;
      const audioBuffer = fs.readFileSync(outPath);
      const { error: audioUploadError } = await supabase.storage
        .from("audio")
        .upload(audioPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      if (audioUploadError) {
        throw new AppError({ stage: "storage", provider: "supabase", code: "upload_failed", attempt: 1, generationId, retriable: true }, `Failed to upload final audio: ${audioUploadError.message}`);
      }

      // Cleanup tmp and tts-chunks. The remove() API accepts a list, so one
      // round trip beats N sequential ones.
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (chunkPaths.length > 0) {
        await supabase.storage.from("tts-chunks").remove(chunkPaths);
      }

      // Mark complete
      await supabase.from("generations").update({
        audio_path: audioPath,
        audio_duration_seconds: durationSeconds,
        status: "complete",
        completed_at: new Date().toISOString(),
      }).eq("id", generationId);

      logger.info("Generation complete", { generationId, durationSeconds });

      posthog?.capture({
        distinctId: userId,
        event: "generation_completed",
        properties: {
          generation_id: generationId,
          duration_seconds: durationSeconds,
          chapter_count: chapters.length,
          elapsed_ms: Date.now() - startedAt,
          duration,
          familiarity,
          intent,
          voice,
        },
      });

      return { audioPath, durationSeconds };

    } catch (err: unknown) {
      const errorInfo = err instanceof AppError ? err.info : {
        stage: "unknown" as const,
        provider: "internal" as const,
        code: (err as { message?: string })?.message?.slice(0, 200) ?? "unknown",
        attempt: 1,
        generationId,
        retriable: false,
      };

      await setGenerationStatus(generationId, "failed", { error: errorInfo });
      await logRunEvent({
        generationId,
        stage: errorInfo.stage,
        provider: errorInfo.provider,
        kind: "error",
        error: err instanceof AppError ? err.toJSON() : truncateForStorage(String(err)),
      });

      posthog?.capture({
        distinctId: userId,
        event: "generation_failed",
        properties: {
          generation_id: generationId,
          stage: errorInfo.stage,
          provider: errorInfo.provider,
          code: errorInfo.code,
          retriable: errorInfo.retriable,
          elapsed_ms: Date.now() - startedAt,
        },
      });

      throw err;
    } finally {
      if (posthog) await posthog.shutdown();
    }
  },
});

function splitIntoChunks(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const parts = splitOversizedText(para.trim(), maxChars);
    for (const part of parts) {
      if (current.length + part.length + 2 > maxChars && current.length > 0) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = current ? `${current}\n\n${part}` : part;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitOversizedText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return text ? [text] : [];

  const sentenceParts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentenceParts.map((s) => s.trim()).filter(Boolean)) {
    if (sentence.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      chunks.push(...splitByWords(sentence, maxChars));
      continue;
    }

    if (current.length + sentence.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitByWords(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

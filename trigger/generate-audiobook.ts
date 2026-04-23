import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { execa } from "execa";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { buildOutlinePrompt, parseOutlineResponse } from "../lib/prompts/outline";
import { buildAggregatePrompt } from "../lib/prompts/aggregate";
import { setGenerationStatus, bumpProgress, logRunEvent } from "../lib/supabase/progress";
import { BartlettError, truncateForStorage } from "../lib/errors";
import { chapterResearch } from "./chapter-research";
import { chapterDraft } from "./chapter-draft";
import { ttsChunk } from "./tts-chunk";
import type { ChapterPlan, StyleCard, FamiliarityLevel, IntentType, VoiceId, SourcesConfig, ChapterResearch } from "../lib/types";
import { getDurationWords } from "../lib/types";

const MAX_CHUNK_CHARS = 12000;

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

export const generateAudiobook = task({
  id: "generate-audiobook",
  maxDuration: 3600,
  run: async (payload: GeneratePayload) => {
    const { generationId, userId, topic, duration, familiarity, intent, voice, styleCard } = payload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
      // ── Stage 1: Outline ──────────────────────────────────────────────────
      const { data: existingGeneration } = await supabase
        .from("generations")
        .select("outline, audio_path")
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
        await logRunEvent({ generationId, stage: "outline", provider: "anthropic", kind: "call", attempt: 1, payload: { model: "claude-sonnet-4-6" } });

        let outlineResponse: Anthropic.Message;
        try {
          outlineResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            messages: [{ role: "user", content: outlinePrompt }],
          });
        } catch (err: unknown) {
          const e = err as { status?: number; message?: string };
          throw new BartlettError({ stage: "outline", provider: "anthropic", code: "api_error", upstreamStatus: e.status, attempt: 1, generationId, retriable: true }, `Outline failed: ${e.message}`, err as Error);
        }

        const outlineText = outlineResponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

        try {
          chapters = parseOutlineResponse(outlineText);
        } catch (err: unknown) {
          throw new BartlettError({ stage: "outline", provider: "anthropic", code: "schema_mismatch", attempt: 1, generationId, retriable: false }, "Failed to parse outline JSON", err as Error);
        }

        await logRunEvent({ generationId, stage: "outline", provider: "anthropic", kind: "call", attempt: 1, durationMs: Date.now() - outlineStart, response: { chapterCount: chapters.length } });
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

      const researchResults: ChapterResearch[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const result = await tasks.triggerAndWait<typeof chapterResearch>("chapter-research", {
          generationId,
          chapterIdx: i,
          chapter: chapters[i],
        });

        if (!result.ok) {
          throw new BartlettError({ stage: "research", provider: "anthropic", code: "child_task_failed", attempt: 1, generationId, chapterIdx: i, retriable: true }, `Chapter ${i} research failed`);
        }
        researchResults.push(result.output);
        await bumpProgress(generationId, "research", { done: i + 1, total: chapters.length });
      }

      // ── Stage 3: Drafting ─────────────────────────────────────────────────
      await setGenerationStatus(generationId, "drafting");
      await bumpProgress(generationId, "drafting", { done: 0, total: chapters.length });
      logger.info("Stage 3: Drafting chapters", { generationId });

      const drafts: string[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const result = await tasks.triggerAndWait<typeof chapterDraft>("chapter-draft", {
          generationId,
          chapterIdx: i,
          chapter: chapters[i],
          research: researchResults[i],
          styleCard,
          totalChapters: chapters.length,
        });

        if (!result.ok) {
          throw new BartlettError({ stage: "draft", provider: "anthropic", code: "child_task_failed", attempt: 1, generationId, chapterIdx: i, retriable: true }, `Chapter ${i} draft failed`);
        }
        drafts.push(result.output);
        await bumpProgress(generationId, "drafting", { done: i + 1, total: chapters.length });
      }

      // ── Stage 4: Aggregation ──────────────────────────────────────────────
      await setGenerationStatus(generationId, "aggregating");
      logger.info("Stage 4: Aggregating script", { generationId });

      const aggregatePrompt = buildAggregatePrompt({
        chapters: chapters.map((c, i) => ({ title: c.title, draft: drafts[i] })),
        styleCard,
        targetTotalWords: getDurationWords(duration),
      });

      const aggStart = Date.now();
      await logRunEvent({ generationId, stage: "aggregate", provider: "anthropic", kind: "call", attempt: 1 });

      let aggResponse: Anthropic.Message;
      try {
        aggResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          messages: [{ role: "user", content: aggregatePrompt }],
        });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        throw new BartlettError({ stage: "aggregate", provider: "anthropic", code: "api_error", upstreamStatus: e.status, attempt: 1, generationId, retriable: true }, `Aggregation failed: ${e.message}`, err as Error);
      }

      const fullScript = aggResponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

      await logRunEvent({ generationId, stage: "aggregate", provider: "anthropic", kind: "call", attempt: 1, durationMs: Date.now() - aggStart, response: { wordCount: fullScript.split(/\s+/).length } });
      await supabase.from("generations").update({ full_script: fullScript }).eq("id", generationId);

      // ── Stage 5: TTS ──────────────────────────────────────────────────────
      await setGenerationStatus(generationId, "synthesizing");
      logger.info("Stage 5: TTS synthesis", { generationId });

      const chunks = splitIntoChunks(fullScript, MAX_CHUNK_CHARS);
      await bumpProgress(generationId, "tts", { done: 0, total: chunks.length });

      const chunkPaths: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const result = await tasks.triggerAndWait<typeof ttsChunk>("tts-chunk", {
          generationId,
          chunkIdx: i,
          text: chunks[i],
          voice,
        });

        if (!result.ok) {
          throw new BartlettError({ stage: "tts", provider: "xai", code: "child_task_failed", attempt: 1, generationId, retriable: true }, `TTS chunk ${i} failed`);
        }
        chunkPaths.push(result.output);
        await bumpProgress(generationId, "tts", { done: i + 1, total: chunks.length });
      }

      // Download chunks and stitch with ffmpeg
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${generationId}-`));

      const localPaths: string[] = [];
      for (let i = 0; i < chunkPaths.length; i++) {
        const { data, error } = await supabase.storage
          .from("tts-chunks")
          .download(chunkPaths[i]);
        if (error || !data) {
          throw new BartlettError({ stage: "stitch", provider: "supabase", code: "download_failed", attempt: 1, generationId, retriable: true }, `Failed to download chunk ${i}: ${error?.message}`);
        }
        const localPath = path.join(tmpDir, `${i}.mp3`);
        fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
        localPaths.push(localPath);
      }

      const concatListPath = path.join(tmpDir, "list.txt");
      fs.writeFileSync(concatListPath, localPaths.map((p) => `file '${path.basename(p)}'`).join("\n"));

      const outPath = path.join(tmpDir, "out.mp3");

      try {
        await execa("ffmpeg", ["-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", outPath], {
          cwd: tmpDir,
          stdio: "pipe",
        });
      } catch (err: unknown) {
        const e = err as { stderr?: string };
        throw new BartlettError({ stage: "stitch", provider: "ffmpeg", code: "concat_failed", upstreamBody: truncateForStorage(e.stderr), attempt: 1, generationId, retriable: true }, `ffmpeg concat failed: ${e.stderr}`, err as Error);
      }

      // Get duration
      let durationSeconds = 0;
      try {
        const { stdout } = await execa("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", outPath], {
          stdio: "pipe",
        });
        durationSeconds = Math.round(parseFloat(stdout));
      } catch {
        // Non-fatal — duration just won't be set
      }

      // Upload final MP3
      const audioPath = `${userId}/${generationId}.mp3`;
      const audioBuffer = fs.readFileSync(outPath);
      const { error: audioUploadError } = await supabase.storage
        .from("audio")
        .upload(audioPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      if (audioUploadError) {
        throw new BartlettError({ stage: "storage", provider: "supabase", code: "upload_failed", attempt: 1, generationId, retriable: true }, `Failed to upload final audio: ${audioUploadError.message}`);
      }

      // Cleanup tmp and tts-chunks
      fs.rmSync(tmpDir, { recursive: true, force: true });
      for (const p of chunkPaths) {
        await supabase.storage.from("tts-chunks").remove([p]);
      }

      // Mark complete
      await supabase.from("generations").update({
        audio_path: audioPath,
        audio_duration_seconds: durationSeconds,
        status: "complete",
        completed_at: new Date().toISOString(),
      }).eq("id", generationId);

      logger.info("Generation complete", { generationId, durationSeconds });
      return { audioPath, durationSeconds };

    } catch (err: unknown) {
      const errorInfo = err instanceof BartlettError ? err.info : {
        stage: "outline" as const,
        provider: "internal" as const,
        code: "unknown",
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
        error: err instanceof BartlettError ? err.toJSON() : truncateForStorage(String(err)),
      });

      throw err;
    }
  },
});

function splitIntoChunks(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

import { task, logger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { AppError, truncateForStorage } from "../lib/errors";
import { logRunEvent } from "../lib/supabase/progress";
import { recordProviderUsage } from "../lib/usage/record";

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const MIN_CHUNK_BYTES = 1024;

export const ttsChunk = task({
  id: "tts-chunk",
  // Bumped from 3 to 6: lets long-form generations run all their chunks
  // simultaneously instead of in 2-3 sequential batches. Each request is the
  // same size as before, so we're not changing per-request behavior; just
  // letting xAI's queue see them all at once. The task already retries 429s
  // (status >= 500 || status === 429 → retriable) so a brief rate-limit blip
  // won't fail the run.
  queue: { name: "tts-chunk", concurrencyLimit: 6 },
  maxDuration: 300,
  run: async (payload: {
    generationId: string;
    userId?: string;
    chunkIdx: number;
    text: string;
    voice: string;
  }) => {
    const { generationId, userId, chunkIdx, text, voice } = payload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const storagePath = `${generationId}/${chunkIdx}.mp3`;

    // Idempotency: check if chunk already exists
    const { data: existing } = await supabase.storage
      .from("tts-chunks")
      .list(generationId, { search: `${chunkIdx}.mp3` });

    if (existing && existing.length > 0) {
      logger.info("TTS chunk already exists, skipping", { generationId, chunkIdx });
      return storagePath;
    }

    const startTime = Date.now();

    await logRunEvent({
      generationId,
      stage: "tts",
      provider: "xai",
      kind: "call",
      attempt: 1,
      payload: { chunkIdx, textLength: text.length, voice },
    });

    let audioBuffer: ArrayBuffer;
    try {
      const response = await fetch(XAI_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice_id: voice.charAt(0).toUpperCase() + voice.slice(1), // "eve" → "Eve"
          // 24 kHz is xAI's documented default (TTS-guide.md, section 7) and
          // the speech-optimized path; 44.1 kHz was burning extra synthesis
          // time for sample resolution that's audibly identical on narration.
          output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
          language: "en",
        }),
        signal: AbortSignal.timeout(240_000),
      });

      if (!response.ok) {
        const body = await response.text();
        await logRunEvent({
          generationId,
          stage: "tts",
          provider: "xai",
          kind: "error",
          attempt: 1,
          error: truncateForStorage({ status: response.status, body }),
        });
        throw new AppError(
          {
            stage: "tts",
            provider: "xai",
            code: `http_${response.status}`,
            upstreamStatus: response.status,
            upstreamBody: truncateForStorage(body),
            attempt: 1,
            generationId,
            retriable: response.status >= 500 || response.status === 429,
          },
          `xAI TTS returned ${response.status}`,
        );
      }

      audioBuffer = await response.arrayBuffer();
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        {
          stage: "tts",
          provider: "xai",
          code: "network_error",
          attempt: 1,
          generationId,
          retriable: true,
        },
        `xAI TTS network error: ${(err as Error).message}`,
        err as Error,
      );
    }

    // Record usage IMMEDIATELY — xAI has charged us for the synthesis even if
    // the audio is undersized or upload fails downstream.
    await recordProviderUsage({
      generationId,
      userId,
      stage: "tts",
      provider: "xai",
      model: `xai-tts-${voice}`,
      ttsCharacters: text.length,
      durationMs: Date.now() - startTime,
    });

    if (audioBuffer.byteLength < MIN_CHUNK_BYTES) {
      throw new AppError(
        {
          stage: "tts",
          provider: "xai",
          code: "empty_audio",
          attempt: 1,
          generationId,
          retriable: true,
        },
        `TTS returned suspiciously small audio (${audioBuffer.byteLength} bytes) for chunk ${chunkIdx}`,
      );
    }

    const { error: uploadError } = await supabase.storage
      .from("tts-chunks")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new AppError(
        {
          stage: "tts",
          provider: "supabase",
          code: "upload_failed",
          attempt: 1,
          generationId,
          retriable: true,
        },
        `Failed to upload TTS chunk ${chunkIdx}: ${uploadError.message}`,
      );
    }

    await logRunEvent({
      generationId,
      stage: "tts",
      provider: "xai",
      kind: "call",
      attempt: 1,
      durationMs: Date.now() - startTime,
      response: { chunkIdx, bytes: audioBuffer.byteLength, storagePath },
    });

    logger.info("TTS chunk complete", { generationId, chunkIdx, bytes: audioBuffer.byteLength });
    return storagePath;
  },
});

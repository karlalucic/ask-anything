import "server-only";

import { z } from "zod";
import { serverError } from "@/lib/api-errors";
import { createAudioSignedUrlResponse } from "@/lib/supabase/audio";
import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import type { AudioUrlResponse, Chapter, Generation, PlaybackPosition } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AccessibleAudioResult =
  | { ok: true; audio: AudioUrlResponse }
  | { ok: false; status: 401 | 404 | 500; body: { error: string; requestId?: string } };

export const MAX_PLAYBACK_POSITION_SECONDS = 24 * 60 * 60;

export const playbackPositionSchema = z.object({
  positionSeconds: z.number().min(0).max(MAX_PLAYBACK_POSITION_SECONDS),
  durationSeconds: z.number().min(0).max(MAX_PLAYBACK_POSITION_SECONDS).nullable().optional(),
});

function notFound(): AccessibleAudioResult {
  return { ok: false, status: 404, body: { error: "Not found" } };
}

function audioUnavailable(): AccessibleAudioResult {
  return { ok: false, status: 404, body: { error: "Audio not available" } };
}

export async function createSignedAudioForAccessibleGeneration(
  supabase: SupabaseServerClient,
  generationId: string,
  userId: string,
): Promise<AccessibleAudioResult> {
  const { data: generation, error } = await supabase
    .from("generations")
    .select("id, status, audio_path")
    .eq("id", generationId)
    .single();

  if (error || !generation) return notFound();
  if (generation.status !== "complete" || !generation.audio_path) return audioUnavailable();

  try {
    return { ok: true, audio: await createAudioSignedUrlResponse(generation.audio_path) };
  } catch (err) {
    const response = serverError(err, {
      route: "createSignedAudioForAccessibleGeneration",
      userId,
      extra: { generationId },
    });
    const body = await response.json() as { error: string; requestId?: string };
    return { ok: false, status: 500, body };
  }
}

export async function createSignedAudioForPublicShareToken(token: string): Promise<AccessibleAudioResult> {
  const supabase = createSupabaseServiceClient();

  const { data: link, error: linkError } = await supabase
    .from("share_links")
    .select("generation_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (linkError || !link) return notFound();

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .select("id, status, visibility, audio_path")
    .eq("id", link.generation_id)
    .eq("status", "complete")
    .eq("visibility", "public")
    .single();

  if (generationError || !generation?.audio_path) return notFound();

  try {
    return { ok: true, audio: await createAudioSignedUrlResponse(generation.audio_path) };
  } catch (err) {
    const response = serverError(err, {
      route: "createSignedAudioForPublicShareToken",
      extra: { generationId: link.generation_id },
    });
    const body = await response.json() as { error: string; requestId?: string };
    return { ok: false, status: 500, body };
  }
}

export async function getPublicSharedGeneration(token: string): Promise<(Generation & { chapters: Chapter[] }) | null> {
  const supabase = createSupabaseServiceClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("generation_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (!link) return null;

  const { data } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", link.generation_id)
    .eq("status", "complete")
    .eq("visibility", "public")
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  return data ? toGenerationWithChapters(data) : null;
}

export async function getPlaybackPosition(
  supabase: SupabaseServerClient,
  generationId: string,
  userId: string,
): Promise<{ ok: true; playbackPosition: PlaybackPosition } | { ok: false; status: 404 | 500; body: { error: string; requestId?: string } }> {
  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("id", generationId)
    .single();

  if (!generation) return { ok: false, status: 404, body: { error: "Not found" } };

  const { data, error } = await supabase
    .from("generation_playback_positions")
    .select("generation_id, position_seconds, duration_seconds, updated_at")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const response = serverError(error, {
      route: "getPlaybackPosition",
      userId,
      extra: { generationId },
    });
    const body = await response.json() as { error: string; requestId?: string };
    return { ok: false, status: 500, body };
  }

  return {
    ok: true,
    playbackPosition: {
      generationId,
      positionSeconds: data?.position_seconds ?? 0,
      durationSeconds: data?.duration_seconds ?? null,
      updatedAt: data?.updated_at ?? null,
    },
  };
}

export async function upsertPlaybackPosition(
  supabase: SupabaseServerClient,
  params: {
    generationId: string;
    userId: string;
    positionSeconds: number;
    durationSeconds: number | null;
  },
): Promise<{ ok: true; playbackPosition: PlaybackPosition } | { ok: false; status: 404 | 500; body: { error: string; requestId?: string } }> {
  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("id", params.generationId)
    .single();

  if (!generation) return { ok: false, status: 404, body: { error: "Not found" } };

  const now = new Date().toISOString();
  const playbackPosition = {
    generationId: params.generationId,
    positionSeconds: Math.round(params.positionSeconds),
    durationSeconds: params.durationSeconds == null ? null : Math.round(params.durationSeconds),
    updatedAt: now,
  };

  const { error } = await supabase
    .from("generation_playback_positions")
    .upsert({
      user_id: params.userId,
      generation_id: params.generationId,
      position_seconds: playbackPosition.positionSeconds,
      duration_seconds: playbackPosition.durationSeconds,
      updated_at: now,
    }, { onConflict: "user_id,generation_id" });

  if (error) {
    const response = serverError(error, {
      route: "upsertPlaybackPosition",
      userId: params.userId,
      extra: { generationId: params.generationId },
    });
    const body = await response.json() as { error: string; requestId?: string };
    return { ok: false, status: 500, body };
  }

  return { ok: true, playbackPosition };
}

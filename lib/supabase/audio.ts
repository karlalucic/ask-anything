import { createSupabaseServiceClient } from "./server";
import type { AudioUrlResponse } from "@/lib/types";

// Keep signed URLs short-lived and refresh during playback. Signed URLs are
// unrescindable once minted, so this caps the residual access window after a
// share revoke while still giving download links enough time to start.
export const AUDIO_SIGNED_URL_TTL_SECONDS = 30 * 60;

export async function createAudioSignedUrlResponse(
  audioPath: string,
  options?: { download?: string | boolean },
): Promise<AudioUrlResponse> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from("audio")
    .createSignedUrl(audioPath, AUDIO_SIGNED_URL_TTL_SECONDS, options);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed audio URL: ${error?.message ?? "unknown error"}`);
  }

  return {
    audioUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + AUDIO_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

export async function createAudioSignedUrl(
  audioPath: string,
  options?: { download?: string | boolean },
): Promise<string> {
  const { audioUrl } = await createAudioSignedUrlResponse(audioPath, options);
  return audioUrl;
}

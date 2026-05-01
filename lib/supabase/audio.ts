import { createSupabaseServiceClient } from "./server";

// Generations are capped at 60 minutes; 90 bounds a worst-case listening
// session with seek/scrub headroom. Signed URLs are unrescindable once minted,
// so this caps the residual access window after a revoke. We re-mint on every
// page render, so most listeners never come close to the ceiling.
const AUDIO_SIGNED_URL_TTL_SECONDS = 90 * 60;

export async function createAudioSignedUrl(
  audioPath: string,
  options?: { download?: string | boolean },
): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from("audio")
    .createSignedUrl(audioPath, AUDIO_SIGNED_URL_TTL_SECONDS, options);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed audio URL: ${error?.message ?? "unknown error"}`);
  }

  return data.signedUrl;
}

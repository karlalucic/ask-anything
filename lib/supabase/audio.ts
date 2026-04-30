import { createSupabaseServiceClient } from "./server";

const AUDIO_SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

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

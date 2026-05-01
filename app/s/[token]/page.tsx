import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AudioPlayer } from "@/components/audio-player";
import { DownloadButton } from "@/components/download-button";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { ScriptDisplay } from "@/components/script-display";
import { ScriptDownloadButton } from "@/components/script-download-button";
import { SiteNav } from "@/components/site-nav";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import { captureServerEvent } from "@/lib/posthog-server";
import { createAudioSignedUrl } from "@/lib/supabase/audio";
import { hashShareToken } from "@/lib/sharing";

export const metadata: Metadata = {
  title: "Shared podcast",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedListenPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("generation_id")
    .eq("token_hash", hashShareToken(token))
    .is("revoked_at", null)
    .single();

  if (!link) notFound();

  const { data } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", link.generation_id)
    .eq("status", "complete")
    .eq("visibility", "public")
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (!data) notFound();

  const generation = toGenerationWithChapters(data);

  captureServerEvent({
    distinctId: `share:${generation.id}`,
    event: "shared_briefing_viewed",
    properties: {
      generation_id: generation.id,
      duration: generation.duration,
    },
  });
  if (!generation.audioPath) notFound();
  const audioUrl = await createAudioSignedUrl(generation.audioPath);

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav minimal />

      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-white">{generation.title ?? generation.topic}</h1>
          <p className="text-sm text-white/40 mt-1">
            {generation.duration} min podcast
          </p>
        </div>

        <div className="mb-10">
          <AudioPlayer src={audioUrl} durationSeconds={generation.audioDurationSeconds} />
        </div>

        <div className="mb-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <FeedbackButtons generationId={generation.id} shareToken={token} />
          <div className="flex items-center gap-2">
            <DownloadButton audioUrl={audioUrl} title={generation.title ?? generation.topic} label="MP3" />
            {generation.fullScript && (
              <ScriptDownloadButton script={generation.fullScript} title={generation.title ?? generation.topic} />
            )}
          </div>
        </div>

        {generation.chapters && generation.chapters.length > 0 && (
          <div className="border-t border-white/10 pt-8 mt-8">
            <h2 className="text-sm font-medium text-white/50 mb-4">Chapters</h2>
            <ol className="space-y-2">
              {generation.chapters.map((c) => (
                <li key={c.idx} className="flex gap-3 text-sm text-white/60">
                  <span className="text-white/20 tabular-nums w-4 shrink-0">{c.idx + 1}</span>
                  <span>{c.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {generation.fullScript && (
          <ScriptDisplay script={generation.fullScript} title={generation.title ?? generation.topic} />
        )}
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { AudioPlayer } from "@/components/audio-player";
import { DownloadButton } from "@/components/download-button";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { ScriptDisplay } from "@/components/script-display";
import { ScriptDownloadButton } from "@/components/script-download-button";
import { SiteNav } from "@/components/site-nav";
import { captureServerEvent } from "@/lib/posthog-server";
import { createAudioSignedUrlResponse } from "@/lib/supabase/audio";
import { buildChapterMarks } from "@/lib/chapter-marks";
import { getPublicSharedGeneration } from "@/features/playback/server";

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
  const generation = await getPublicSharedGeneration(token);
  if (!generation) notFound();

  captureServerEvent({
    distinctId: `share:${generation.id}`,
    event: "shared_briefing_viewed",
    properties: {
      generation_id: generation.id,
      duration: generation.duration,
    },
  });
  if (!generation.audioPath) notFound();
  const audio = await createAudioSignedUrlResponse(generation.audioPath);

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
          <AudioPlayer
            src={audio.audioUrl}
            expiresAt={audio.expiresAt}
            refreshUrl={`/api/share-links/${encodeURIComponent(token)}/audio-url`}
            localStorageKey={`aa:public-playback:${generation.id}`}
            durationSeconds={generation.audioDurationSeconds}
            chapters={buildChapterMarks(generation.chapters ?? [], generation.audioDurationSeconds)}
          />
        </div>

        <div className="mb-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <FeedbackButtons generationId={generation.id} shareToken={token} />
          <div className="flex items-center gap-2">
            <DownloadButton audioUrl={audio.audioUrl} title={generation.title ?? generation.topic} label="MP3" />
            {generation.fullScript && (
              <ScriptDownloadButton script={generation.fullScript} title={generation.title ?? generation.topic} />
            )}
          </div>
        </div>

        {generation.fullScript && (
          <ScriptDisplay script={generation.fullScript} title={generation.title ?? generation.topic} />
        )}
      </div>
    </main>
  );
}

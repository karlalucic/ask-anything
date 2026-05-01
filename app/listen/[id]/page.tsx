import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/generation-progress";
import { AudioPlayer } from "@/components/audio-player";
import { ShareControls } from "@/components/share-controls";
import { DownloadButton } from "@/components/download-button";
import { ScriptDisplay } from "@/components/script-display";
import { ScriptDownloadButton } from "@/components/script-download-button";
import { SiteNav } from "@/components/site-nav";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import { createAudioSignedUrl } from "@/lib/supabase/audio";
import { buildChapterMarks } from "@/lib/chapter-marks";

export default async function ListenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/listen/${id}`);

  const { data } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", id)
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (!data) notFound();

  const generation = toGenerationWithChapters(data);
  const isOwner = generation.userId === user.id;
  const chapters = generation.chapters ?? [];

  const audioUrl = generation.audioPath ? await createAudioSignedUrl(generation.audioPath) : null;
  if (!isOwner && !audioUrl) notFound();

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav>
        <Link href="/library" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">Library</Link>
        {generation.status === "complete" && audioUrl && (
          <DownloadButton audioUrl={audioUrl} title={generation.title ?? generation.topic} label="MP3" />
        )}
        {generation.status === "complete" && generation.fullScript && (
          <ScriptDownloadButton script={generation.fullScript} title={generation.title ?? generation.topic} />
        )}
        {isOwner && generation.status === "complete" && (
          <ShareControls generationId={id} initialVisibility={generation.visibility} />
        )}
      </SiteNav>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-white">{generation.title ?? generation.topic}</h1>
          <p className="text-sm text-white/40 mt-1">
            {generation.duration} min ·{" "}
            {generation.familiarity} · {generation.intent.replace("_", " ")}
          </p>
        </div>

        {audioUrl ? (
          <div className="mb-10">
            <AudioPlayer
              src={audioUrl}
              durationSeconds={generation.audioDurationSeconds}
              chapters={buildChapterMarks(chapters, generation.audioDurationSeconds)}
            />
          </div>
        ) : (
          <div className="mb-10">
            <GenerationProgress
              generationId={id}
              initialGeneration={generation}
              initialChapters={chapters}
            />
          </div>
        )}

        {isOwner && (generation.status === "failed" || generation.status === "queued") && (
          <div className="flex gap-3 mt-6">
            <form action={`/api/generations/${id}/cancel`} method="post">
              <Button variant="ghost" size="sm" type="submit">Dismiss</Button>
            </form>
            <ResumeButton generationId={id} />
          </div>
        )}

        {generation.fullScript && generation.status === "complete" && (
          <ScriptDisplay script={generation.fullScript} title={generation.title ?? generation.topic} />
        )}
      </div>
    </main>
  );
}

function ResumeButton({ generationId }: { generationId: string }) {
  return (
    <form action={`/api/generations/${generationId}/resume`} method="post">
      <Button size="sm" type="submit">Resume</Button>
    </form>
  );
}

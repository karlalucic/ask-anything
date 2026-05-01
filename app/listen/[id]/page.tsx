import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
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
import { formatGenerationRuntime } from "@/lib/format-runtime";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Use the service client so we can populate metadata for public generations
  // even when called from an unauthenticated crawler context.
  const supabase = createSupabaseServiceClient();
  const { data: gen } = await supabase
    .from("generations")
    .select("title, topic, duration, status, visibility")
    .eq("id", id)
    .maybeSingle();

  if (!gen || gen.visibility !== "public" || gen.status !== "complete") {
    return { title: "Podcast", robots: { index: false, follow: false } };
  }

  const title = gen.title ?? gen.topic ?? "Podcast";
  const description = gen.duration ? `A ${gen.duration}-minute podcast on ${gen.topic}.` : "An AI-generated podcast.";

  return {
    title,
    description,
    openGraph: { title, description, type: "music.song" },
    twitter: { card: "summary", title, description },
  };
}

function NotAvailable({ reason }: { reason: "missing_or_private" | "still_generating" }) {
  const copy = reason === "still_generating"
    ? {
        heading: "Still being generated",
        body: "The owner is still putting this podcast together. Check back in a minute.",
      }
    : {
        heading: "Not available",
        body: "This podcast doesn't exist, or it isn't shared with your account. If someone sent you a link, ask them to share it through the share modal — that produces a link that works for you specifically.",
      };
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav minimal />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-normal leading-snug text-white">{copy.heading}</h1>
        <p className="mt-4 text-sm text-white/50">{copy.body}</p>
        <div className="mt-8 flex justify-center gap-3 text-sm">
          <Link href="/library" className="rounded-md border border-white/15 px-3 py-1.5 text-white/80 transition hover:border-white/30 hover:text-white">
            Your library
          </Link>
          <Link href="/new" className="rounded-md px-3 py-1.5 text-white/60 transition hover:text-white">
            Make your own
          </Link>
        </div>
      </div>
    </main>
  );
}

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

  // RLS denied or row missing — don't leak which. Either way, this user can't
  // see this row, so we present a single "not available" page rather than 404.
  if (!data) return <NotAvailable reason="missing_or_private" />;

  const generation = toGenerationWithChapters(data);
  const isOwner = generation.userId === user.id;
  const chapters = generation.chapters ?? [];

  const audioUrl = generation.audioPath ? await createAudioSignedUrl(generation.audioPath) : null;
  // Non-owners viewing an in-progress generation get the "still cooking" page;
  // the live progress UI is owner-only.
  if (!isOwner && !audioUrl) return <NotAvailable reason="still_generating" />;

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
            {(() => {
              const runtime = formatGenerationRuntime(generation.createdAt, generation.completedAt);
              return runtime ? <> · generated in {runtime}</> : null;
            })()}
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

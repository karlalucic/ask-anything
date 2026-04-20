import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/generation-progress";
import { AudioPlayer } from "@/components/audio-player";
import { ShareButton } from "@/components/share-button";
import { SiteNav } from "@/components/site-nav";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";

export default async function ListenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/listen/${id}`);

  const { data } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (!data) notFound();

  const generation = toGenerationWithChapters(data);
  const chapters = generation.chapters ?? [];

  const audioUrl = generation.audioPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${generation.audioPath}`
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav>
        <Link href="/library" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">Library</Link>
        {generation.status === "complete" && <ShareButton generationId={id} />}
      </SiteNav>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-white">{generation.title ?? generation.topic}</h1>
          <p className="text-sm text-white/40 mt-1">
            {generation.duration === "short" ? "5 min" : generation.duration === "medium" ? "20 min" : "60 min"} ·{" "}
            {generation.familiarity} · {generation.intent.replace("_", " ")}
          </p>
        </div>

        {audioUrl ? (
          <div className="mb-10">
            <AudioPlayer src={audioUrl} durationSeconds={generation.audioDurationSeconds} />
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

        {generation.status === "failed" && (
          <div className="flex gap-3 mt-6">
            <form action={`/api/generations/${id}/cancel`} method="post">
              <Button variant="ghost" size="sm" type="submit">Dismiss</Button>
            </form>
            <ResumeButton generationId={id} />
          </div>
        )}

        {generation.status === "complete" && chapters.length > 0 && (
          <div className="border-t border-white/10 pt-8 mt-8">
            <h2 className="text-sm font-medium text-white/50 mb-4">Chapters</h2>
            <ol className="space-y-2">
              {chapters.map((c) => (
                <li key={c.idx} className="flex gap-3 text-sm text-white/60">
                  <span className="text-white/20 tabular-nums w-4 shrink-0">{c.idx + 1}</span>
                  <span>{c.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {generation.fullScript && generation.status === "complete" && (
          <details className="mt-8 border-t border-white/10 pt-8">
            <summary className="cursor-pointer select-none text-sm text-white/30 transition-colors duration-150 hover:text-white">Read script</summary>
            <div className="mt-4 text-sm text-white/50 leading-relaxed whitespace-pre-wrap font-serif">
              {generation.fullScript}
            </div>
          </details>
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

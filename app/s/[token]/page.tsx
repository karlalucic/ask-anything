import { notFound } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AudioPlayer } from "@/components/audio-player";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { SiteNav } from "@/components/site-nav";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";

export default async function SharedListenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("generation_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (!link) notFound();

  const { data } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", link.generation_id)
    .eq("status", "complete")
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (!data) notFound();

  const generation = toGenerationWithChapters(data);
  const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${generation.audioPath}`;

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav minimal />

      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-white">{generation.title ?? generation.topic}</h1>
          <p className="text-sm text-white/40 mt-1">
            {generation.duration === "short" ? "5 min" : generation.duration === "medium" ? "20 min" : "60 min"} briefing
          </p>
        </div>

        <div className="mb-10">
          <AudioPlayer src={audioUrl} durationSeconds={generation.audioDurationSeconds} />
        </div>

        <FeedbackButtons generationId={generation.id} shareToken={token} />

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
      </div>
    </main>
  );
}

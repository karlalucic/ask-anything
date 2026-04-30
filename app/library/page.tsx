import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { GenerationCard } from "@/components/generation-card";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";
import { toGeneration } from "@/lib/supabase/mappers";

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("generations")
    .select("id, title, topic, duration, status, audio_duration_seconds, stage_progress, error, created_at, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const generations = (data ?? []).map(toGeneration);

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav>
        <Link href="/new" className={cn(buttonVariants({ size: "sm" }))}>New podcast</Link>
      </SiteNav>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-normal leading-snug text-white">Your library</h1>

        {generations.length === 0 ? (
          <div className="liquid-glass rounded-xl py-20 text-center">
            <p className="mb-5 text-sm text-white/30">You haven&apos;t generated any podcasts yet.</p>
            <Link href="/new" className={cn(buttonVariants())}>Start your first</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {generations.map((g) => <GenerationCard key={g.id} generation={g} />)}
          </div>
        )}
      </div>
    </main>
  );
}

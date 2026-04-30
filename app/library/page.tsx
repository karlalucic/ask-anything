import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { GenerationCard } from "@/components/generation-card";
import { SiteNav } from "@/components/site-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toGeneration } from "@/lib/supabase/mappers";
import type { Generation } from "@/lib/types";

type SharedLibraryItem = {
  generation: Generation;
  sharedBy: string | null;
};

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/library");

  const { data } = await supabase
    .from("generations")
    .select("id, user_id, title, topic, duration, familiarity, intent, voice, style_input, style_card, style_followups, sources_config, outline, full_script, audio_path, audio_duration_seconds, status, visibility, stage_progress, error, trigger_run_id, created_at, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const generations = (data ?? []).map(toGeneration);
  const sharedItems = await getSharedLibraryItems(user.id);

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav>
        <>
          <Link href="/account" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">Account</Link>
          <Link href="/new" className={cn(buttonVariants({ size: "sm" }))}>New podcast</Link>
        </>
      </SiteNav>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-normal leading-snug text-white">Your library</h1>

        <Tabs defaultValue="mine" className="gap-6">
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="mine">Mine</TabsTrigger>
            <TabsTrigger value="shared">Shared with you</TabsTrigger>
          </TabsList>

          <TabsContent value="mine">
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
          </TabsContent>

          <TabsContent value="shared">
            {sharedItems.length === 0 ? (
              <div className="liquid-glass rounded-xl py-20 text-center">
                <p className="text-sm text-white/30">No podcasts have been shared with this account yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sharedItems.map((item) => (
                  <GenerationCard
                    key={item.generation.id}
                    generation={item.generation}
                    sharedBy={item.sharedBy}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

async function getSharedLibraryItems(userId: string): Promise<SharedLibraryItem[]> {
  const serviceClient = createSupabaseServiceClient();
  const { data: shares } = await serviceClient
    .from("generation_shares")
    .select("generation_id, owner_id, created_at")
    .eq("shared_with", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const generationIds = (shares ?? []).map((share) => share.generation_id as string);
  if (generationIds.length === 0) return [];

  const [{ data: sharedGenerations }, { data: owners }] = await Promise.all([
    serviceClient
      .from("generations")
      .select("id, user_id, title, topic, duration, familiarity, intent, voice, style_input, style_card, style_followups, sources_config, outline, full_script, audio_path, audio_duration_seconds, status, visibility, stage_progress, error, trigger_run_id, created_at, completed_at")
      .in("id", generationIds)
      .eq("status", "complete"),
    serviceClient
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(new Set((shares ?? []).map((share) => share.owner_id as string)))),
  ]);

  const generationsById = new Map((sharedGenerations ?? []).map((row) => [row.id as string, toGeneration(row)]));
  const ownersById = new Map((owners ?? []).map((owner) => [owner.id as string, owner.display_name as string | null]));

  return (shares ?? [])
    .map((share) => {
      const generation = generationsById.get(share.generation_id as string);
      if (!generation) return null;
      return {
        generation,
        sharedBy: ownersById.get(share.owner_id as string) ?? null,
      };
    })
    .filter((item): item is SharedLibraryItem => item !== null);
}

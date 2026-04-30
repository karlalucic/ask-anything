import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { ConfigWizard } from "@/components/wizard/config-wizard";

export default async function NewPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav minimal />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-10 text-2xl font-normal leading-snug text-white">New podcast</h1>
        <ConfigWizard initialAuthed={!!user} />
      </div>
    </main>
  );
}

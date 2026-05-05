import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOutButton } from "@/components/log-out-button";
import { SiteNav } from "@/components/site-nav";
import { buttonVariants } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");
  const isAdmin = isAdminUser(user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav>
        <Link href="/library" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">Library</Link>
      </SiteNav>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-normal leading-snug text-white">Account</h1>

        <div className="liquid-glass rounded-xl p-6">
          <dl className="space-y-5">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/30">Display name</dt>
              <dd className="mt-1 text-lg text-white/80">{profile?.display_name ?? "No display name"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-white/30">Email</dt>
              <dd className="mt-1 text-lg text-white/80">{profile?.email ?? user.email ?? "No email"}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/library" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Open library
            </Link>
            {isAdmin && (
              <Link href="/admin/runs" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Open admin
              </Link>
            )}
            <LogOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}

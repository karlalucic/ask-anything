import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClaimInviteClient } from "./claim-client";
import { SiteNav } from "@/components/site-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Claim shared podcast",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ClaimInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/claim/${token}`);

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav minimal />
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-24">
        <h1 className="mb-6 text-center text-2xl font-normal leading-snug text-white">Shared podcast</h1>
        <ClaimInviteClient token={token} />
      </div>
    </main>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteNav } from "@/components/site-nav";

function SignupInner() {
  const searchParams = useSearchParams();
  const next = getSafeRedirectPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      posthog.identify(data.user.id, { email: data.user.email });
      posthog.capture("user_signed_up", { method: "email" });
    }
    setDone(true);
  }

  async function handleGoogle() {
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SiteNav minimal />
        <main className="mx-auto max-w-sm px-6 py-24 text-center">
          <h2 className="mb-3 text-2xl font-normal leading-snug text-white">Check your email</h2>
          <p className="text-sm leading-relaxed text-white/50">We sent a confirmation link to <strong className="font-medium text-white/70">{email}</strong>. Click it to activate your account.</p>
          <p className="mt-4 text-xs leading-relaxed text-white/40">Open the link in this browser to keep your draft.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <SiteNav minimal />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="liquid-glass mx-auto w-full max-w-sm rounded-2xl p-10">
          <div className="mb-8 text-center">
            <Link href="/" className="font-display text-4xl font-normal text-white">ask anything</Link>
            <p className="mt-3 text-sm text-white/40">Create your account.</p>
          </div>

          <Button variant="outline" className="w-full mb-6" onClick={handleGoogle} type="button">
            Continue with Google
          </Button>

          <div className="mb-6 flex items-center gap-3 text-xs text-white/20">
            <div className="h-px flex-1 bg-white/10" />
            <span>or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-white/50">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password" className="text-white/50">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
            </div>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account" : "Create account"}</Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            Already have an account? <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-white/60 underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

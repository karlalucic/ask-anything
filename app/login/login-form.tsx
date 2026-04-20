"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteNav } from "@/components/site-nav";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeRedirectPath(searchParams.get("next"));
  const callbackError = searchParams.get("error");
  const callbackErrorDescription = searchParams.get("error_description");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(callbackError ? (callbackErrorDescription ?? "Sign-in failed. Please try again.") : "");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Sign-in did not create a session. Please try again.");
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function handleGoogle() {
    setError("");
    setOauthLoading(true);
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <SiteNav minimal />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="liquid-glass mx-auto w-full max-w-sm rounded-2xl p-10">
          <div className="mb-8 text-center">
            <Link href="/" className="font-display text-4xl font-normal text-white">Bartlett</Link>
            <p className="mt-3 text-sm text-white/40">Welcome back.</p>
          </div>

          <Button variant="outline" className="w-full mb-6" onClick={handleGoogle} type="button" disabled={oauthLoading || loading}>
            {oauthLoading ? "Redirecting" : "Continue with Google"}
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
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1" />
            </div>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || oauthLoading}>{loading ? "Signing in" : "Sign in"}</Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            No account? <Link href="/signup" className="text-white/60 underline underline-offset-4">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

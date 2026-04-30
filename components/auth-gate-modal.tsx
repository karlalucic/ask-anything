"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface AuthGateModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthGateModal({ open, onClose }: AuthGateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    posthog.capture("auth_gate_shown");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleGoogle() {
    setError("");
    setOauthLoading(true);
    posthog.capture("auth_gate_method_clicked", { method: "google" });
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/new")}`;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass w-full max-w-sm rounded-2xl p-8 outline-none"
      >
        <h2 id="auth-gate-title" className="font-display text-3xl leading-tight text-white">
          Save your draft
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Takes 30 seconds — your topic stays put.
        </p>

        <div className="mt-7 space-y-3">
          <Button className="w-full" onClick={handleGoogle} disabled={oauthLoading}>
            {oauthLoading ? "Redirecting" : "Continue with Google"}
          </Button>
          <Link
            href="/signup?next=/new"
            onClick={() => posthog.capture("auth_gate_method_clicked", { method: "email" })}
          >
            <Button variant="outline" className="w-full" type="button">
              Use email instead
            </Button>
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-white/30">
          Already have an account?{" "}
          <Link
            href="/login?next=/new"
            className="text-white/60 underline underline-offset-4 hover:text-white"
            onClick={() => posthog.capture("auth_gate_method_clicked", { method: "signin" })}
          >
            Sign in
          </Link>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 block w-full text-center text-xs text-white/30 transition-colors hover:text-white/60"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}

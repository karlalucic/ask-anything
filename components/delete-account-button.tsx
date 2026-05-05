"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import posthog from "posthog-js";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function DeleteAccountButton() {
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE") return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to delete account");
      }

      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => undefined);
      posthog.reset();
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete account");
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setExpanded(true)}>
        <Trash2 aria-hidden />
        Delete account
      </Button>
    );
  }

  return (
    <form onSubmit={handleDelete} className="rounded-xl border border-red-400/20 bg-red-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-red-100">Delete account</h2>
          <p className="mt-2 text-sm leading-relaxed text-red-100/70">
            This permanently deletes your account, library, generated audio, scripts, uploaded sources, and shares.
            Some anonymized operational records may remain.
          </p>

          <label htmlFor="delete-confirmation" className="mt-5 block text-xs uppercase tracking-[0.18em] text-red-100/50">
            Type DELETE to confirm
          </label>
          <Input
            id="delete-confirmation"
            className="mt-2 border-red-300/20 bg-black/30 text-red-50 focus-visible:border-red-200/60 focus-visible:ring-red-200/50"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={loading}
          />

          {error && <p className="mt-3 text-sm text-red-200">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" size="sm" disabled={confirmation !== "DELETE" || loading}>
              <Trash2 aria-hidden />
              {loading ? "Deleting" : "Delete permanently"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setExpanded(false);
                setConfirmation("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

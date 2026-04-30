"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ClaimInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  const claimInvite = useCallback(async () => {
    setError("");
    setRetrying(true);
    const res = await fetch(`/api/share-invites/${token}/claim`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "This invite could not be claimed.");
      setRetrying(false);
      return;
    }
    const json = await res.json();
    router.replace(`/listen/${json.generationId}`);
    router.refresh();
  }, [router, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void claimInvite();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [claimInvite]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <Button type="button" onClick={claimInvite} disabled={retrying}>
          {retrying ? "Trying again" : "Try again"}
        </Button>
      </div>
    );
  }

  return <p className="text-center text-sm text-white/40">Claiming invite...</p>;
}

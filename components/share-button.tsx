"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

export function ShareButton({ generationId }: { generationId: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    const res = await fetch(`/api/generations/${generationId}/share`, { method: "POST" });
    if (res.ok) {
      const { token } = await res.json();
      const url = `${window.location.origin}/s/${token}`;
      await navigator.clipboard.writeText(url);
      posthog.capture("briefing_shared", { generation_id: generationId });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    setLoading(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} disabled={loading}>
      {copied ? "Link copied" : loading ? "Sharing" : "Share"}
    </Button>
  );
}

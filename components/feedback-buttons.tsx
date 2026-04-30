"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  generationId: string;
  shareToken?: string;
}

export function FeedbackButtons({ generationId, shareToken }: Props) {
  const [voted, setVoted] = useState<-1 | 1 | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(rating: -1 | 1) {
    const body: Record<string, unknown> = { rating, shareToken };
    if (note) body.note = note;
    await fetch(`/api/generations/${generationId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    posthog.capture("feedback_submitted", {
      generation_id: generationId,
      rating,
      has_note: !!note,
      is_shared: !!shareToken,
    });
    setVoted(rating);
    setSubmitted(true);
  }

  if (submitted) {
    return <p className="text-sm text-white/30">Thanks for the feedback.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/40">Was this podcast helpful?</p>
      <div className="flex items-center gap-3">
        <Button
          variant={voted === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => { setVoted(1); setShowNote(true); }}
        >
          Helpful
        </Button>
        <Button
          variant={voted === -1 ? "default" : "outline"}
          size="sm"
          onClick={() => { setVoted(-1); setShowNote(true); }}
        >
          Not helpful
        </Button>
      </div>
      {showNote && (
        <div className="space-y-2">
          <Textarea
            placeholder="Anything you'd like us to know?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm resize-none"
            rows={3}
          />
          <Button size="sm" onClick={() => voted && submit(voted)}>Submit</Button>
        </div>
      )}
    </div>
  );
}

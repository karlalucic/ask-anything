"use client";

import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenerationCard } from "@/components/generation-card";
import type { Generation } from "@/lib/types";

const REVEAL_WIDTH = 88;
const REVEAL_THRESHOLD = 48;

export function HideableGenerationCard({
  generation,
  sharedBy,
}: {
  generation: Generation;
  sharedBy?: string | null;
}) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);

  if (hidden) return null;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    startOffsetRef.current = offset;
    draggedRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    draggedRef.current = true;
    const nextOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffsetRef.current + deltaX));
    setOffset(nextOffset);
  }

  function finishDrag() {
    if (!isDragging) return;

    setIsDragging(false);
    suppressClickRef.current = draggedRef.current;
    setOffset((current) => (current <= -REVEAL_THRESHOLD ? -REVEAL_WIDTH : 0));
  }

  function handleCardClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current || offset !== 0) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      setOffset(0);
    }
  }

  async function hideFromLibrary() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/generations/${generation.id}/library-hidden`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not remove this item from your library.");
      }

      setHidden(true);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this item from your library.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl">
        <button
          type="button"
          tabIndex={offset === -REVEAL_WIDTH ? 0 : -1}
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-500 text-white transition-colors duration-150 hover:bg-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-100"
          aria-label="Remove from library"
        >
          <Trash2 aria-hidden className="size-5" />
        </button>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onClickCapture={handleCardClickCapture}
          className="relative transition-transform duration-150 ease-out"
          style={{
            transform: `translateX(${offset}px)`,
            touchAction: "pan-y",
            transitionDuration: isDragging ? "0ms" : undefined,
          }}
        >
          <GenerationCard generation={generation} sharedBy={sharedBy} />
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 py-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center sm:justify-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`hide-generation-${generation.id}`}
            className="liquid-glass w-full max-w-sm rounded-2xl p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-100">
                <Trash2 aria-hidden className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 id={`hide-generation-${generation.id}`} className="text-lg font-medium text-white">
                  Remove from library?
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  This only hides the audiobook from your library. It stays saved in Supabase and does not delete the audio, script, or sharing access.
                </p>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-200">{error}</p>}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setOffset(0);
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={hideFromLibrary} disabled={loading}>
                {loading ? "Removing" : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

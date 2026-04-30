"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

interface IntroModalProps {
  initiallyOpen: boolean;
}

const SLIDES = [
  {
    title: "Tell us what you want to understand.",
    body: "Type any subject. Pick how long the podcast should be and how much you already know.",
  },
  {
    title: "Pick how it should sound.",
    body: "Choose a writing style — like The New Yorker or a friend explaining over coffee — and a voice.",
  },
  {
    title: "Listen.",
    body: "We turn it into a personal podcast — around 5 to 45 minutes — that you can listen to or download.",
  },
];

export function IntroModal({ initiallyOpen }: IntroModalProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [slide, setSlide] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    posthog.capture("intro_step_viewed", { step: slide });
  }, [open, slide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("skipped");
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function markSeen() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    fetch("/api/profile/seen-intro", { method: "POST" }).catch(() => {
      // optimistic — server-side flag flip is best-effort
    });
  }

  function dismiss(outcome: "completed" | "skipped") {
    posthog.capture(outcome === "completed" ? "intro_completed" : "intro_skipped", { last_step: slide });
    markSeen();
    setOpen(false);
  }

  if (!open) return null;

  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => dismiss("skipped")}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass relative w-full max-w-md rounded-2xl p-8 outline-none"
      >
        <button
          type="button"
          onClick={() => dismiss("skipped")}
          className="absolute right-4 top-4 text-xs text-white/40 transition-colors hover:text-white/80"
        >
          Skip
        </button>

        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/40">
          Step {slide + 1} of {SLIDES.length}
        </p>

        <h2
          id="intro-title"
          className="mt-4 font-display text-3xl leading-tight text-white"
        >
          {current.title}
        </h2>

        <p className="mt-4 text-base leading-relaxed text-white/60">{current.body}</p>

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/20"}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {slide > 0 && (
              <Button variant="ghost" onClick={() => setSlide(slide - 1)}>
                Back
              </Button>
            )}
            {!isLast && (
              <Button onClick={() => setSlide(slide + 1)}>Next</Button>
            )}
            {isLast && (
              <Link href="/new" onClick={() => dismiss("completed")}>
                <Button>Get started</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

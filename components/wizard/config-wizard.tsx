"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clearDraft, loadDraft, saveDraft, type WizardDraftStep } from "@/lib/draft-storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FamiliarityLevel, IntentType, VoiceId, StyleCard, StyleFollowup, SourcesConfig } from "@/lib/types";
import { VOICE_LABELS } from "@/lib/types";
import { Slider } from "@/components/ui/slider";

type Step = WizardDraftStep;

interface FormState {
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  styleInput: string;
  styleCard: StyleCard | null;
  styleFollowups: StyleFollowup[];
  followupAnswers: string[];
  sourcesConfig: SourcesConfig;
  voice: VoiceId;
}

const STEPS: Step[] = ["meta", "style", "sources", "voice", "review"];
const STEP_LABELS: Record<Step, string> = {
  meta: "Topic",
  style: "Style",
  sources: "Sources",
  voice: "Voice",
  review: "Review",
};

const DEFAULT_SOURCES: SourcesConfig = {
  web: true, academic: false, userDocs: false,
  recency: "any", domains: [], userDocIds: [],
};

function formatApiError(error: unknown, status?: number): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const zodErr = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const fieldMsg = zodErr.fieldErrors && Object.values(zodErr.fieldErrors).flat()[0];
    if (fieldMsg) {
      const fieldName = zodErr.fieldErrors && Object.keys(zodErr.fieldErrors)[0];
      return fieldName ? `${fieldName}: ${fieldMsg}` : fieldMsg;
    }
    if (zodErr.formErrors?.[0]) return zodErr.formErrors[0];
  }
  return status ? `Request failed (${status})` : "Request failed";
}

function pillClass(selected: boolean, className?: string) {
  return cn(
    "min-h-11 rounded-lg border px-4 py-2.5 text-sm transition-all duration-150 focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    selected
      ? "border-white bg-white text-black"
      : "border-white/15 bg-transparent text-white/50 hover:border-white/40 hover:text-white/80",
    className
  );
}

interface ConfigWizardProps {
  initialAuthed: boolean;
}

export function ConfigWizard({ initialAuthed }: ConfigWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("meta");
  const [form, setForm] = useState<FormState>({
    topic: "", duration: 20, familiarity: "intermediate", intent: "curious",
    styleInput: "", styleCard: null, styleFollowups: [], followupAnswers: [],
    sourcesConfig: DEFAULT_SOURCES, voice: "ara",
  });
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [authed, setAuthed] = useState(initialAuthed);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (anonymous draft persistence).
  // setState-in-effect is the canonical SSR-safe pattern for localStorage —
  // it only runs once after hydration so there's no cascade.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => ({
        ...prev,
        topic: draft.topic,
        duration: draft.duration,
        familiarity: draft.familiarity,
        intent: draft.intent,
        styleInput: draft.styleInput,
        sourcesConfig: draft.sourcesConfig,
        voice: draft.voice,
      }));
      // The generated style card is provider output, so it is not persisted in
      // localStorage. If a later step was saved, restore to style so the user
      // can explicitly re-analyze before continuing.
      setStep(draft.step === "meta" || draft.step === "style" ? draft.step : "style");
    }
    setHydrated(true);
  }, []);

  // Persist only recoverable user choices. Do not store auth tokens, signed URLs,
  // secrets, provider responses, or generated audio/script content.
  useEffect(() => {
    if (!hydrated) return;
    saveDraft({
      step,
      topic: form.topic,
      duration: form.duration,
      familiarity: form.familiarity,
      intent: form.intent,
      styleInput: form.styleInput,
      sourcesConfig: form.sourcesConfig,
      voice: form.voice,
    });
  }, [hydrated, step, form.topic, form.duration, form.familiarity, form.intent, form.styleInput, form.sourcesConfig, form.voice]);

  // Live auth state — sign-in in another tab dissolves the gate
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: unknown } | null) => {
        const nextAuthed = !!session?.user;
        setAuthed(nextAuthed);
        if (nextAuthed) setShowAuthGate(false);
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (["topic", "familiarity", "intent", "styleInput"].includes(String(key))) {
        next.styleCard = null;
        next.styleFollowups = [];
        next.followupAnswers = [];
      }
      return next;
    });
  }

  async function fetchStyleCard() {
    if (!form.styleInput.trim()) return;
    if (!form.topic.trim()) {
      setStyleError("Add a topic first.");
      return;
    }
    if (!authed) {
      setShowAuthGate(true);
      return;
    }
    setStyleLoading(true);
    setStyleError("");
    try {
      const res = await fetch("/api/style/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleInput: form.styleInput, topic: form.topic, familiarity: form.familiarity, intent: form.intent }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(json.error, res.status));
      update("styleCard", json.styleCard);
      update("styleFollowups", json.followups?.map((f: { q: string; options?: string[] } | string) =>
        typeof f === "string" ? { q: f, a: "", options: [] } : { q: f.q, a: "", options: f.options ?? [] }
      ) ?? []);
      update("followupAnswers", Array(json.followups?.length ?? 0).fill(""));
      posthog.capture("style_card_generated", { style_input_length: form.styleInput.length });
    } catch (e: unknown) {
      setStyleError((e as Error).message);
    } finally {
      setStyleLoading(false);
    }
  }

  async function refineStyleCard() {
    if (!form.styleCard) return;
    setStyleLoading(true);
    try {
      const res = await fetch("/api/style/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleCard: form.styleCard,
          followups: form.styleFollowups.map((f) => f.q),
          answers: form.followupAnswers,
        }),
      });
      const json = await res.json();
      if (res.ok) update("styleCard", json.styleCard);
    } finally {
      setStyleLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: form.topic,
          duration: form.duration,
          familiarity: form.familiarity,
          intent: form.intent,
          voice: form.voice,
          styleInput: form.styleInput,
          styleCard: form.styleCard,
          styleFollowups: form.styleFollowups.map((f, i) => ({ q: f.q, a: form.followupAnswers[i] ?? "" })),
          sourcesConfig: form.sourcesConfig,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(json.error, res.status) || "Failed to start generation");
      posthog.capture("briefing_generation_started", {
        topic_length: form.topic.length,
        duration: form.duration,
        familiarity: form.familiarity,
        intent: form.intent,
        voice: form.voice,
        sources_web: form.sourcesConfig.web,
        sources_academic: form.sourcesConfig.academic,
      });
      clearDraft();
      router.push(`/listen/${json.id}`);
    } catch (e: unknown) {
      setGenError((e as Error).message);
      setGenerating(false);
    }
  }

  function next() {
    if (step === "meta" && !authed) {
      setShowAuthGate(true);
      return;
    }
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function prev() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  const canContinue =
    step === "meta" ? Boolean(form.topic.trim()) :
    step === "style" ? Boolean(form.styleCard) && !styleLoading :
    step === "review" ? Boolean(form.styleCard) && !generating :
    true;

  const primaryLabel =
    step === "review"
      ? generating ? "Starting" : "Generate podcast"
      : "Continue";

  function handlePrimaryAction() {
    if (step === "review") {
      void handleGenerate();
      return;
    }
    next();
  }

  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* Step indicator */}
      <div className="mb-10 flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const currentIdx = STEPS.indexOf(step);
          const reachable = i <= currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => reachable && setStep(s)}
                disabled={!reachable}
                className={`transition-colors duration-150 ${step === s ? "font-medium text-white" : reachable ? "text-white/30 hover:text-white/60" : "text-white/15 cursor-not-allowed"}`}
              >
                {STEP_LABELS[s]}
              </button>
              {i < STEPS.length - 1 && <span className="text-white/10 text-xs">›</span>}
            </div>
          );
        })}
      </div>

      {/* Step: Meta */}
      {step === "meta" && (
        <div className="space-y-6">
          <div>
            <Label htmlFor="topic" className="text-base font-medium text-white">What do you want to learn about?</Label>
            <Textarea
              id="topic"
              placeholder="e.g. how Steve Jobs built his empire"
              value={form.topic}
              onChange={(e) => update("topic", e.target.value)}
              className="mt-2 resize-none text-base"
              rows={3}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label className="text-base font-medium text-white">Length</Label>
              <span className="text-sm text-white/60">{form.duration} min</span>
            </div>
            <Slider
              className="mt-4"
              min={5}
              max={60}
              step={5}
              value={[form.duration]}
              onValueChange={(val) => update("duration", Array.isArray(val) ? (val as number[])[0] : (val as number))}
            />
            <div className="mt-2 flex justify-between text-[11px] text-white/30">
              <span>5 min</span>
              <span>20 min</span>
              <span>40 min</span>
              <span>60 min</span>
            </div>
          </div>

          <div>
            <Label className="text-base font-medium text-white">Your familiarity</Label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as FamiliarityLevel[]).map((f) => (
                <button
                  key={f}
                  onClick={() => update("familiarity", f)}
                  className={pillClass(form.familiarity === f, "capitalize")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium text-white">Why are you listening?</Label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ["curious", "Just curious"],
                ["work", "For work"],
                ["comparing", "Comparing options"],
                ["deep_dive", "Deep dive"],
              ] as [IntentType, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update("intent", val)}
                  className={pillClass(form.intent === val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Step: Style */}
      {step === "style" && (
        <div className="space-y-6">
          <div>
            <Label htmlFor="styleInput" className="text-base font-medium text-white">Writing style</Label>
            <p className="text-sm text-white/50 mt-1">Name an author, publication, or describe a style.</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="styleInput"
                placeholder="e.g. The New Yorker, Michael Lewis, dryly funny"
                value={form.styleInput}
                onChange={(e) => update("styleInput", e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={fetchStyleCard} disabled={styleLoading || !form.styleInput.trim()}>
                {styleLoading ? "Analyzing" : "Analyze"}
              </Button>
            </div>
            {styleError && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-400">{styleError}</p>}
          </div>

          {form.styleCard && (
            <>
              <div className="liquid-glass space-y-3 rounded-xl p-4">
                <p className="text-xs font-medium text-white/40 uppercase">Style card</p>
                <p className="text-sm text-white/80"><span className="font-medium text-white/50">Opening. </span>{form.styleCard.openingPattern}</p>
                <p className="text-sm text-white/80"><span className="font-medium text-white/50">Structure. </span>{form.styleCard.chapterShape}</p>
                <p className="text-sm text-white/80"><span className="font-medium text-white/50">Rhythm. </span>{form.styleCard.sentenceRhythm}</p>
                {form.styleCard.signatureMoves.length > 0 && (
                  <p className="text-sm text-white/80"><span className="font-medium text-white/50">Signature moves. </span>{form.styleCard.signatureMoves.join(", ")}</p>
                )}
              </div>

              {form.styleFollowups.length > 0 && (
                <div className="space-y-5">
                  <p className="text-sm font-medium text-white/70">A few questions to sharpen the style:</p>
                  {form.styleFollowups.map((f, i) => (
                    <div key={i}>
                      <Label className="text-sm text-white/50">{f.q}</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(f.options ?? []).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const updated = [...form.followupAnswers];
                              updated[i] = opt;
                              update("followupAnswers", updated);
                            }}
                            className={pillClass(form.followupAnswers[i] === opt, "py-1.5")}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={refineStyleCard} disabled={styleLoading}>
                    {styleLoading ? "Refining" : "Refine style card"}
                  </Button>
                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* Step: Sources */}
      {step === "sources" && (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium text-white">Sources</Label>
            <div className="mt-3 space-y-2">
              {([["web", "Web"], ["academic", "Academic papers"]] as [keyof SourcesConfig, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.sourcesConfig[key]}
                    onChange={(e) => update("sourcesConfig", { ...form.sourcesConfig, [key]: e.target.checked })}
                    className="size-4 rounded border-white/30 accent-white"
                  />
                  <span className="text-sm text-white/80">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium text-white">Recency</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(["any", "past_year", "past_month", "past_week"] as SourcesConfig["recency"][]).map((r) => (
                <button
                  key={r}
                  onClick={() => update("sourcesConfig", { ...form.sourcesConfig, recency: r })}
                  className={pillClass(form.sourcesConfig.recency === r, "py-1.5")}
                >
                  {r === "any" ? "Any time" : r === "past_year" ? "Past year" : r === "past_month" ? "Past month" : "Past week"}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Step: Voice */}
      {step === "voice" && (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium text-white">Choose a voice</Label>
            <div className="mt-3 space-y-2">
              {(Object.entries(VOICE_LABELS) as [VoiceId, { label: string; description: string }][]).map(([id, { label, description }]) => (
                <button
                  key={id}
                  onClick={() => update("voice", id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                    form.voice === id
                      ? "border-white bg-white/10 text-white"
                      : "border-white/10 bg-transparent text-white/60 hover:border-white/30"
                  )}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-sm ${form.voice === id ? "text-white/70" : "text-white/40"}`}>{description}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="liquid-glass divide-y divide-white/10 rounded-xl">
            {[
              ["Topic", form.topic],
              ["Length", `${form.duration} min`],
              ["Familiarity", form.familiarity],
              ["Intent", form.intent.replace("_", " ")],
              ["Style", form.styleInput],
              ["Voice", VOICE_LABELS[form.voice]?.label],
              ["Sources", [form.sourcesConfig.web && "Web", form.sourcesConfig.academic && "Academic"].filter(Boolean).join(", ") || "None"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                <span className="text-sm text-white/40">{label}</span>
                <span className="text-sm text-white/80 text-right max-w-[60%]">{value}</span>
              </div>
            ))}
          </div>

          {genError && <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-400">{genError}</p>}

        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-xl sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl gap-3">
          {STEPS.indexOf(step) > 0 && (
            <Button variant="ghost" onClick={prev} disabled={generating || styleLoading}>
              Back
            </Button>
          )}
          <Button className="flex-1" onClick={handlePrimaryAction} disabled={!canContinue}>
            {primaryLabel}
          </Button>
        </div>
      </div>

      <AuthGateModal open={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </div>
  );
}

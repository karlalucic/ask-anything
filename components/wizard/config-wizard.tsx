"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FamiliarityLevel, IntentType, VoiceId, StyleCard, StyleFollowup, SourcesConfig } from "@/lib/types";
import { VOICE_LABELS } from "@/lib/types";
import { Slider } from "@/components/ui/slider";

type Step = "meta" | "style" | "sources" | "voice" | "review";

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

function pillClass(selected: boolean, className?: string) {
  return cn(
    "rounded-lg border px-4 py-2.5 text-sm transition-all duration-150 focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    selected
      ? "border-white bg-white text-black"
      : "border-white/15 bg-transparent text-white/50 hover:border-white/40 hover:text-white/80",
    className
  );
}

export function ConfigWizard() {
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function fetchStyleCard() {
    if (!form.styleInput.trim()) return;
    setStyleLoading(true);
    setStyleError("");
    try {
      const res = await fetch("/api/style/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleInput: form.styleInput, topic: form.topic, familiarity: form.familiarity, intent: form.intent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      update("styleCard", json.styleCard);
      update("styleFollowups", json.followups?.map((f: { q: string; options?: string[] } | string) =>
        typeof f === "string" ? { q: f, a: "", options: [] } : { q: f.q, a: "", options: f.options ?? [] }
      ) ?? []);
      update("followupAnswers", Array(json.followups?.length ?? 0).fill(""));
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
      const json = await res.json();
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : JSON.stringify(json.error);
        throw new Error(msg || "Failed to start generation");
      }
      router.push(`/listen/${json.id}`);
    } catch (e: unknown) {
      setGenError((e as Error).message);
      setGenerating(false);
    }
  }

  function next() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function prev() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-10 flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s)}
              className={`transition-colors duration-150 ${step === s ? "font-medium text-white" : "text-white/30 hover:text-white/60"}`}
            >
              {STEP_LABELS[s]}
            </button>
            {i < STEPS.length - 1 && <span className="text-white/10 text-xs">›</span>}
          </div>
        ))}
      </div>

      {/* Step: Meta */}
      {step === "meta" && (
        <div className="space-y-6">
          <div>
            <Label htmlFor="topic" className="text-base font-medium text-white">What do you want to learn about?</Label>
            <Textarea
              id="topic"
              placeholder="e.g. why the Dutch Republic became a financial superpower"
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
              max={45}
              step={5}
              value={[form.duration]}
              onValueChange={(val) => update("duration", Array.isArray(val) ? (val as number[])[0] : (val as number))}
            />
            <div className="mt-2 flex justify-between text-[11px] text-white/30">
              <span>5 min</span>
              <span>15 min</span>
              <span>30 min</span>
              <span>45 min</span>
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

          <Button className="w-full" onClick={next} disabled={!form.topic.trim()}>Continue</Button>
        </div>
      )}

      {/* Step: Style */}
      {step === "style" && (
        <div className="space-y-6">
          <div>
            <Label htmlFor="styleInput" className="text-base font-medium text-white">Writing style</Label>
            <p className="text-sm text-white/50 mt-1">Name an author, publication, or describe a style.</p>
            <div className="flex gap-2 mt-2">
              <Input
                id="styleInput"
                placeholder="e.g. The New Yorker, Michael Lewis, dryly funny"
                value={form.styleInput}
                onChange={(e) => update("styleInput", e.target.value)}
                onBlur={fetchStyleCard}
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

          <div className="flex gap-3">
            <Button variant="ghost" onClick={prev}>Back</Button>
            <Button className="flex-1" onClick={next} disabled={!form.styleCard}>Continue</Button>
          </div>
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

          <div className="flex gap-3">
            <Button variant="ghost" onClick={prev}>Back</Button>
            <Button className="flex-1" onClick={next}>Continue</Button>
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

          <div className="flex gap-3">
            <Button variant="ghost" onClick={prev}>Back</Button>
            <Button className="flex-1" onClick={next}>Continue</Button>
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

          <div className="flex gap-3">
            <Button variant="ghost" onClick={prev}>Back</Button>
            <Button className="flex-1" onClick={handleGenerate} disabled={generating}>
              {generating ? "Starting" : "Generate briefing"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import type { StyleCard, FamiliarityLevel, IntentType } from "../types";

export function buildStyleCardPrompt(params: {
  styleInput: string;
  topic: string;
  familiarity: FamiliarityLevel;
  intent: IntentType;
}): string {
  return `You are a writing style analyst. The user wants their audio briefing written in the style of: "${params.styleInput}".

The briefing topic is: "${params.topic}"
Audience familiarity: ${params.familiarity}
Listener intent: ${params.intent}

Produce a StyleCard — a precise fingerprint of this writing style — and 2–3 follow-up clarifying questions to sharpen it further.

Respond with valid JSON matching this schema exactly:
{
  "styleCard": {
    "openingPattern": "How pieces in this style open (e.g., anecdote, provocation, scene-setting)",
    "chapterShape": "How ideas are structured within a chapter (e.g., problem → insight → example → implication)",
    "sentenceRhythm": "Typical sentence length and variation pattern",
    "signatureMoves": ["3-5 recurring rhetorical or structural moves"],
    "targetWordCountRange": [minWords, maxWords]
  },
  "followups": [
    { "q": "Short question?", "options": ["Option A", "Option B", "Option C"] },
    { "q": "Short question?", "options": ["Option A", "Option B", "Option C"] },
    { "q": "Short question? (optional)", "options": ["Option A", "Option B", "Option C"] }
  ]
}

Keep options short (2–5 words each). Make them meaningfully distinct so the choice actually sharpens the style card.`;
}

export function buildStyleRefinePrompt(params: {
  styleCard: StyleCard;
  followups: string[];
  answers: string[];
}): string {
  const qa = params.followups.map((q, i) => `Q: ${q}\nA: ${params.answers[i] ?? "(no answer)"}`).join("\n\n");

  return `You have a StyleCard for a writing style, plus follow-up answers from the user.
Update the StyleCard to incorporate the new information.

Current StyleCard:
${JSON.stringify(params.styleCard, null, 2)}

Follow-up Q&A:
${qa}

Return only the updated StyleCard JSON (same schema, no extra keys):
{
  "openingPattern": "...",
  "chapterShape": "...",
  "sentenceRhythm": "...",
  "signatureMoves": ["..."],
  "targetWordCountRange": [min, max]
}`;
}

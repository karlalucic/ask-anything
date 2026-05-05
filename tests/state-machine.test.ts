import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionGeneration,
  GENERATION_UI_STATE,
  getGenerationUiState,
  isTerminalGenerationStatus,
} from "@/features/generations/state-machine";
import type { GenerationStatus } from "@/lib/types";

const statuses: GenerationStatus[] = [
  "queued",
  "outlining",
  "researching",
  "drafting",
  "aggregating",
  "synthesizing",
  "complete",
  "failed",
  "canceling",
  "canceled",
];

test("every generation status has a UI state", () => {
  for (const status of statuses) {
    const ui = getGenerationUiState(status);
    assert.equal(typeof ui.label, "string");
    assert.equal(typeof ui.helper, "string");
    assert.ok(["pending", "work", "terminal"].includes(ui.phase));
  }

  assert.deepEqual(Object.keys(GENERATION_UI_STATE).sort(), [...statuses].sort());
});

test("terminal state classification matches recovery expectations", () => {
  assert.equal(isTerminalGenerationStatus("complete"), true);
  assert.equal(isTerminalGenerationStatus("failed"), true);
  assert.equal(isTerminalGenerationStatus("canceled"), true);
  assert.equal(isTerminalGenerationStatus("canceling"), false);
  assert.equal(isTerminalGenerationStatus("synthesizing"), false);
});

test("normal happy path transitions are valid", () => {
  assert.equal(canTransitionGeneration("queued", "outlining"), true);
  assert.equal(canTransitionGeneration("outlining", "researching"), true);
  assert.equal(canTransitionGeneration("researching", "drafting"), true);
  assert.equal(canTransitionGeneration("drafting", "aggregating"), true);
  assert.equal(canTransitionGeneration("aggregating", "synthesizing"), true);
  assert.equal(canTransitionGeneration("synthesizing", "complete"), true);
});

test("resume and cancellation transitions are explicit", () => {
  assert.equal(canTransitionGeneration("failed", "queued"), true);
  assert.equal(canTransitionGeneration("canceled", "queued"), true);
  assert.equal(canTransitionGeneration("canceling", "canceled"), true);
  assert.equal(canTransitionGeneration("complete", "queued"), false);
});

test("invalid skips stay invalid", () => {
  assert.equal(canTransitionGeneration("queued", "complete"), false);
  assert.equal(canTransitionGeneration("researching", "complete"), false);
  assert.equal(canTransitionGeneration("complete", "failed"), false);
});

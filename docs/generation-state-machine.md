# Generation State Machine

The database is the source of truth for generation status. UI labels, recovery actions, and Trigger.dev orchestration should all use the same lifecycle model.

## States

| Status | Phase | User-facing meaning |
| --- | --- | --- |
| `queued` | pending | The request exists and is waiting for work to start. |
| `outlining` | work | The chapter outline is being planned. |
| `researching` | work | Chapter research and source gathering are running. |
| `drafting` | work | Chapter scripts are being written. |
| `aggregating` | work | Independently drafted chapters are being assembled into the final script. |
| `synthesizing` | work | TTS chunks and the final MP3 are being generated. |
| `complete` | terminal | The final script and audio are ready. |
| `failed` | terminal | A recoverable or unrecoverable error stopped the run. Owners may resume. |
| `canceling` | work | The app has accepted a cancel request and is coordinating with Trigger.dev. |
| `canceled` | terminal | The run was stopped by the owner. Owners may resume. |

## Allowed Transitions

```txt
queued       -> outlining | canceling | failed
outlining    -> researching | canceling | failed
researching  -> drafting | canceling | failed
drafting     -> aggregating | synthesizing | canceling | failed
aggregating  -> synthesizing | canceling | failed
synthesizing -> complete | canceling | failed
failed       -> queued
canceling    -> canceled | failed
canceled     -> queued
complete     -> terminal
```

`failed -> queued` and `canceled -> queued` are the explicit resume path in `/api/generations/[id]/resume`.

`canceling -> canceled` is the normal cancel path in `/api/generations/[id]/cancel`. `canceling -> failed` remains allowed because an upstream cancellation or final worker checkpoint can still surface an error.

## Implementation Rules

- UI labels and phases live in `features/generations/state-machine.ts`.
- New UI should call `getGenerationUiState(status)` instead of creating route-local status label maps.
- Trigger tasks should update status only through the transitions above.
- Recovery controls should only show for owner-accessible terminal states that are resumable.
- The database row remains authoritative; client-side progress is only a rendering of that row.

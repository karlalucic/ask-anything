# Bartlett — Web UI kit

High-fidelity recreation of the Bartlett web app. Single product surface; a multi-page click-through prototype covering the full flow from landing → wizard → listen → library.

## Components

| File | What it is |
|---|---|
| `Nav.jsx` | Top nav — three variants: `marketing` (logged-out), `app` (logged-in), `minimal` (wizard/shared) |
| `Button.jsx` | Primary / outline / ghost, three sizes |
| `Pill.jsx` | Selectable wizard pills |
| `Badge.jsx` | Status badges: complete / active / failed / canceled |
| `GenerationCard.jsx` | Briefing row used in library + home |
| `StepIndicator.jsx` | 5-step wizard breadcrumb |
| `StyleCard.jsx` | Analyzed-style preview block |
| `VoiceRow.jsx` | Selectable voice option |
| `ProgressStrip.jsx` | Stage dot strip + chapter checklist |
| `AudioPlayer.jsx` | Play / seek / skip |
| `ErrorBox.jsx` | Red-themed error container |
| `FeedbackButtons.jsx` | Helpful / not helpful + textarea |
| `screens/*.jsx` | Full-page compositions for each route |

## Interactive flows

Open `index.html` — it boots into the landing page. Every nav / CTA is wired:

- Landing (logged-out) → click **Get started** → `/signup`
- Signup / Login → submit → landing (logged-in)
- **New briefing** → 5-step wizard → **Generate briefing** → listen page (in-progress)
- In-progress listen auto-advances to complete after ~6s (fake)
- Library, share page, error state are all reachable from in-app nav + a small debug jumper in the bottom corner.

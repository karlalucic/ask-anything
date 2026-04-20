# Bartlett Design System

Bartlett is an on-demand audiobook and podcast generator. Users type a topic, pick how deep to go, and receive a polished, narrated audio briefing — structured like a real podcast, written in any style they want.

The product is **editorial**, not an AI tool. The aesthetic sits closer to Readwise, Everand, or The Browser than to a ChatGPT wrapper. Think: a magazine that also happens to play audio.

## Sources

This system was built from a written design spec provided by the user — there was **no codebase, Figma file, or screenshots attached**. All visual and interaction decisions trace back to the spec; anywhere the spec was silent, this doc makes a conservative editorial choice and flags it.

Stack (target): Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui (on @base-ui/react).

---

## Index

- `README.md` — you are here. Brand, content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — CSS variable tokens: colors, fonts, type scale, semantic roles, keyframes.
- `SKILL.md` — agent-invocable skill manifest.
- `assets/` — logo, favicon, any brand imagery.
- `fonts/` — webfont references. (Instrument Serif + Inter — loaded from Google Fonts; see note below.)
- `preview/` — design-system preview cards surfaced in the Design System tab.
- `ui_kits/web/` — the web app UI kit (index.html + JSX components). This is the only product surface.

---

## Product surfaces

Bartlett has a single product surface — a responsive web app — with these pages:

| Route | Purpose |
|---|---|
| `/` | Landing page (logged-out marketing hero, logged-in = recent briefings) |
| `/new` | 5-step config wizard (Topic → Style → Sources → Voice → Review) |
| `/listen/[id]` | In-progress or complete briefing (audio player, chapters, script) |
| `/library` | Full list of the user's briefings |
| `/s/[token]` | Shared listen page (public, includes feedback buttons) |
| `/login`, `/signup` | Auth |

---

## Content fundamentals

Bartlett's copy is the product's voice. It is **calm, literate, and declarative**. Not cute. Not jargon-heavy. Not hypey.

### Tone
- **Editorial, not promotional.** Sentences are short and land cleanly. No exclamation points, no "unlock" or "supercharge," no emoji in product copy.
- **Confident restraint.** The product does heavy lifting (research, drafting, narration) but the copy never brags about it. It explains what happens, not how clever it is.
- **Second person, light.** "Type a subject. Choose how deep to go. Receive a polished, narrated audio briefing." The user is addressed, but never over-familiarly.

### Casing
- **Sentence case everywhere.** Buttons, nav, labels, section headers. Never Title Case On Buttons. Never ALL CAPS except for one specific treatment: small eyebrow labels (e.g. `STYLE CARD` in `text-xs tracking-wide uppercase`) used as section tags inside cards.

### Voice cues (actual copy from the spec)
- Hero: "Any topic. Narrated in minutes."
- Sub: "Type a subject. Choose how deep to go. Receive a polished, narrated audio briefing — structured like a real podcast, written in any style you want."
- CTA: `Get started free` · `New briefing` · `Generate briefing`
- Wizard label: "What do you want to learn about?"
- Wizard label: "Writing style — Name an author, publication, or describe a style."
- Feedback prompt: "Was this briefing helpful?"
- Thanks: "Thanks for the feedback."

Patterns to follow:
- Use **em dashes** (—) for editorial asides, not parentheses.
- Use **periods at the end of standalone button/nav labels? No** — buttons are sentence-fragment commands ("Get started", "Continue", "Generate briefing").
- **Labels are questions or plain nouns**: "What do you want to learn about?" / "Writing style" / "Chapters". No "🎤 Voice Selection ✨" styling.
- **Status strings are terse and mechanical**: "In progress", "3/8 chapters", "researching", "drafting". Lowercase verb-noun, no ellipses.
- **Error copy names the thing, then the cause**: `{stage} · {code}` with the human sentence below. Never "Oops!".

### What not to do
- No emoji. Anywhere. Not in empty states, not in success messages, not in the logo.
- No "AI", "LLM", "magic", "smart", "intelligent" in surface copy. Bartlett does not talk about itself as an AI product.
- No sparkles (✨), no rockets (🚀), no 🎧. The spec is explicit: no robot iconography, no AI-looking language.

---

## Visual foundations

The design is built from **type, white space, and a thin neutral border**. That is the whole kit. Everything else is restraint.

### Colors

Two accent colors, maximum. The palette is:

| Token | Value | Role |
|---|---|---|
| `--background` | `#FFFFFF` (0 0% 100%) | Page base — pure white, not off-white |
| `--foreground` | `#0A0A0A` (0 0% 4%) | Body text, primary button fill |
| `--muted` | `#F7F7F7` (0 0% 97%) | Off-white surface, player card bg |
| `--muted-foreground` | `#737373` (0 0% 45%) | Secondary text, metadata |
| `--secondary` | `#F5F5F5` (0 0% 96%) | Secondary surface |
| `--border` | `#E5E5E5` (0 0% 90%) | Hairline border — the workhorse |
| `--accent` | `#C17F2A` (28 72° 42%) | Warm amber — used very sparingly |

Used sparingly really does mean sparingly. The amber accent appears on a focused link, an eyebrow tag, or a single editorial highlight — not on buttons, not on backgrounds. Primary action color is **black**. Secondary is **white with a neutral border**.

There are no gradients. There are no color tints behind sections. There is no dark mode.

### Typography

Two families:

- **Instrument Serif** — display / headings only. Always `font-normal` (400). Used at `text-5xl` (hero), `text-2xl` (page h1), and `text-xl` (wordmark). Letter-spaced `tracking-tight`.
- **Inter** — everything else: body, UI, labels, metadata. Weights 400 / 500 / 600 in use.

Headline sizes (Tailwind scale):
- Hero h1: `text-5xl leading-tight tracking-tight font-normal` (Instrument Serif)
- Page h1: `text-2xl leading-snug font-normal` (Instrument Serif)
- Section header: `text-2xl` (Instrument Serif) or `text-base font-medium` (Inter, for form groups)
- Body / UI default: `text-sm` to `text-base`, Inter
- Metadata / caption: `text-xs text-neutral-400`

The **serif never appears at body size**. The **sans never appears at hero size**. One exception: inside a "Read script" collapsible, the script body uses `font-serif` (Instrument Serif) at `text-sm` to feel like a reading surface.

### Spacing + layout

- Max widths: `max-w-2xl` for single-column reading content (listen, wizard), `max-w-3xl` for listy content (library, logged-in home), `max-w-sm` for auth.
- Section vertical padding: `py-12` to `py-16`. Hero is `py-32`.
- Gutters: `px-6` across the board.
- Nav is `max-w-4xl mx-auto` with `border-b border-neutral-100 px-6 py-4`.
- Cards/rows are spaced by whitespace, not shadows. A typical list is `space-y-3` between cards.

### Borders + cards

- Border color is always `border-neutral-100` at rest. On hover, `border-neutral-300`.
- Card rounding is **`rounded-xl`** (12px). Buttons are `rounded-lg`. Badges are `rounded-full`. Pills (wizard selectors) are `rounded-lg`.
- **No shadows.** Anywhere. Cards lift by border darkening + a faint `bg-neutral-50/50` on hover — nothing else.

### Backgrounds + imagery

- Page background is `#FFFFFF`. Always.
- There are no decorative blobs, radial gradients, hero images, stock photography, illustrations, or textures.
- White space carries the design. A hero is text centered in generous padding; there is no visual beneath it.
- If imagery is ever added in future (e.g. episode cover art), the direction should be **warm, grainy, editorial** — not glossy, not iridescent. Think letterpress, not Figma gradient.

### Hover / press / focus

- Hover (cards/rows): border darkens one step (`neutral-100` → `neutral-300`) AND background shifts to `bg-neutral-50/50`. Combined with `transition-all duration-150`.
- Hover (ghost text links): text darkens from `text-neutral-500` → `text-neutral-900`. No underline toggle.
- Hover (primary button): slight darkening of the already-near-black fill (handled by shadcn defaults).
- Press: no shrink, no color swap. shadcn's default `:active` is fine.
- Focus: visible `ring-1 ring-neutral-900 ring-offset-2`. The focus ring uses `--ring: 0 0% 4%`.

### Transitions

- All interactive elements: `transition-colors` or `transition-all` at **150ms**. No ease curves specified; browser default is fine.
- Entry motion uses the single keyframe family `fade-rise` (16px up-translate + opacity) at 500ms ease-out. Four delay variants at 0 / 100 / 200 / 300ms build a staggered hero entrance.
- No bounces, no springs, no parallax, no scroll-tied motion, no Lottie.

### Status + stateful elements

- **Status badges** (`rounded-full text-xs px-2 py-0.5`):
  - `complete` → `bg-neutral-900 text-white`
  - active stages (`researching`, `drafting`, `narrating`) → outlined muted (`border border-neutral-200 text-neutral-600`)
  - `failed` → red variant (`bg-red-50 text-red-700 border border-red-200`)
  - `canceled` → neutral outline (`border border-neutral-200 text-neutral-500`)
- **Progress dots** (stage strip + chapter list): `w-2 h-2 rounded-full` (stage) / `w-1.5 h-1.5 rounded-full` (chapter). Done = `bg-neutral-900`, active = `bg-neutral-900 animate-pulse`, pending = `bg-neutral-200`, failed = `bg-red-500`.
- **Error containers**: `border border-red-200 bg-red-50 rounded-xl p-4`. Title is `text-red-800 font-medium text-sm`, body is `text-red-700 text-sm`.

### Transparency + blur

- Not used. There is no frosted glass, no `backdrop-blur`, no translucent overlays. The spec is explicit.
- One near-exception: `bg-neutral-50/50` on card hover — a 50%-opacity off-white, which is more a hairline than a blur.

### Corner radii

| Element | Radius |
|---|---|
| Buttons | `rounded-lg` (8px) |
| Inputs / textarea | `rounded-lg` (8px) |
| Cards / containers | `rounded-xl` (12px) |
| Pills (wizard selectors) | `rounded-lg` (8px) |
| Badges | `rounded-full` |
| Progress dots | `rounded-full` |

### What "a card" looks like in Bartlett

`border border-neutral-100 rounded-xl px-5 py-4`. No shadow. No gradient. On hover: `border-neutral-300 bg-neutral-50/50`. That's the whole card system. Every card — generation, style preview, error, audio player — is a variant of this.

---

## Iconography

Bartlett uses icons **sparingly**. The spec does not hand over an icon set or mention a library, and the visual direction explicitly rejects emoji and robot iconography.

The chosen approach:
- **Lucide** (CDN: `https://unpkg.com/lucide@latest`) for the handful of icons the UI actually needs: play, pause, skip-back 15, skip-forward 30, check, chevron, external link, x (close), share, headphones, search. Lucide's thin 2px stroke matches the editorial, hairline feel of the rest of the system.
- **Flagged substitution:** Lucide is a substitute because the spec ships no icon set. If the team has a preferred house set (or wants custom glyphs), swap it in and update `colors_and_type.css` to remove the CDN reference.
- **No emoji.** Not in copy, not in empty states, not as a playful accent.
- **No unicode glyphs as icons.** The wizard step separator `›` (U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK) is used as *typography*, not as a UI icon, and it is the only unicode mark in the system.
- **Status shapes are primitives, not icons.** Progress dots are `<span>`s with `rounded-full` and a size/color — not SVG.
- **The logo is a wordmark**, not a mark. "Bartlett" set in Instrument Serif, `text-xl tracking-tight`. No glyph, no monogram, no container. See `assets/logo.svg` and `assets/logo.html` for the canonical setting.

---

## Font substitution note

Instrument Serif and Inter are both shipped from **Google Fonts** in the production stack (the spec specifies this). This design system does **not** bundle TTF/WOFF files — it references the Google Fonts CDN at render time.

If you need fully offline, self-hosted, or air-gapped rendering, download the families from fonts.google.com, drop the WOFF2 files into `fonts/`, and update `colors_and_type.css` to use `@font-face` rules instead of the Google Fonts import. **Flag to user:** let me know if you want this switched to self-hosted and I'll rewire it.

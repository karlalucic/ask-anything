<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Ask Anything project. Both client-side (posthog-js) and server-side (posthog-node) tracking have been set up, covering the full user journey from signup through briefing creation, sharing, and feedback. Users are identified by their Supabase user ID on both the client and server, ensuring full correlation of events across domains.

**Infrastructure changes:**
- `instrumentation-client.ts` — initializes posthog-js via the Next.js 15.3+ instrumentation API with EU region, reverse proxy routing, and exception capture enabled
- `lib/posthog-server.ts` — singleton PostHog Node client for server-side event capture
- `next.config.ts` — added `/ingest` reverse proxy rewrites routing to `eu.i.posthog.com` and `eu-assets.i.posthog.com`
- `.env.local` — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` added

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully submits the email/password signup form | `app/signup/page.tsx` |
| `user_logged_in` | User successfully logs in with email/password (+ PostHog identify) | `app/login/login-form.tsx` |
| `style_card_generated` | Writing style card is generated from the user's style input | `components/wizard/config-wizard.tsx` |
| `briefing_generation_started` | User submits the wizard and a generation job is started | `components/wizard/config-wizard.tsx` |
| `briefing_shared` | User copies a share link for a completed briefing | `components/share-button.tsx` |
| `feedback_submitted` | User submits a thumbs-up/down rating for a briefing | `components/feedback-buttons.tsx` |
| `generation_created` | Server-side: new briefing record created and Trigger.dev job dispatched | `app/api/generations/route.ts` |
| `generation_deleted` | Server-side: user deletes a briefing from their library | `app/api/generations/[id]/route.ts` |
| `document_uploaded` | Server-side: user uploads a PDF or adds a URL as a source document | `app/api/documents/route.ts` |
| `share_link_created` | Server-side: new share link token generated for a completed briefing | `app/api/generations/[id]/share/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://eu.posthog.com/project/169353/dashboard/652149
- **Signup → Generation funnel** (conversion from signup to first briefing): https://eu.posthog.com/project/169353/insights/s0U44weq
- **Briefings generated over time** (daily trend): https://eu.posthog.com/project/169353/insights/SbUNu5et
- **New signups over time** (daily area chart): https://eu.posthog.com/project/169353/insights/xjXfTXKI
- **Briefing engagement: share vs feedback** (weekly comparison): https://eu.posthog.com/project/169353/insights/Dx48Dz9a
- **Generation retention** (weekly cohort retention for repeat generators): https://eu.posthog.com/project/169353/insights/AZyvycLD

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

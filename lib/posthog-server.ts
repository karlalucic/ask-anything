import { after } from "next/server";
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

type CaptureArgs = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

// Schedules the capture + flush to run AFTER the response is sent. Without
// `after()`, Vercel can freeze the function before posthog-node's HTTP request
// completes, dropping events.
export function captureServerEvent({ distinctId, event, properties }: CaptureArgs): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  after(async () => {
    const client = getPostHogClient();
    if (!client) return;
    client.capture({ distinctId, event, properties });
    await client.flush();
  });
}

export function captureServerException(error: unknown, distinctId: string, properties?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  after(async () => {
    const client = getPostHogClient();
    if (!client) return;
    client.captureException(error, distinctId, properties);
    await client.flush();
  });
}

import posthog from "posthog-js";

function redactSensitiveUrl(value: string): string {
  return value
    .replace(/(\/s\/)[^/?#]+/g, "$1[token]")
    .replace(/(\/claim\/)[^/?#]+/g, "$1[token]")
    .replace(/(next=)(%2Fclaim%2F|\/claim\/)[^&#]+/gi, "$1$2[token]")
    .replace(/(next=)(%2Fs%2F|\/s\/)[^&#]+/gi, "$1$2[token]");
}

if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    before_send: (event) => {
      if (!event?.properties) return event;
      for (const [key, value] of Object.entries(event.properties)) {
        if (typeof value === "string") {
          event.properties[key] = redactSensitiveUrl(value);
        }
      }
      return event;
    },
  });
}

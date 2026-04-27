import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: "ask-anything" },
});

export function childLogger(ctx: Record<string, unknown>) {
  return logger.child(ctx);
}

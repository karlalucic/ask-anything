import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

/**
 * Return a 5xx response without leaking upstream error text to the client.
 * Logs the underlying error with a request-scoped id so server logs can be
 * correlated to the id surfaced in the response.
 */
export function serverError(
  err: unknown,
  context: { route: string; userId?: string | null; extra?: Record<string, unknown> },
  status = 500,
): NextResponse {
  const requestId = randomUUID();
  const message = err instanceof Error ? err.message : String(err);

  logger.error(
    { requestId, route: context.route, userId: context.userId, ...context.extra, err: message },
    "api_server_error",
  );

  return NextResponse.json(
    { error: "Something went wrong. Please try again.", requestId },
    { status },
  );
}

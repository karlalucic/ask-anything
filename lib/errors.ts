import type { BartlettErrorInfo } from "./types";

export class BartlettError extends Error {
  constructor(
    readonly info: BartlettErrorInfo,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "BartlettError";
  }

  toJSON() {
    return {
      ...this.info,
      message: this.message,
      stack: this.stack,
    };
  }
}

export function isBartlettError(e: unknown): e is BartlettError {
  return e instanceof BartlettError;
}

/** Wraps a Supabase upsert/update/insert result and throws if no rows were affected. */
export function assertWritten(
  data: unknown[] | null,
  info: Omit<BartlettErrorInfo, "code" | "retriable">,
): void {
  if (!data || data.length === 0) {
    throw new BartlettError(
      { ...info, code: "rls_denied", retriable: false },
      `Database write rejected (RLS or no match): ${info.stage}/${info.provider}`,
    );
  }
}

/** Truncates arbitrary data for storage in error columns. */
export function truncateForStorage(value: unknown, maxBytes = 4096): unknown {
  const str = JSON.stringify(value);
  if (str.length <= maxBytes) return value;
  return { truncated: true, preview: str.slice(0, maxBytes) + "…" };
}

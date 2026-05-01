import type { AppErrorInfo } from "./types";

export class AppError extends Error {
  constructor(
    readonly info: AppErrorInfo,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "AppError";
  }

  toJSON() {
    return {
      ...this.info,
      message: this.message,
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Wraps a Supabase upsert/update/insert result and throws if no rows were affected. */
export function assertWritten(
  data: unknown[] | null,
  info: Omit<AppErrorInfo, "code" | "retriable">,
): void {
  if (!data || data.length === 0) {
    throw new AppError(
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

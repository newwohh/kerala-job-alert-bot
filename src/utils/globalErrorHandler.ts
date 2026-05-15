import { error } from "./logger.js";

function describe(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string") {
      switch (code) {
        case "ECONNREFUSED":
          return "Connection refused";
        case "ENOTFOUND":
          return "Host not found";
        case "ETIMEDOUT":
          return "Connection timed out";
      }
    }
  }
  return "Unhandled error";
}

function handleUnhandledRejection(reason: unknown): void {
  error("Unhandled rejection:", describe(reason), reason);
  process.exitCode = 1;
}

function handleUncaughtException(err: Error): void {
  error("Uncaught exception:", describe(err), err);
  process.exitCode = 1;
}

export function setupGlobalErrorHandlers(): void {
  process.on("unhandledRejection", handleUnhandledRejection);
  process.on("uncaughtException", handleUncaughtException);
}

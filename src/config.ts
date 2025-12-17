
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number env: ${name}`);
  return n;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean env: ${name}`);
}

export const config = {
  botToken: required("BOT_TOKEN"),
  channelId: required("CHANNEL_ID"),
  mongoUri: required("MONGODB_URI"),
  mongoDb: process.env.MONGODB_DB ?? "job_alerts",
  cron: process.env.CRON_SCHEDULE ?? "*/20 * * * *",
  requestTimeoutMs: numberFromEnv("REQUEST_TIMEOUT_MS", 15000),
  maxPages: numberFromEnv("MAX_PAGES", 3),
  infosysEnabled: booleanFromEnv("INFOSYS_ENABLED", false),
  infosysKeyword: process.env.INFOSYS_KEYWORD ?? ""
};

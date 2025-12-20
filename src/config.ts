
import "dotenv/config";
import { envBoolean, envNumber, envsafe, envString } from "@newwohh/env-safe";

function numberListFromEnv(name: string): number[] {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n));
}

envsafe(["BOT_TOKEN", "CHANNEL_ID", "MONGODB_URI"]);

export const config = {
  botToken: envString("BOT_TOKEN"),
  channelId: envString("CHANNEL_ID"),
  mongoUri: envString("MONGODB_URI"),
  mongoDb: envString("MONGODB_DB", { default: "job_alerts" }),
  cron: envString("CRON_SCHEDULE", { default: "*/20 * * * *" }),
  cronEnabled: envBoolean("CRON_ENABLED", { default: true, truthy: ["1", "true", "yes", "y", "on"], falsy: ["0", "false", "no", "n", "off"] }),
  analyticsEnabled: envBoolean("ANALYTICS_ENABLED", { default: false, truthy: ["1", "true", "yes", "y", "on"], falsy: ["0", "false", "no", "n", "off"] }),
  analyticsCron: envString("ANALYTICS_CRON", { default: "0 9 * * *" }),
  analyticsWindowHours: envNumber("ANALYTICS_WINDOW_HOURS", { default: 24 }),
  analyticsChatId: envString("ANALYTICS_CHAT_ID", { default: "" }),
  analyticsAdminIds: numberListFromEnv("ANALYTICS_ADMIN_IDS"),
  requestTimeoutMs: envNumber("REQUEST_TIMEOUT_MS", { default: 15000 }),
  maxPages: envNumber("MAX_PAGES", { default: 3 }),
  infosysEnabled: envBoolean("INFOSYS_ENABLED", { default: false, truthy: ["1", "true", "yes", "y", "on"], falsy: ["0", "false", "no", "n", "off"] }),
  infosysKeyword: envString("INFOSYS_KEYWORD", { default: "" }),
  groupTitle: envString("GROUP_TITLE", { default: "Join Kerala Jobs Alerts" }),
  groupUrl: envString("GROUP_URL", { default: "https://t.me/joinkeralajobsalerts" }),
  promoText: envString("PROMO_TEXT", { default: "" }),
  promoUrl: envString("PROMO_URL", { default: "" }),
  promoButtonText: envString("PROMO_BUTTON_TEXT", { default: "Learn more" }),
  runJobsOnStartup: envBoolean("RUN_JOBS_ON_STARTUP", { default: false, truthy: ["1", "true", "yes", "y", "on"], falsy: ["0", "false", "no", "n", "off"] }),
  onboardingChatId: envString("ONBOARDING_CHAT_ID", { default: "" })
};

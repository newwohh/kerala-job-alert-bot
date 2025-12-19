import TelegramBot from "node-telegram-bot-api";
import { config } from "../config.js";
import { Job } from "../types/job.js";

export const bot = new TelegramBot(config.botToken, {
  polling: { autoStart: false }
});

let listenersInstalled = false;
let restarting = false;
let restartTimer: NodeJS.Timeout | undefined;
let backoffMs = 1_000;
const BACKOFF_MAX_MS = 60_000;

function isConflict409(err: unknown): boolean {
  const anyErr = err as any;
  const code = anyErr?.code;
  const statusCode = anyErr?.response?.statusCode;
  const body = String(anyErr?.response?.body ?? anyErr?.body ?? anyErr?.message ?? "");
  return code === 409 || statusCode === 409 || body.includes("409");
}

function schedulePollingRestart(reason: string, err: unknown): void {
  if (isConflict409(err)) {
    // eslint-disable-next-line no-console
    console.error(
      "Polling conflict (409). Another instance is likely running with the same BOT_TOKEN. Stop other instances.",
      err
    );
    return;
  }

  if (restarting) return;
  restarting = true;

  if (restartTimer) clearTimeout(restartTimer);
  const waitMs = Math.min(BACKOFF_MAX_MS, backoffMs) + Math.floor(Math.random() * 500);
  // eslint-disable-next-line no-console
  console.error(`Polling error (${reason}). Restarting polling in ${waitMs}ms`, err);

  restartTimer = setTimeout(async () => {
    try {
      try {
        await Promise.resolve(bot.stopPolling());
      } catch {
      }

      try {
        await bot.deleteWebHook();
      } catch {
      }

      bot.startPolling();
      backoffMs = 1_000;
    } catch (e) {
      backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
      restarting = false;
      schedulePollingRestart("restart_failed", e);
      return;
    }

    restarting = false;
  }, waitMs);

  backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
}

export async function startBotPolling(): Promise<void> {
  if (!listenersInstalled) {
    listenersInstalled = true;
    bot.on("polling_error", err => schedulePollingRestart("polling_error", err));
    bot.on("webhook_error", err => schedulePollingRestart("webhook_error", err));
  }

  try {
    await bot.deleteWebHook();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to delete webhook:", err);
  }

  if (!bot.isPolling()) {
    bot.startPolling();
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function post(job: Job): Promise<void> {
  await sendJobToChat(config.channelId, job);
}

export async function sendJobToChat(chatId: number | string, job: Job): Promise<void> {
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const source = escapeHtml(job.source);
  const link = escapeHtmlAttr(job.link);

  const footerLines: string[] = [];
  if (config.groupUrl) {
    const groupTitle = escapeHtml(config.groupTitle);
    const groupUrl = escapeHtmlAttr(config.groupUrl);
    footerLines.push(`<b>${groupTitle}</b>`, `<a href="${groupUrl}">Join group</a>`);
  }

  if (config.promoText) {
    footerLines.push("", `<b>Promotion</b>`, escapeHtml(config.promoText));
    if (config.promoUrl) footerLines.push(`<a href="${escapeHtmlAttr(config.promoUrl)}">${escapeHtml(config.promoButtonText)}</a>`);
  }

  const message =
    `<b>${title}</b>\n` +
    `<b>${company}</b>\n` +
    `<i>${source}</i>\n\n` +
    `<a href="${link}">View & Apply</a>` +
    (footerLines.length ? `\n\n────────\n${footerLines.join("\n")}` : "");

  const inlineKeyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: "Apply", url: job.link }]
  ];

  if (config.groupUrl) {
    inlineKeyboard.push([{ text: config.groupTitle, url: config.groupUrl }]);
  }

  if (config.promoUrl && config.promoButtonText) {
    inlineKeyboard.push([{ text: config.promoButtonText, url: config.promoUrl }]);
  }

  await bot.sendMessage(chatId, message, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: inlineKeyboard }
  });
}

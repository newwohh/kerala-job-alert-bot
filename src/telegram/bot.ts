import TelegramBot from "node-telegram-bot-api";
import { config } from "../config.js";
import { Job } from "../types/job.js";

export const bot = new TelegramBot(config.botToken, { polling: true });

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

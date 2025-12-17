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

export async function post(job: Job): Promise<void> {
  await sendJobToChat(config.channelId, job);
}

export async function sendJobToChat(chatId: number | string, job: Job): Promise<void> {
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const source = escapeHtml(job.source);
  const link = job.link;

  const message =
    `<b>New Job Opening</b>\n\n` +
    `<b>${company}</b>\n` +
    `${title}\n` +
    `<i>${source}</i>\n\n` +
    `<a href="${link}">Apply Here</a>`;

  await bot.sendMessage(chatId, message, {
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

import TelegramBot from "node-telegram-bot-api";
import { config } from "../config.js";
import { AnalyticsSummary, getAnalyticsSummary } from "../db/analytics.js";

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

function joinFooterText(): string {
  if (!config.groupUrl) return "";
  const groupTitle = escapeHtml(config.groupTitle);
  const groupUrl = escapeHtmlAttr(config.groupUrl);
  return `\n\n────────\n<b>${groupTitle}</b>\n<a href="${groupUrl}">Join group</a>`;
}

function withJoinFooter(text: string): string {
  return text + joinFooterText();
}

function formatTop(lines: Array<{ label: string; count: number }>, max: number): string {
  if (lines.length === 0) return "- (none)";
  return lines
    .slice(0, Math.max(1, max))
    .map(l => `- ${escapeHtml(l.label)}: <b>${l.count}</b>`)
    .join("\n");
}

export function formatAnalyticsSummary(summary: AnalyticsSummary): string {
  const topCommands = formatTop(
    summary.commands.map(c => ({ label: c.command, count: c.count })),
    8
  );

  const topClicks = formatTop(
    summary.clicks.map(c => ({ label: c.action, count: c.count })),
    8
  );

  const topEvents = formatTop(
    summary.byEvent.map(e => ({ label: e.event, count: e.count })),
    8
  );

  const sinceIso = escapeHtml(summary.since.toISOString());

  return (
    "<b>📊 Bot Analytics</b>\n" +
    `<i>Since: ${sinceIso}</i>\n\n` +
    `👤 Unique users: <b>${summary.uniqueUsers}</b>\n` +
    `▶️ Starts: <b>${summary.starts}</b>\n` +
    `🧾 Total events: <b>${summary.totalEvents}</b>\n\n` +
    "<b>⌨️ Top commands</b>\n" +
    `${topCommands}\n\n` +
    "<b>🖱️ Top clicks</b>\n" +
    `${topClicks}\n\n` +
    "<b>🧩 Events</b>\n" +
    `${topEvents}`
  );
}

export async function postAnalyticsSummary(
  bot: TelegramBot,
  chatId: number | string,
  since: Date
): Promise<void> {
  const summary = await getAnalyticsSummary(since);
  const text = withJoinFooter(formatAnalyticsSummary(summary));

  const inline_keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  if (config.groupUrl) inline_keyboard.push([{ text: config.groupTitle, url: config.groupUrl }]);

  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: inline_keyboard.length ? { inline_keyboard } : undefined
  });
}

import TelegramBot from "node-telegram-bot-api";
import { config } from "../config.js";

export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeHtmlAttr(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function joinFooterText(): string {
  if (!config.groupUrl) return "";
  return `\n\n────────\n<b>${escapeHtml(config.groupTitle)}</b>\n<a href="${escapeHtmlAttr(config.groupUrl)}">Join group</a>`;
}

export function withJoinFooter(text: string): string {
  return text + joinFooterText();
}

export function withJoinKeyboard(
  markup?: TelegramBot.InlineKeyboardMarkup
): TelegramBot.InlineKeyboardMarkup | undefined {
  const inline_keyboard = markup ? markup.inline_keyboard.map(row => [...row]) : [];
  const hasSearch = inline_keyboard.some(row =>
    row.some(button => (button as { callback_data?: string }).callback_data === "cmd:search")
  );
  const hasJoin = config.groupUrl && inline_keyboard.some(row =>
    row.some(button => (button as { url?: string }).url === config.groupUrl)
  );
  const footer: TelegramBot.InlineKeyboardButton[] = [];

  if (config.groupUrl && !hasJoin) footer.push({ text: config.groupTitle, url: config.groupUrl });
  if (!hasSearch) footer.push({ text: "🔎 Search", callback_data: "cmd:search" });
  if (footer.length) inline_keyboard.push(footer);

  return inline_keyboard.length ? { inline_keyboard } : undefined;
}

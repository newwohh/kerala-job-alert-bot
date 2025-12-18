import TelegramBot from "node-telegram-bot-api";
import { addKeyword, listKeywords, removeKeyword } from "../db/subscriptions.js";
import { findRecentJobsByKeywords } from "../db/jobsSearch.js";
import { Job } from "../types/job.js";

const KEYWORDS: Array<{ label: string; value: string }> = [
  { label: "React", value: "react" },
  { label: "Node", value: "node" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "Flutter", value: "flutter" },
  { label: "QA", value: "qa" }
];

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

function mention(user: TelegramBot.User): string {
  const name = escapeHtml(user.first_name || user.username || "there");
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

async function welcomeText(bot: TelegramBot, user: TelegramBot.User): Promise<string> {
  const username = await getBotUsername(bot);
  const deepLink = username ? `https://t.me/${username}?start=onboard` : undefined;

  return (
    `<b>Welcome ${mention(user)}!</b>\n\n` +
    `Click <b>Start</b> below (or type /start) to set up your job alerts.\n\n` +
    (deepLink
      ? `To receive <b>DM alerts</b>, open the bot in private and press Start once:\n<a href="${escapeHtmlAttr(deepLink)}">Start bot</a>`
      : `To receive <b>DM alerts</b>, open the bot in private chat and press Start once.`)
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getBotUsername(bot: TelegramBot): Promise<string | undefined> {
  const me = await bot.getMe();
  return me.username ?? undefined;
}

async function buildKeyboard(userId: number): Promise<TelegramBot.InlineKeyboardMarkup> {
  const selected = new Set(await listKeywords(userId));

  const buttons = KEYWORDS.map(k => ({
    text: selected.has(k.value) ? `✅ ${k.label}` : k.label,
    callback_data: `ob:toggle:${k.value}`
  }));

  const rows = chunk(buttons, 2);
  rows.push([
    { text: "Done", callback_data: "ob:done" },
    { text: "My subscriptions", callback_data: "ob:list" }
  ]);

  return { inline_keyboard: rows };
}

async function onboardingText(bot: TelegramBot, user: TelegramBot.User): Promise<string> {
  const username = await getBotUsername(bot);
  const deepLink = username ? `https://t.me/${username}?start=onboard` : undefined;

  return (
    `<b>Welcome ${mention(user)}!</b>\n\n` +
    `Select the keywords you want job alerts for.\n` +
    `You will only receive alerts for selected keywords.\n\n` +
    (deepLink
      ? `To receive <b>DM alerts</b>, open the bot and press Start once:\n<a href="${escapeHtmlAttr(deepLink)}">Start onboarding</a>\n\n`
      : `To receive <b>DM alerts</b>, open the bot in private chat and press Start once.\n\n`) +
    `Pick keywords:`
  );
}

async function showList(bot: TelegramBot, chatId: number | string, userId: number): Promise<void> {
  const keywords = await listKeywords(userId);
  const text =
    keywords.length === 0
      ? "You have no subscriptions yet."
      : "<b>Your subscriptions</b>\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n");

  await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
}

function formatJob(job: Job): string {
  const company = escapeHtml(job.company);
  const title = escapeHtml(job.title);
  const source = escapeHtml(job.source);
  const link = escapeHtmlAttr(job.link);
  return (
    `<b>${title}</b>\n` +
    `<b>${company}</b> <i>• ${source}</i>\n` +
    `<a href="${link}">View & Apply</a>`
  );
}

async function showSampleJobs(bot: TelegramBot, chatId: number | string, userId: number): Promise<void> {
  const keywords = await listKeywords(userId);
  if (keywords.length === 0) return;

  const jobs = await findRecentJobsByKeywords(keywords, 5);
  if (jobs.length === 0) {
    await bot.sendMessage(chatId, "No recent matching jobs found yet (try again later).", { parse_mode: "HTML" });
    return;
  }

  const msg = "<b>Recent matching jobs</b>\n\n" + jobs.map(formatJob).join("\n\n");
  await bot.sendMessage(chatId, msg, { parse_mode: "HTML", disable_web_page_preview: true });
}

export async function sendOnboarding(bot: TelegramBot, chatId: number | string, user: TelegramBot.User): Promise<void> {
  const text = await onboardingText(bot, user);
  const keyboard = await buildKeyboard(user.id);

  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
    disable_web_page_preview: true
  });
}

export async function sendWelcome(bot: TelegramBot, chatId: number | string, user: TelegramBot.User): Promise<void> {
  const text = await welcomeText(bot, user);
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "Start", callback_data: `ob:start:${user.id}` }]]
    }
  });
}

export function registerOnboardingHandlers(bot: TelegramBot): void {
  bot.on("message", async msg => {
    if (!msg.new_chat_members || msg.new_chat_members.length === 0) return;

    for (const member of msg.new_chat_members) {
      if (member.is_bot) continue;
      await sendWelcome(bot, msg.chat.id, member);
    }
  });

  bot.on("callback_query", async query => {
    const data = query.data ?? "";
    if (!data.startsWith("ob:")) return;

    const userId = query.from.id;

    try {
      const startPrefix = "ob:start:";
      if (data.startsWith(startPrefix)) {
        const expectedIdRaw = data.slice(startPrefix.length).trim();
        const expectedId = Number(expectedIdRaw);
        if (!Number.isFinite(expectedId) || expectedId !== userId) {
          await bot.answerCallbackQuery(query.id, { text: "This button is not for you." });
          return;
        }

        await bot.answerCallbackQuery(query.id);

        if (query.message?.chat && typeof query.message.message_id === "number") {
          const text = await onboardingText(bot, query.from);
          const keyboard = await buildKeyboard(userId);
          await bot.editMessageText(text, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: "HTML",
            reply_markup: keyboard,
            disable_web_page_preview: true
          });
        } else {
          await sendOnboarding(bot, userId, query.from);
        }

        return;
      }

      if (data === "ob:done") {
        await bot.answerCallbackQuery(query.id);
        await showList(bot, query.message?.chat.id ?? userId, userId);
        await showSampleJobs(bot, query.message?.chat.id ?? userId, userId);
        return;
      }

      if (data === "ob:list") {
        await bot.answerCallbackQuery(query.id);
        await showList(bot, query.message?.chat.id ?? userId, userId);
        return;
      }

      const togglePrefix = "ob:toggle:";
      if (data.startsWith(togglePrefix)) {
        const kw = data.slice(togglePrefix.length).trim().toLowerCase();
        const current = new Set(await listKeywords(userId));
        if (current.has(kw)) await removeKeyword(userId, kw);
        else await addKeyword(userId, kw);

        await bot.answerCallbackQuery(query.id);

        if (query.message?.chat && typeof query.message.message_id === "number") {
          const text = await onboardingText(bot, query.from);
          const keyboard = await buildKeyboard(userId);
          await bot.editMessageText(text, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: "HTML",
            reply_markup: keyboard,
            disable_web_page_preview: true
          });
        }

        return;
      }

      await bot.answerCallbackQuery(query.id);
    } catch (e: any) {
      await bot.answerCallbackQuery(query.id, { text: String(e?.message ?? e) });
    }
  });
}

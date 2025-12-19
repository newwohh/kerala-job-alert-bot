import TelegramBot from "node-telegram-bot-api";
import { config } from "../config.js";
import { addKeyword, listKeywords, removeKeyword } from "../db/subscriptions.js";
import { searchJobsByKeyword } from "../db/jobsSearch.js";
import { trackEvent } from "../db/analytics.js";
import { postAnalyticsSummary } from "../analytics/report.js";
import { sendOnboarding } from "./onboarding.js";
import { Job } from "../types/job.js";

const pendingSearch = new Map<number, { chatId: number | string; expiresAt: number }>();
const PENDING_SEARCH_TTL_MS = 2 * 60 * 1000;

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function safeTrack(event: Parameters<typeof trackEvent>[0]): Promise<void> {
  if (!config.analyticsEnabled) return;
  try {
    await trackEvent(event);
  } catch {
  }
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

function withJoinKeyboard(markup?: TelegramBot.InlineKeyboardMarkup): TelegramBot.InlineKeyboardMarkup | undefined {
  if (!config.groupUrl) return markup;
  const joinRow: TelegramBot.InlineKeyboardButton[] = [{ text: config.groupTitle, url: config.groupUrl }];
  if (!markup) return { inline_keyboard: [joinRow] };
  return { inline_keyboard: [...markup.inline_keyboard, joinRow] };
}

function usage(): string {
  return (
    "<b>🔔 Job Alert Bot</b>\n" +
    "<i>Get instant job alerts based on your keywords.</i>\n\n" +
    "<b>🚀 Quick Start</b>\n" +
    "Tap <b>🧩 Onboard</b> → pick keywords → tap <b>✅ Done</b>.\n\n" +
    "<b>🧭 Commands</b>\n" +
    "🧩 /onboard — Choose keywords\n" +
    "🔎 /search <code>keyword</code> — Search stored jobs\n" +
    "➕ /subscribe <code>keyword</code> — Add a keyword\n" +
    "➖ /unsubscribe <code>keyword</code> — Remove a keyword\n" +
    "📌 /subscriptions — View your keywords\n" +
    "🛑 /cancel — Cancel interactive search\n\n" +
    "<b>✨ Examples</b>\n" +
    "/search react\n" +
    "/subscribe python\n\n" +
    "<b>💡 Tips</b>\n" +
    "- For <b>DM alerts</b>, open the bot in private chat and press Start once\n" +
    "- In groups, use <b>/onboard</b> or the buttons below" +
    joinFooterText()
  );
}

function usageKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return withJoinKeyboard({
    inline_keyboard: [
      [{ text: "🧩 Onboard", callback_data: "cmd:onboard" }],
      [
        { text: "📌 My keywords", callback_data: "cmd:subs" },
        { text: "🔎 Search", callback_data: "cmd:search" }
      ]
    ]
  })!;
}

function resultsHelp(): string {
  return (
    "<b>🔁 Keep searching</b>\n" +
    "/search — start a new search (or tap <b>🔎 Search</b> below)\n" +
    "/cancel — stop interactive search"
  );
}

function resultsKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return withJoinKeyboard({
    inline_keyboard: [[{ text: "🔎 Search again", callback_data: "cmd:search" }]]
  })!;
}

function formatJob(job: Job): string {
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const source = escapeHtml(job.source);
  const link = escapeHtmlAttr(job.link);
  return (
    `💼 <b>${title}</b>\n` +
    `🏢 <b>${company}</b>\n` +
    `📍 <i>${source}</i>\n` +
    `🔗 <a href="${link}">Open & Apply</a>`
  );
}

export function registerCommandHandlers(bot: TelegramBot): void {
  bot.on("callback_query", async query => {
    const data = query.data ?? "";
    if (!data.startsWith("cmd:")) return;

    const chatId = query.message?.chat.id ?? query.from.id;
    const userId = query.from.id;

    await safeTrack({
      event: "ui_click",
      action: data,
      userId,
      chatId: typeof chatId === "number" ? chatId : undefined,
      chatType: query.message?.chat.type
    });

    try {
      if (data === "cmd:onboard") {
        await bot.answerCallbackQuery(query.id);
        await sendOnboarding(bot, chatId, query.from);
        return;
      }

      if (data === "cmd:subs") {
        await bot.answerCallbackQuery(query.id);
        const keywords = await listKeywords(userId);
        const body = withJoinFooter(
          keywords.length === 0
            ? "No subscriptions yet. Use <b>/subscribe</b> <code>keyword</code>"
            : "<b>Your subscriptions</b>\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n")
        );
        await bot.sendMessage(chatId, body, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: withJoinKeyboard(undefined)
        });
        return;
      }

      if (data === "cmd:search") {
        pendingSearch.set(userId, { chatId, expiresAt: Date.now() + PENDING_SEARCH_TTL_MS });
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          chatId,
          withJoinFooter(
            "Send me a keyword to search (example: <b>react</b>, <b>node</b>, <b>python</b>).\nType /cancel to stop."
          ),
          { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: withJoinKeyboard(undefined) }
        );
        return;
      }

      await bot.answerCallbackQuery(query.id);
    } catch (e: any) {
      await bot.answerCallbackQuery(query.id, { text: String(e?.message ?? e) });
    }
  });

  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    if (!user) return;
    const userId = user.id;
    const text = (msg.text ?? "").trim();

    const existing = pendingSearch.get(userId);
    if (existing && Date.now() > existing.expiresAt) pendingSearch.delete(userId);

    if (text === "/cancel") {
      await safeTrack({ event: "command", action: "/cancel", userId, chatId, chatType: msg.chat.type });
      if (pendingSearch.delete(userId)) {
        await bot.sendMessage(chatId, withJoinFooter("Cancelled."), {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: withJoinKeyboard(undefined)
        });
      } else {
        await bot.sendMessage(chatId, withJoinFooter("Nothing to cancel."), {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: withJoinKeyboard(undefined)
        });
      }
      return;
    }

    // Interactive search: if we asked for a keyword, use the next non-command message.
    const pending = pendingSearch.get(userId);
    if (pending && pending.chatId === chatId && !text.startsWith("/")) {
      pendingSearch.delete(userId);
      const keyword = text;

      await safeTrack({
        event: "search",
        action: "run",
        userId,
        chatId,
        chatType: msg.chat.type,
        meta: { keywordLength: keyword.length }
      });

      await bot.sendMessage(chatId, withJoinFooter(`Searching for: <b>${escapeHtml(keyword)}</b>`), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: withJoinKeyboard(undefined)
      });
      const results = await searchJobsByKeyword(keyword, 10);
      if (results.length === 0) {
        await bot.sendMessage(chatId, withJoinFooter("No matching jobs found.\n\n" + resultsHelp()), {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: resultsKeyboard()
        });
        return;
      }

      const message = withJoinFooter(
        "<b>Results</b>\n\n" + results.map(formatJob).join("\n\n") + "\n\n────────\n" + resultsHelp()
      );
      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: resultsKeyboard()
      });
      return;
    }

    if (!text.startsWith("/")) return;

    const [command, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ").trim();

    try {
      if (command === "/start" || command === "/help") {
        await safeTrack({ event: "command", action: command, userId, chatId, chatType: msg.chat.type });
        if (command === "/start") {
          await safeTrack({ event: "start", userId, chatId, chatType: msg.chat.type, meta: { payload: arg } });
        }
        if (command === "/start") {
          if (arg.toLowerCase() === "onboard") {
            await sendOnboarding(bot, chatId, user);
            return;
          }

          if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
            await sendOnboarding(bot, chatId, user);
            return;
          }
        }

        await bot.sendMessage(chatId, usage(), {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: usageKeyboard()
        });
        return;
      }

      if (command === "/onboard") {
        await safeTrack({ event: "command", action: "/onboard", userId, chatId, chatType: msg.chat.type });
        await sendOnboarding(bot, chatId, user);
        return;
      }

      if (command === "/subscriptions") {
        await safeTrack({ event: "command", action: "/subscriptions", userId, chatId, chatType: msg.chat.type });
        const keywords = await listKeywords(userId);
        const body = withJoinFooter(
          keywords.length === 0
            ? "No subscriptions yet. Use /subscribe &lt;keyword&gt;"
            : "<b>Your subscriptions</b>\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n")
        );
        await bot.sendMessage(chatId, body, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: withJoinKeyboard(undefined)
        });
        return;
      }

      if (command === "/subscribe") {
        await safeTrack({ event: "command", action: "/subscribe", userId, chatId, chatType: msg.chat.type });
        if (!arg) {
          await bot.sendMessage(chatId, withJoinFooter("Usage: /subscribe <code>keyword</code>"), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: withJoinKeyboard(undefined)
          });
          return;
        }
        const keywords = await addKeyword(userId, arg);
        await bot.sendMessage(
          chatId,
          withJoinFooter("Saved. Current subscriptions:\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n")),
          { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: withJoinKeyboard(undefined) }
        );
        return;
      }

      if (command === "/unsubscribe") {
        await safeTrack({ event: "command", action: "/unsubscribe", userId, chatId, chatType: msg.chat.type });
        if (!arg) {
          await bot.sendMessage(chatId, withJoinFooter("Usage: /unsubscribe <code>keyword</code>"), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: withJoinKeyboard(undefined)
          });
          return;
        }
        const keywords = await removeKeyword(userId, arg);
        await bot.sendMessage(
          chatId,
          withJoinFooter(
            keywords.length === 0
              ? "Removed. You have no subscriptions."
              : "Removed. Current subscriptions:\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n")
          ),
          { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: withJoinKeyboard(undefined) }
        );
        return;
      }

      if (command === "/search") {
        await safeTrack({ event: "command", action: "/search", userId, chatId, chatType: msg.chat.type });
        if (!arg) {
          pendingSearch.set(userId, { chatId, expiresAt: Date.now() + PENDING_SEARCH_TTL_MS });
          await safeTrack({ event: "search", action: "prompt", userId, chatId, chatType: msg.chat.type });
          await bot.sendMessage(
            chatId,
            withJoinFooter(
              "Send me a keyword to search (example: <b>react</b>, <b>node</b>, <b>python</b>).\nType /cancel to stop."
            ),
            { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: withJoinKeyboard(undefined) }
          );
          return;
        }

        await bot.sendMessage(chatId, withJoinFooter(`Searching for: <b>${escapeHtml(arg)}</b>`), {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: withJoinKeyboard(undefined)
        });

        await safeTrack({
          event: "search",
          action: "run",
          userId,
          chatId,
          chatType: msg.chat.type,
          meta: { keywordLength: arg.length }
        });

        const results = await searchJobsByKeyword(arg, 10);
        if (results.length === 0) {
          await bot.sendMessage(chatId, withJoinFooter("No matching jobs found.\n\n" + resultsHelp()), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: resultsKeyboard()
          });
          return;
        }

        const message = withJoinFooter(
          "<b>Results</b>\n\n" + results.map(formatJob).join("\n\n") + "\n\n────────\n" + resultsHelp()
        );
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: resultsKeyboard()
        });
        return;
      }

      if (command === "/stats") {
        await safeTrack({ event: "command", action: "/stats", userId, chatId, chatType: msg.chat.type });
        if (!config.analyticsEnabled) {
          await bot.sendMessage(chatId, withJoinFooter("Analytics is disabled."), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: withJoinKeyboard(undefined)
          });
          return;
        }

        if (!config.analyticsAdminIds.includes(userId)) {
          await bot.sendMessage(chatId, withJoinFooter("Not allowed."), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: withJoinKeyboard(undefined)
          });
          return;
        }

        const hoursRaw = arg.trim();
        const hours = hoursRaw ? Number(hoursRaw) : config.analyticsWindowHours;
        const windowHours = Number.isFinite(hours) && hours > 0 ? hours : config.analyticsWindowHours;
        const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

        const reportChatId = config.analyticsChatId || config.channelId;
        await postAnalyticsSummary(bot, reportChatId, since);
        const sameChat =
          typeof reportChatId === "number" && typeof chatId === "number"
            ? reportChatId === chatId
            : String(reportChatId) === String(chatId);
        if (!sameChat) {
          await bot.sendMessage(chatId, withJoinFooter("Posted analytics to the channel."), {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: withJoinKeyboard(undefined)
          });
        }
        return;
      }

      await bot.sendMessage(chatId, usage(), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: usageKeyboard()
      });
    } catch (e: any) {
      await bot.sendMessage(chatId, withJoinFooter(`Error: ${escapeHtml(String(e?.message ?? e))}`), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: withJoinKeyboard(undefined)
      });
    }
  });
}

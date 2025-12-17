import TelegramBot from "node-telegram-bot-api";
import { addKeyword, listKeywords, removeKeyword } from "../db/subscriptions.js";
import { searchJobs } from "../jobs/search.js";
import { sendOnboarding } from "./onboarding.js";
import { Job } from "../types/job.js";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function usage(): string {
  return (
    "<b>Commands</b>\n" +
    "/onboard\n" +
    "/search &lt;keyword&gt;\n" +
    "/subscribe &lt;keyword&gt;\n" +
    "/unsubscribe &lt;keyword&gt;\n" +
    "/subscriptions\n"
  );
}

function formatJob(job: Job): string {
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const source = escapeHtml(job.source);
  const link = job.link;
  return (
    `<b>${company}</b>\n` +
    `${title}\n` +
    `<i>${source}</i>\n` +
    `<a href="${link}">Open</a>`
  );
}

export function registerCommandHandlers(bot: TelegramBot): void {
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    if (!user) return;
    const userId = user.id;
    const text = (msg.text ?? "").trim();
    if (!text.startsWith("/")) return;

    const [command, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ").trim();

    try {
      if (command === "/start" || command === "/help") {
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

        await bot.sendMessage(chatId, usage(), { parse_mode: "HTML" });
        return;
      }

      if (command === "/onboard") {
        await sendOnboarding(bot, chatId, user);
        return;
      }

      if (command === "/subscriptions") {
        const keywords = await listKeywords(userId);
        const body =
          keywords.length === 0
            ? "No subscriptions yet. Use /subscribe &lt;keyword&gt;"
            : "<b>Your subscriptions</b>\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n");
        await bot.sendMessage(chatId, body, { parse_mode: "HTML" });
        return;
      }

      if (command === "/subscribe") {
        if (!arg) {
          await bot.sendMessage(chatId, "Usage: /subscribe <keyword>", { parse_mode: "HTML" });
          return;
        }
        const keywords = await addKeyword(userId, arg);
        await bot.sendMessage(
          chatId,
          "Saved. Current subscriptions:\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n"),
          { parse_mode: "HTML" }
        );
        return;
      }

      if (command === "/unsubscribe") {
        if (!arg) {
          await bot.sendMessage(chatId, "Usage: /unsubscribe <keyword>", { parse_mode: "HTML" });
          return;
        }
        const keywords = await removeKeyword(userId, arg);
        await bot.sendMessage(
          chatId,
          keywords.length === 0
            ? "Removed. You have no subscriptions."
            : "Removed. Current subscriptions:\n" + keywords.map(k => `- ${escapeHtml(k)}`).join("\n"),
          { parse_mode: "HTML" }
        );
        return;
      }

      if (command === "/search") {
        if (!arg) {
          await bot.sendMessage(chatId, "Usage: /search <keyword>", { parse_mode: "HTML" });
          return;
        }

        await bot.sendMessage(chatId, `Searching for: <b>${escapeHtml(arg)}</b>`, { parse_mode: "HTML" });
        const results = await searchJobs(arg);
        const top = results.slice(0, 10);

        if (top.length === 0) {
          await bot.sendMessage(chatId, "No matching jobs found.", { parse_mode: "HTML" });
          return;
        }

        const message = "<b>Results</b>\n\n" + top.map(formatJob).join("\n\n");
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          disable_web_page_preview: true
        });
        return;
      }

      await bot.sendMessage(chatId, usage(), { parse_mode: "HTML" });
    } catch (e: any) {
      await bot.sendMessage(chatId, `Error: ${escapeHtml(String(e?.message ?? e))}`, { parse_mode: "HTML" });
    }
  });
}

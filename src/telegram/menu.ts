import TelegramBot from "node-telegram-bot-api";
import { error, log } from "../utils/logger.js";

export const BOT_COMMANDS: TelegramBot.BotCommand[] = [
  { command: "start", description: "Start the bot & get job alerts" },
  { command: "onboard", description: "Interactive keyword selection" },
  { command: "search", description: "Search stored jobs (e.g. /search react)" },
  { command: "subscribe", description: "Subscribe to keyword alerts" },
  { command: "subscriptions", description: "View your active keyword alerts" },
  { command: "unsubscribe", description: "Remove a keyword alert" },
  { command: "help", description: "Show usage instructions and commands" }
];

export async function setupBotCommands(bot: TelegramBot): Promise<void> {
  try {
    await bot.setMyCommands(BOT_COMMANDS);
    log("Telegram bot command menu registered successfully");
  } catch (err) {
    error("Failed to register Telegram bot command menu:", err);
  }
}

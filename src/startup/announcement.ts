import { config } from "../config.js";
import { bot } from "../telegram/bot.js";

export async function postOnboardingAnnouncement(): Promise<void> {
  if (!config.onboardingChatId) return;

  const { username } = await bot.getMe();
  const deepLink = username ? `https://t.me/${username}?start=onboard` : "";
  const message =
    "<b>Job Alerts Bot is online</b>\n\n" +
    "Type /start in this group to choose your job keywords.\n" +
    (deepLink
      ? `For DM alerts, open the bot privately once:\n<a href="${deepLink}">Start bot</a>`
      : "For DM alerts, open the bot in private chat and press Start once.");

  await bot.sendMessage(config.onboardingChatId, message, {
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

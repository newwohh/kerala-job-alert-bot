import { Job } from "../types/job.js";
import { getAllSubscriptions } from "../db/subscriptions.js";
import { matchesAnyKeyword } from "../utils/match.js";
import { tryMarkNotified } from "../db/userNotifications.js";
import { sendJobToChat } from "../telegram/bot.js";

export async function notifySubscribers(job: Job): Promise<void> {
  const subs = await getAllSubscriptions();

  for (const sub of subs) {
    const keywords = Array.isArray(sub.keywords) ? sub.keywords : [];
    if (keywords.length === 0) continue;
    if (!matchesAnyKeyword(job, keywords)) continue;

    const ok = await tryMarkNotified(sub.chatId, job);
    if (!ok) continue;

    await sendJobToChat(sub.chatId, job);
  }
}

import TelegramBot from "node-telegram-bot-api";
import { recordMemberEvent, recordUser } from "../db/users.js";
import { error, log } from "../utils/logger.js";

export function registerMemberEventHandlers(bot: TelegramBot): void {
  // 1. Listen for Telegram ChatMemberUpdated (joins, leaves, role changes in channel/supergroup)
  bot.on("chat_member" as any, async (update: any) => {
    try {
      const chatId = update.chat?.id;
      const oldStatus = update.old_chat_member?.status;
      const newStatus = update.new_chat_member?.status;
      const user = update.new_chat_member?.user ?? update.from;
      if (!user) return;

      const isMember = (s: string) => ["member", "administrator", "creator", "restricted"].includes(s);
      const wasMember = isMember(oldStatus);
      const nowMember = isMember(newStatus);

      if (!wasMember && nowMember) {
        await recordMemberEvent({
          chatId,
          user,
          action: "joined",
          inviteLink: update.invite_link?.invite_link
        });
        log(`New member joined ${chatId}: @${user.username || user.first_name} (${user.id})`);
      } else if (wasMember && !nowMember) {
        await recordMemberEvent({
          chatId,
          user,
          action: "left"
        });
        log(`Member left ${chatId}: @${user.username || user.first_name} (${user.id})`);
      }
    } catch (err) {
      error("Error handling chat_member update:", err);
    }
  });

  // 2. Listen for service messages (supergroup new member event)
  bot.on("new_chat_members" as any, async (msg: any) => {
    try {
      const chatId = msg.chat?.id;
      const newMembers = msg.new_chat_members || [];
      for (const user of newMembers) {
        await recordMemberEvent({
          chatId,
          user,
          action: "joined"
        });
        log(`New chat member in ${chatId}: @${user.username || user.first_name} (${user.id})`);
      }
    } catch (err) {
      error("Error handling new_chat_members service message:", err);
    }
  });

  // 3. Listen for service messages (supergroup left member event)
  bot.on("left_chat_member" as any, async (msg: any) => {
    try {
      const chatId = msg.chat?.id;
      const user = msg.left_chat_member;
      if (user) {
        await recordMemberEvent({
          chatId,
          user,
          action: "left"
        });
        log(`Member left ${chatId}: @${user.username || user.first_name} (${user.id})`);
      }
    } catch (err) {
      error("Error handling left_chat_member service message:", err);
    }
  });

  // 4. Listen for user blocking / unblocking the bot in DM
  bot.on("my_chat_member" as any, async (update: any) => {
    try {
      const user = update.from;
      const newStatus = update.new_chat_member?.status;
      if (!user) return;

      if (newStatus === "kicked") {
        await recordMemberEvent({
          chatId: user.id,
          user,
          action: "blocked"
        });
        log(`User blocked bot: @${user.username || user.first_name} (${user.id})`);
      } else if (newStatus === "member") {
        await recordMemberEvent({
          chatId: user.id,
          user,
          action: "unblocked"
        });
        log(`User started/unblocked bot: @${user.username || user.first_name} (${user.id})`);
      }
    } catch (err) {
      error("Error handling my_chat_member update:", err);
    }
  });

  // 5. Track all incoming message senders
  bot.on("message", async (msg: TelegramBot.Message) => {
    if (msg.from) {
      try {
        const source = msg.chat.type === "private" ? "bot_dm" : "group_chat";
        await recordUser(msg.from, source, "active");
      } catch {
        // Safe track without interrupting message processing
      }
    }
  });
}

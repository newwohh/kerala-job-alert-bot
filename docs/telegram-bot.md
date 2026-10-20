# 🤖 Telegram Bot & Community Integration

This document covers the Telegram Bot API integration, interactive commands, community member tracking, and messaging safety invariants.

---

## 1. Bot Identity & Channels

| Entity | Handle / ID | Role |
| :--- | :--- | :--- |
| **Telegram Bot** | [@KeralaJobAlertBOT](https://t.me/KeralaJobAlertBOT) | User interaction, DM alerts, command menu, search |
| **Community Group** | [@joinkeralajobsalerts](https://t.me/joinkeralajobsalerts) | Discussion supergroup where bot is an administrator |
| **Broadcast Channel** | [@joinkeraladailyjobs](https://t.me/joinkeraladailyjobs) | Broadcast channel linked to the discussion group |

---

## 2. Bot Slash Commands

The bot registers its official command menu with Telegram via [`setupBotCommands`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/telegram/menu.ts) during startup. Users can trigger commands by typing or selecting them from the blue `[Menu]` button:

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/start` | `[payload]` | Displays welcome message, attribution source, and quick action buttons |
| `/onboard` | — | Interactive keyword onboarding interface |
| `/search` | `[keyword]` | Searches MongoDB for stored jobs matching the keyword (e.g. `/search react`) |
| `/subscribe` | `<keyword>` | Subscribes the user to DM alerts for matching jobs (e.g. `/subscribe python`) |
| `/subscriptions` | — | Displays the user's active monitored keywords |
| `/unsubscribe` | `<keyword>` | Removes a keyword from the user's alert list |
| `/cancel` | — | Cancels an ongoing interactive search prompt |
| `/help` | — | Shows the full bot usage instructions and command references |
| `/stats` | `[hours]` | *(Admin only)* Posts analytics summary to `ANALYTICS_CHAT_ID` |

---

## 3. Real-Time Member & Community Tracking

Configured in [`src/telegram/events.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/telegram/events.ts):

### A. Channel / Supergroup Joins & Leaves (`chat_member`)
Because `@KeralaJobAlertBOT` is an administrator in `@joinkeralajobsalerts`, it listens for `chat_member` updates:
* **Join Event (`left` ➔ `member`)**:
  - Captures `user.id`, `@username`, `first_name`, and timestamp.
  - Captures `invite_link` if the user joined via a custom campaign link.
  - Logs event to the `member_events` collection and updates `telegram_users`.
* **Leave Event (`member` ➔ `left`)**:
  - Logs departure event to calculate net community growth and churn.

### B. Bot Churn & Retention (`my_chat_member`)
Fired when a user interacts with the bot in a private chat:
* User blocks the bot (`status: "kicked"`): Status updated to `blocked` in `telegram_users`.
* User unblocks the bot (`status: "member"`): Status updated to `active`.

### C. Polling Configuration
To receive these events, [`src/telegram/bot.ts`](file:///Users/nevin/code/personal/kerala-job-alert-bot/src/telegram/bot.ts) explicitly requests:
```ts
allowed_updates: [
  "message",
  "edited_message",
  "channel_post",
  "callback_query",
  "chat_member",
  "my_chat_member",
  "chat_join_request"
]
```

---

## 4. Message Formatting & Safety Rules

All outgoing Telegram messages use `parse_mode: "HTML"`:

```ts
import { escapeHtml, escapeHtmlAttr } from "./ui.js";

const safeTitle = escapeHtml(job.title);
const safeLink = escapeHtmlAttr(job.link);

await bot.sendMessage(chatId, `<b>${safeTitle}</b>\n<a href="${safeLink}">Apply</a>`, {
  parse_mode: "HTML",
  disable_web_page_preview: true
});
```

### Critical Invariants:
1. **Always Escape Dynamic Content**: All user-provided search terms, job titles, company names, and error messages must pass through `escapeHtml()`.
2. **Attribute Escaping**: Any URL embedded inside `<a href="...">` must pass through `escapeHtmlAttr()`.
3. **Disable Web Previews**: `disable_web_page_preview: true` must be specified on job search results and alerts to avoid cluttering chats with link previews.

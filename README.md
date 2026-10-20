# Job Alert Telegram Bot

A Telegram bot that:

- Scrapes job postings from multiple sources (Infopark, Technopark)
- Posts new jobs to a Telegram channel/supergroup
- Lets users subscribe to keyword alerts (via DM) and search stored jobs
- Serves a real-time **Live Analytics & Community Dashboard**

> 📖 **Comprehensive Documentation**: Complete guides are available in the **[`docs/`](docs/README.md)** folder:
> - [Architecture & Concurrency](docs/architecture.md)
> - [Setup & Local Development](docs/setup-guide.md)
> - [Live Analytics Dashboard](docs/dashboard.md)
> - [Telegram Bot & Community Tracking](docs/telegram-bot.md)
> - [Scrapers Pipeline](docs/scrapers.md)
> - [Database Schema & Invariants](docs/database.md)
> - [DigitalOcean Deployment Guide](docs/deployment.md)

## Features

- **Multi-source scraping** (see `src/scrapers/`)
- **Live Analytics Dashboard** on `/dashboard` and `/api/stats`
- **Real-time Member Tracking** (`chat_member`, `my_chat_member`)
- **Telegram Autocomplete Command Menu** (`setMyCommands`)
- **Deduplication** using the job `link` as the stable identifier (MongoDB unique index)
- **Keyword subscriptions** (case-insensitive substring match)
- **Search** stored jobs via DM
- **Optional onboarding announcement** to a group/channel on startup

## Tech stack

- Node.js + TypeScript (ESM)
- MongoDB
- Telegram Bot API (`node-telegram-bot-api`)
- `node-cron` for scheduling

## Commands

Users can interact with the bot using:

- `/start` — Help / onboarding entry
- `/help` — Help
- `/onboard` — Interactive keyword onboarding
- `/subscribe <keyword>` — Add a keyword
- `/unsubscribe <keyword>` — Remove a keyword
- `/subscriptions` — List your keywords
- `/search <keyword>` — Search stored jobs
- `/cancel` — Cancel interactive search

If analytics is enabled and your user is an admin (`ANALYTICS_ADMIN_IDS`):

- `/stats [hours]` — Post analytics summary to `ANALYTICS_CHAT_ID` (or `CHANNEL_ID`)

## Configuration

Copy `.env.example` to `.env` and fill values.

### Required environment variables

- `BOT_TOKEN` — Telegram bot token from @BotFather
- `CHANNEL_ID` — Where jobs are posted (e.g. `@your_channel` or numeric chat id)
- `MONGODB_URI` — Mongo connection string

### Common optional environment variables

- `MONGODB_DB` — Default: `job_alerts`
- `CRON_ENABLED` — Default: `true`
- `CRON_SCHEDULE` — Default: `*/20 * * * *`
- `RUN_JOBS_ON_STARTUP` — Default: `false`
- `MAX_PAGES` — Default: `3`
- `REQUEST_TIMEOUT_MS` — Default: `15000`
- `ONBOARDING_CHAT_ID` — If set, posts a "bot online" message on startup

### Post footer / promotion

- `GROUP_TITLE` — Text for group button/title
- `GROUP_URL` — If set, adds a "Join group" footer/button
- `PROMO_TEXT`, `PROMO_URL`, `PROMO_BUTTON_TEXT` — Optional promotion section in posts

### Analytics

- `ANALYTICS_ENABLED` — Default: `false`
- `ANALYTICS_CHAT_ID` — Where analytics summary is posted (defaults to `CHANNEL_ID`)
- `ANALYTICS_CRON` — Default: `0 9 * * *`
- `ANALYTICS_WINDOW_HOURS` — Default: `24`
- `ANALYTICS_ADMIN_IDS` — Comma-separated Telegram user IDs

## Running locally

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Running with Docker

This repo includes a `Dockerfile` and a `docker-compose.yml` for local usage.

```bash
docker compose up --build
```

## Deployment

### DigitalOcean App Platform (Recommended)

This bot is configured to deploy directly to **DigitalOcean App Platform** using Docker:

1. **Source**: Connect your GitHub repository and select the `master` branch (with auto-deploy enabled).
2. **Component Type**: Service (or Worker).
3. **HTTP Port**: Set `http_port` to `8080`. The app starts a built-in health server on `PORT` that responds `200 ok` on `/` and `/healthz`.
4. **Environment Variables**:
   * `BOT_TOKEN`: Telegram bot token from @BotFather (set as Encrypted / Secret)
   * `CHANNEL_ID`: Channel or group username (e.g. `@joinkeralajobsalerts`)
   * `MONGODB_URI`: MongoDB connection string (set as Encrypted / Secret)
   * `PORT`: `8080`
   * `RUN_JOBS_ON_STARTUP`: `true` (scrapes immediately upon container boot)
   * `MONGODB_DB`: `job_alerts`
   * `CRON_SCHEDULE`: `*/20 * * * *` (default: every 20 minutes)

#### Managing via DigitalOcean MCP Server
You can inspect deployments, stream logs, and update environment variables directly from AI agents via the `@digitalocean/mcp` server configured in `~/.gemini/config/mcp_config.json`.

### Render.com

This bot uses **long polling** (not webhooks). On Render, the best option is:

#### Recommended: Background Worker
- Create a **Background Worker** service
- Start command: `npm start`
- Set the required environment variables (`BOT_TOKEN`, `CHANNEL_ID`, `MONGODB_URI`, etc.)

#### Alternative: Web Service
If you deploy as a Web Service, Render expects your process to listen on `PORT`. The health server responds on `GET /` and `GET /healthz`.

### Rate Limiting & Reliability
- **Telegram Flood Protection**: Outgoing channel alerts are throttled with a 1.5-second delay between messages.
- **429 Backoff**: If Telegram responds with `429 Too Many Requests`, the runner waits for the specified `retry_after` duration and retries automatically.
- **Failed Post Rollback**: If sending fails permanently, the job is removed from MongoDB so it can be re-scraped and delivered on the next cycle.


## Troubleshooting

### Bot “stops” after some time

Common causes:

- **Unhandled async errors** in scheduled jobs.
  - The code wraps cron tasks with `.catch(...)` to avoid unhandled promise rejections.
- **Telegram polling conflict (`409 Conflict`)** during deploys/restarts.
  - The bot will retry polling with backoff.
  - If you continuously see 409s, ensure only **one** running instance uses the same `BOT_TOKEN`.

### Nothing posts to the channel

- Confirm the bot is an admin in the channel (permission to post)
- Confirm `CHANNEL_ID` is correct
- Check logs for scraper errors and Mongo connection errors

## Project structure

- `src/index.ts` — Entry point (Mongo connect, handlers, polling, cron scheduling)
- `src/telegram/` — Bot instance + commands + onboarding UI
- `src/scrapers/` — Scrapers returning normalized jobs
- `src/jobs/` — Runner + subscriber notifications
- `src/db/` — Mongo collections and indexes

## Contributing

PRs are welcome. Please keep HTML escaping for any dynamic Telegram content (`parse_mode: "HTML"`).

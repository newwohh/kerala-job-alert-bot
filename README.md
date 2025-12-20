# Job Alert Telegram Bot

A Telegram bot that:

- Scrapes job postings from multiple sources
- Posts new jobs to a Telegram channel
- Lets users subscribe to keyword alerts (via DM) and search stored jobs

## Features

- **Multi-source scraping** (see `src/scrapers/`)
- **Deduplication** using the job `link` as the stable identifier (MongoDB unique index)
- **Keyword subscriptions** (case-insensitive substring match)
- **Search** stored jobs via DM
- **Optional onboarding announcement** to a group/channel on startup
- **Optional analytics** (commands/clicks/events summary)

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

### Source toggles

- `INFOSYS_ENABLED` — Default: `false`
- `INFOSYS_KEYWORD` — Optional keyword filter for Infosys scraper

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

## Deployment (Render.com)

This bot uses **long polling** (not webhooks). On Render, the best option is:

### Recommended: Background Worker

- Create a **Background Worker** service
- Start command: `npm start` (or the Dockerfile default if deploying from Docker)
- Set the required environment variables (`BOT_TOKEN`, `CHANNEL_ID`, `MONGODB_URI`, etc.)

### Alternative: Web Service

If you deploy as a Web Service, Render expects your process to listen on `PORT`.

This app starts a small HTTP server automatically **when `PORT` is set**:

- `GET /` → `ok`
- `GET /healthz` → `ok`

So Web Service can work, but Background Worker is still preferred for polling bots.

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

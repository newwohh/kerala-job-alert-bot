# Job Alert Telegram Bot - Project Notes

## What this repo is
- A Telegram bot that scrapes job postings from multiple sources and posts them to a Telegram channel.
- Users can subscribe to keyword-based alerts and search stored jobs via DM.

## Runtime & build
- TypeScript + Node ESM (package.json has "type": "module").
- Development: npm run dev (node --loader ts-node/esm src/index.ts)
- Production: npm run build (tsc) then npm start (node dist/index.js)

## Entry points & core flow
- src/index.ts
  - connectMongo() must run before any DB usage
  - registers Telegram handlers (commands + onboarding)
  - optionally posts an onboarding announcement to ONBOARDING_CHAT_ID
  - optionally runs one scraping cycle on startup
  - schedules recurring scraping via node-cron

## Data model & invariants
- Job type (src/types/job.ts):
  - title: string
  - company: string
  - source: string
  - link: string
- link is the primary stable identifier:
  - used for deduping in jobs collection
  - used for per-user notification dedupe (chatId + link)
- Subscriptions:
  - keywords are normalized to lowercase before storing
  - matching is case-insensitive substring match across title/company/source

## Telegram formatting & safety
- All outgoing messages use parse_mode: "HTML".
- Always HTML-escape any dynamic content (job fields, user-provided keywords, errors).
- Any URL embedded in an HTML attribute must be attribute-escaped.

## Rate limiting & posting resilience
- Telegram rate limits message bursts to channels/groups (~20-30 msgs/min, 1 msg/sec).
- `src/jobs/runner.ts` enforces a 1500ms sleep between consecutive job posts.
- If Telegram returns HTTP 429 Too Many Requests, runner extracts `retry_after`, sleeps, and retries.
- If a post ultimately fails, `removeJob(job.link)` rolls back the MongoDB insert so the job can be re-attempted on the next scrape cycle instead of being permanently dropped.

## Deployment & Hosting (DigitalOcean App Platform)
- Production branch is `master` (DO App Platform deploys on push to `master`).
- Container runtime: multi-stage build via `Dockerfile` (Node 22 Alpine).
- Web service & Live Analytics Dashboard:
  - DO App Platform routes HTTP traffic to `PORT` (default `8080`).
  - `startHealthServer()` in `src/utils/health-server.ts` listens on `PORT`.
  - Serves modern Live Analytics Dashboard on `/` and `/dashboard`.
  - Serves raw JSON analytics on `/api/stats` and `/api/dashboard`.
  - Responds `200 ok` to `/healthz` (and text/plain requests to `/`).
  - Without `PORT` responding `200`, App Platform readiness probes fail (`DeployContainerExitNonZero`).
- Rolling deploys & Telegram 409 conflicts:
  - During rolling deploys, old and new containers briefly overlap.
  - The new container will catch a temporary `409 Conflict: terminated by other getUpdates request`.
  - `src/telegram/bot.ts` handles 409 errors with backoff and automatic polling restart once the old container exits.
- App Platform Environment Variables:
  - Required: `BOT_TOKEN` (secret), `CHANNEL_ID`, `MONGODB_URI` (secret).
  - Recommended: `PORT=8080`, `RUN_JOBS_ON_STARTUP=true`, `MONGODB_DB=job_alerts`, `CRON_SCHEDULE=*/20 * * * *`.

## MCP (Model Context Protocol) Integration
- DigitalOcean MCP Server (`@digitalocean/mcp`) is configured in `~/.gemini/config/mcp_config.json`:
  ```json
  {
    "mcpServers": {
      "digitalocean": {
        "command": "npx",
        "args": ["-y", "@digitalocean/mcp"],
        "env": {
          "DIGITALOCEAN_API_TOKEN": "<DO_PERSONAL_ACCESS_TOKEN>"
        }
      }
    }
  }
  ```
- Exposes tools to inspect apps (`apps-get-info`), monitor deployments (`apps-get-deployment-status`), stream runtime logs (`apps-get-logs`), and update specs (`apps-update`).

## MongoDB conventions
- connectMongo() creates/ensures indexes on startup.
- Collections and invariants:
  - jobs: unique index on link
  - subscriptions: unique index on chatId
  - user_notifications: unique index on (chatId, link)
- Duplicate key errors (MongoServerError code 11000) are used for idempotency.

## Adding features checklist

### New env var
- Add it to src/config.ts (prefer required/booleanFromEnv/numberFromEnv helpers).
- Add it to .env.example.
- Avoid reading process.env directly outside src/config.ts.

### New scraper
- Add a module under src/scrapers/ that returns Promise<Job[]>.
- Use retry() + axios timeout from config.requestTimeoutMs.
- Respect config.maxPages and break early when the source provides last_page.
- Emit normalized Job objects (title/company/source/link).
- Register the scraper in src/jobs/runner.ts sources list (and guard with config if optional).

### New Telegram command or flow
- Add command parsing/behavior in src/telegram/commands.ts.
- Keep interactive onboarding in src/telegram/onboarding.ts.
- Escape all dynamic content; default disable_web_page_preview: true.


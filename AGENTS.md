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

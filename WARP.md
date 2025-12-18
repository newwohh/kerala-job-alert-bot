# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
This is a Telegram bot that scrapes job postings from multiple sources (Infopark, Technopark, and optionally Infosys) and posts them to a Telegram channel. Users can subscribe to keyword-based alerts and search the job database via DMs.

## Development Commands

### Setup
```pwsh
npm install
```

Copy `.env.example` to `.env` and configure required environment variables:
- `BOT_TOKEN`: Telegram bot token from @BotFather
- `CHANNEL_ID`: Target channel (e.g., @your_channel)
- `MONGODB_URI`: MongoDB connection string

### Running the Bot
```pwsh
# Development mode with hot reload
npm run dev

# Production build and run
npm run build
npm start
```

### MongoDB
The application requires MongoDB to be running. It creates these collections:
- `jobs`: Stores scraped job postings (unique index on `link`)
- `subscriptions`: User keyword subscriptions (unique index on `chatId`)
- `userNotifications`: Tracks which jobs were sent to which users

## Architecture

### Core Flow
1. **Job Runner** (`src/jobs/runner.ts`): Orchestrates the scraping cycle
   - Iterates through enabled scrapers (Infopark, Technopark, Infosys)
   - Fetches jobs and deduplicates using MongoDB
   - Posts new jobs to the main channel
   - Notifies subscribed users whose keywords match

2. **Scrapers** (`src/scrapers/`): Extract job listings from external sources
   - Each scraper returns an array of `Job` objects with normalized structure
   - Use Cheerio for HTML parsing (Infopark, Technopark)
   - Infosys scraper handles session-based authentication
   - All scrapers use the retry utility for resilience

3. **Telegram Bot** (`src/telegram/`):
   - `bot.ts`: Message formatting and posting logic with HTML escaping
   - `commands.ts`: Handles user commands (/subscribe, /search, /subscriptions, etc.)
   - `onboarding.ts`: Interactive keyword selection flow for new users

4. **Database Layer** (`src/db/`):
   - `mongo.ts`: Connection management and index creation
   - `jobs.ts`: Job storage with duplicate detection
   - `subscriptions.ts`: User keyword management (normalized to lowercase)
   - `userNotifications.ts`: Prevents duplicate notifications per user
   - `jobsSearch.ts`: Full-text search on stored jobs

5. **Notification System** (`src/jobs/notify.ts`):
   - Checks all subscriptions against new job postings
   - Uses keyword matching (case-insensitive substring search on title/company/source)
   - Tracks sent notifications per user to avoid duplicates

### Key Design Patterns
- **Keyword Matching**: All keywords are normalized to lowercase; matching is substring-based across job title, company, and source
- **Deduplication**: Jobs are deduplicated by `link` field (unique index); user notifications tracked separately
- **Error Handling**: Scrapers fail independently; notification failures trigger unmark to allow retry
- **ESM Modules**: Project uses ES modules (`type: "module"` in package.json); all imports need `.js` extension

### Configuration
All configuration is environment-based via `src/config.ts`:
- Scraper behavior: `MAX_PAGES`, `REQUEST_TIMEOUT_MS`, `INFOSYS_ENABLED`
- Scheduling: `CRON_SCHEDULE`, `CRON_ENABLED`, `RUN_JOBS_ON_STARTUP`
- Bot features: Optional group promotion and custom promo text in job posts
- Uses helper functions for type-safe env parsing (required, boolean, number)

### HTML Escaping
All user-facing text must be HTML-escaped before sending to Telegram:
- `escapeHtml()` for message content
- `escapeHtmlAttr()` for HTML attributes (URLs in anchor tags)
- Both functions handle &, <, >, ", ' characters

### Testing & Development Notes
- No test framework is currently configured
- Use `npm run dev` for development with ts-node loader
- Bot uses polling mode (`polling: true`) for development simplicity
- Check bot logs for scraping results and posted job counts

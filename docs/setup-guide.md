# 🛠️ Setup & Local Development Guide

This guide walks you through setting up and running the **Kerala Job Alert Bot** locally and with Docker.

---

## 1. Prerequisites

Before running the application, make sure you have:
* **Node.js**: v20 or higher (v22 recommended).
* **MongoDB**: A running local instance (`mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster.
* **Telegram Bot Token**: Created via [@BotFather](https://t.me/BotFather) on Telegram.
* **Telegram Channel / Supergroup**:
  * Create a public or private channel/supergroup (e.g. `@my_kerala_jobs`).
  * Add your bot as an **Administrator** with permission to post messages and invite users.

---

## 2. Environment Variables Configuration

Copy the example file to create your `.env`:
```bash
cp .env.example .env
```

### Reference Table

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `BOT_TOKEN` | **Yes** | — | Telegram Bot API token from `@BotFather` |
| `CHANNEL_ID` | **Yes** | — | Channel or group username (e.g. `@joinkeralajobsalerts`) or numeric ID (e.g. `-1001234567890`) |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string (e.g. `mongodb://localhost:27017` or Atlas URI) |
| `MONGODB_DB` | No | `job_alerts` | MongoDB database name |
| `PORT` | No | `0` | Health check & web dashboard port. Set to `8080` to enable the Web Dashboard |
| `CRON_SCHEDULE` | No | `*/20 * * * *` | Cron expression for recurring job scraping |
| `CRON_ENABLED` | No | `true` | Set to `false` to disable recurring scraping jobs |
| `RUN_JOBS_ON_STARTUP` | No | `false` | If `true`, runs one scraping cycle immediately on application boot |
| `MAX_PAGES` | No | `3` | Maximum number of pages to scrape per source per cycle |
| `REQUEST_TIMEOUT_MS` | No | `15000` | HTTP request timeout in milliseconds for scrapers |
| `ONBOARDING_CHAT_ID` | No | `""` | Optional chat ID to post an onboarding announcement on startup |
| `GROUP_TITLE` | No | `"Join our community"` | Button text for the community link attached to job alerts |
| `GROUP_URL` | No | `""` | URL to your Telegram discussion group / community |
| `PROMO_TEXT` | No | `""` | Optional text snippet appended to job posts |
| `PROMO_URL` | No | `""` | Optional promotional URL link |
| `PROMO_BUTTON_TEXT` | No | `"Learn more"` | Label for the optional promo button |
| `ANALYTICS_ENABLED` | No | `false` | Enable or disable recording analytics events to MongoDB |
| `ANALYTICS_CHAT_ID` | No | `""` | Telegram chat ID where `/stats` reports are sent (defaults to `CHANNEL_ID`) |
| `ANALYTICS_ADMIN_IDS`| No | `""` | Comma-separated list of Telegram user IDs allowed to run `/stats` |
| `DASHBOARD_ENABLED` | No | `true` | Toggles the web analytics dashboard (requires `PORT > 0`) |

---

## 3. Running Locally

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run in Development Mode
Starts the bot with `ts-node` and ESM loader:
```bash
PORT=8080 npm run dev
```

### Step 3: Compile and Run in Production Mode
```bash
npm run build
PORT=8080 npm start
```

Once running, you can access:
- **Web Dashboard**: `http://localhost:8080/dashboard`
- **JSON Telemetry API**: `http://localhost:8080/api/stats`
- **Readiness Health Check**: `http://localhost:8080/healthz`

---

## 4. Running with Docker

### Using Docker Compose
The repository includes a ready-to-use [`docker-compose.yml`](file:///Users/nevin/code/personal/kerala-job-alert-bot/docker-compose.yml):

```bash
docker compose up --build
```
This spins up:
1. A local **MongoDB container** on port `27017`.
2. The **Kerala Job Alert Bot** container mapped to port `8080`.

### Building the Docker Image Manually
```bash
# Build multi-stage image
docker build -t kerala-job-alert-bot .

# Run container
docker run -p 8080:8080 --env-file .env kerala-job-alert-bot
```

---

## 5. Verification Checklist

To confirm everything is operating properly:
1. **Health Check**: Run `curl http://localhost:8080/healthz` ➔ Should respond `ok` with status `200`.
2. **Dashboard UI**: Visit `http://localhost:8080` in your web browser ➔ Verify KPI cards and charts load.
3. **Telegram Commands**: Open your bot in Telegram and send `/start` ➔ Should receive interactive onboarding buttons.
4. **Command Autocomplete**: Tap the `[Menu]` button in Telegram ➔ Should show all registered bot commands.

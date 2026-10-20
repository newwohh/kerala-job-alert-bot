# 📚 Kerala Job Alert Bot — Documentation

Welcome to the comprehensive documentation for the **Kerala Job Alert Bot**. This system scrapes job postings across Kerala's major IT parks, broadcasts alerts to Telegram, manages user keyword subscriptions, tracks community growth, and provides a real-time web analytics dashboard.

---

## 🧭 Documentation Map

| Document | Description |
| :--- | :--- |
| **[Architecture & Overview](architecture.md)** | System design, concurrency model (Web + Cron + Bot in a single process), data flow, and rate limits |
| **[Setup & Local Development](setup-guide.md)** | Prerequisites, environment variables, local execution, Docker instructions, and troubleshooting |
| **[Analytics Dashboard](dashboard.md)** | Real-time web dashboard, Chart.js visualizations, REST API endpoints, and system telemetry |
| **[Telegram Bot & Community](telegram-bot.md)** | Interactive commands, command menu (`[Menu]`), onboarding, member join/leave tracking, and DM alerts |
| **[Scrapers & Job Pipeline](scrapers.md)** | Infopark & Technopark scrapers, Cheerio HTML parsing, pagination, and adding new scraper sources |
| **[Database Schema & Invariants](database.md)** | MongoDB collections, indexes, unique constraints, and deduplication logic |
| **[Deployment Guide](deployment.md)** | DigitalOcean App Platform production setup, Docker multi-stage build, health probes, and rolling deploys |

---

## ⚡ Quick Architecture Overview

```
                      ┌──────────────────────┐
                      │ Kerala IT Web Portals│
                      │ Infopark, Technopark │
                      └──────────┬───────────┘
                                 │ Scrape (HTML / API)
                                 ▼
                     ┌───────────────────────┐
                     │ Scraper Runner (Cron) │
                     └──────────┬────────────┘
                                │ Dedup by Link
                                ▼
                     ┌───────────────────────┐
                     │   MongoDB Database    │
                     │  jobs, users, events  │
                     └──────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Telegram Channel │  │ Telegram Bot DMs │  │ Live Web Dash UI │
│ Broadcast Posts  │  │ Personal Alerts  │  │ Real-Time Stats  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 🚀 Key Architectural Principles
1. **Single-Process Concurrency**: The web dashboard, cron scraper, and Telegram bot event loop run concurrently in a single lightweight Node.js container (`PORT=8080`).
2. **Stable Identifiers**: Job URLs (`link`) serve as the primary unique key across the scraping and notification pipelines.
3. **Graceful Failures & Rollbacks**: If Telegram rate limits or rejects a broadcast, MongoDB inserts roll back automatically so jobs are re-attempted on the next cycle.
4. **Zero-Overhead Dashboard**: The web UI is self-contained with Tailwind CSS and Chart.js served directly by the Node HTTP server without extra frontend build dependencies.

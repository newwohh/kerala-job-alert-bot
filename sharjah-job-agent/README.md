# Sharjah Job Agent (starter MVP)

Node.js + Prisma + SerpAPI + OpenAI (optional) + Telegram approval + Google Apps Script/Gmail sender.

This starter searches Google Jobs through SerpAPI for Sharjah vacancies, tailors a resume from `data/profile.json`, creates a PDF, and sends a Telegram approval preview. If a job listing description contains an email address, the preview includes an **Approve & Send** button. If no recipient is found, it sends a review-only message; it never guesses an email address. Approval sends the exact approved email subject/body and generated PDF through Google Apps Script/Gmail.

## Important limitations

- Search provider: this starter currently uses SerpAPI's Google Jobs engine. It does **not** scrape LinkedIn, Glassdoor, or Naukri Gulf directly. Search results can include application links hosted by those sites; use their own permitted application flows and terms.
- Many job listings do not publish a recruiter email. Those need manual application via the job link; no send button is shown.
- Resume facts in `data/profile.json` were transcribed from the supplied resume. Check the overlapping Tathkarah bullets and differing test/defect/release totals before sending any tailored resume.
- The first run defaults to `DRY_RUN=true`. Approval will be recorded as a dry run and **will not send email** until you intentionally set `DRY_RUN=false`.
- The app has not been connected to your accounts or tested against your real API credentials. You must configure secrets and test it yourself before use.
- Do not expose this Node service to the public internet without adding HTTPS, rate limiting, stronger admin authentication, and deployment hardening. Generated resumes stay on the server disk; protect and delete them when no longer needed.

## Requirements

- Node.js 20+
- A SerpAPI key: https://serpapi.com/
- A Telegram bot created with `@BotFather`
- A Google account for Apps Script/Gmail
- Optional OpenAI API key for AI-based tailoring. Without it, conservative keyword-based fallback tailoring is used.

## 1. Install

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
```

Edit `.env`. Set `ADMIN_API_KEY` and `APPS_SCRIPT_SECRET` to different long random secrets. Never commit `.env`.

## 2. Configure Telegram

1. In Telegram, message `@BotFather`, create a bot with `/newbot`, and copy its token to `TELEGRAM_BOT_TOKEN`.
2. Start a private chat with your new bot and send `/start`.
3. Obtain your chat ID. One simple method after sending `/start` is to open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and read `message.chat.id`. Keep the token private; do not share that URL or response.
4. Put the chat ID into `TELEGRAM_CHAT_ID`.

The bot uses long polling, so you do not need a public webhook URL. Do not configure another `getUpdates` consumer for the same bot at the same time.

## 3. Configure Google Apps Script sender

1. Open https://script.google.com/ and create a new project.
2. Replace the default code with `apps-script/Code.gs`.
3. Open **Project Settings → Script Properties** and add `APPS_SCRIPT_SECRET` with exactly the same value as `.env`.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me**. For access, select the least restrictive option that allows your Node server to call it; the simple starter expects an unauthenticated HTTP request protected by the long random shared secret. Treat the deployed URL as sensitive.
5. Authorize Gmail access when prompted and copy the Web App URL into `APPS_SCRIPT_URL` in `.env`.
6. Test using `DRY_RUN=true` first. Apps Script only sends when Node sends it an approved application request and `DRY_RUN=false` is set in Node.

The Apps Script uses a script lock and a script property keyed by application ID to reduce duplicate sends. No system can fully resolve every network-timeout ambiguity, so inspect Gmail Sent and the Apps Script execution log before manually retrying a failed send.

## 4. Start the app

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Run a job search and send Telegram previews:

```bash
curl -X POST http://localhost:3000/jobs/search \
  -H 'x-admin-key: YOUR_ADMIN_API_KEY'
```

View recent jobs/applications:

```bash
curl http://localhost:3000/jobs -H 'x-admin-key: YOUR_ADMIN_API_KEY'
curl http://localhost:3000/applications -H 'x-admin-key: YOUR_ADMIN_API_KEY'
```

## 5. Before enabling real sending

1. Verify every fact in `data/profile.json` against the original resume.
2. Verify that each recipient is actually the employer/recruiter's intended application address. The starter only extracts email-like strings from the job description; the Telegram approval is the human validation step.
3. Approve one test application while `DRY_RUN=true` and check the status is `APPROVED_DRY_RUN`.
4. Only after you understand the flow, set `DRY_RUN=false` and test with a recipient you control. Then restore dry-run until ready.
5. Never automate CAPTCHA solving, bypass access controls, or submit through a job platform where automation is prohibited.

## Environment variables

See `.env.example`. `OPENAI_API_KEY` is optional; AI output is constrained to the source profile, but human review is still required. `SERPAPI_KEY`, Telegram variables, and Apps Script variables are needed for the end-to-end workflow.

## Project layout

```text
src/
  index.js       Express API, orchestration, Telegram approvals and sender handoff
  search.js      SerpAPI Google Jobs search and conservative email extraction
  resume.js      Resume tailoring and PDF generation
  profile.js     Loads verified profile JSON
  telegram.js    Telegram Bot API notifications and buttons
apps-script/
  Code.gs        Secure shared-secret Gmail sender endpoint
prisma/
  schema.prisma  SQLite schema for jobs and applications
data/
  profile.json   Applicant profile transcribed from the provided resume
output/          Generated PDFs (keep private)
```

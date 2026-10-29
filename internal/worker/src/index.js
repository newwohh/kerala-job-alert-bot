import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { profile } from './profile.js';
import { processNextJob } from './processor.js';
import { sendApplicationPreview, telegramCall, getAllowedChats, addSubscriber } from './telegram.js';

const prisma = new PrismaClient();
const app = express();
app.use(express.json({ limit: '2mb' }));
const port = Number(process.env.PORT || 3000);

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || req.header('x-admin-key') !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, status: 'healthy', worker: 'active' }));

app.post('/jobs/search', requireAdmin, async (req, res) => {
  try {
    const maxJobs = req.body?.maxJobs ? Number(req.body.maxJobs) : undefined;
    const result = await processNextJob({ maxJobs });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/jobs', requireAdmin, async (_req, res) => {
  const jobs = await prisma.job.findMany({ orderBy: { discoveredAt: 'desc' }, take: 100, include: { applications: true } });
  res.json(jobs);
});
app.get('/applications', requireAdmin, async (_req, res) => {
  const rows = await prisma.application.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { job: true } });
  res.json(rows);
});

async function sendViaAppsScript(application, job) {
  if (!process.env.APPS_SCRIPT_URL || !process.env.APPS_SCRIPT_SECRET) throw new Error('APPS_SCRIPT_URL / APPS_SCRIPT_SECRET is not configured');
  if (!application.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.recipientEmail)) throw new Error('No valid recipient email is stored');
  const resumeBytes = await fs.readFile(application.resumeFile);
  const payload = {
    secret: process.env.APPS_SCRIPT_SECRET,
    applicationId: application.id,
    to: application.recipientEmail,
    subject: application.emailSubject,
    body: application.emailBody,
    filename: path.basename(application.resumeFile),
    resumeBase64: resumeBytes.toString('base64'),
    jobTitle: job.title,
    company: job.company
  };
  const response = await fetch(process.env.APPS_SCRIPT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Apps Script returned non-JSON response: ${text.slice(0, 250)}`); }
  if (!response.ok || !data.ok) throw new Error(data.error || `Apps Script request failed (${response.status})`);
  return data;
}

async function safeAnswerCallback(queryId, text, showAlert = false) {
  try {
    await telegramCall('answerCallbackQuery', {
      callback_query_id: queryId,
      text,
      show_alert: showAlert
    });
  } catch (e) {
    console.warn('Callback answer note:', e.message);
  }
}

async function handleCallback(update) {
  const query = update.callback_query;
  if (!query) return;
  const fromChat = String(query.message?.chat?.id ?? '');
  if (fromChat) addSubscriber(fromChat);

  const [action, id] = String(query.data || '').split(':');

  if (action === 'done') {
    await safeAnswerCallback(query.id, 'ℹ️ This application has already been processed.', true);
    return;
  }

  const application = await prisma.application.findUnique({ where: { id }, include: { job: true } });
  if (!application) {
    await safeAnswerCallback(query.id, 'Application not found.', true);
    return;
  }

  if (application.status !== 'PENDING_APPROVAL') {
    await safeAnswerCallback(query.id, `Already processed: ${application.status}`, true);
    return;
  }

  const jobUrl = application.job?.jobUrl;

  if (action === 'reject') {
    await prisma.application.update({ where: { id }, data: { status: 'REJECTED' } });
    await safeAnswerCallback(query.id, '❌ Application rejected and dismissed.', true);

    const buttons = [];
    if (jobUrl) buttons.push([{ text: '🔗 View Job Posting', url: jobUrl }]);
    buttons.push([{ text: '🗑 Rejected', callback_data: `done:${application.id}` }]);

    await telegramCall('editMessageReplyMarkup', {
      chat_id: fromChat,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (action !== 'approve') return;

  await safeAnswerCallback(query.id, 'Approval received. Dispatching email…');
  const claimed = await prisma.application.updateMany({ where: { id, status: 'PENDING_APPROVAL' }, data: { status: 'SENDING', approvedAt: new Date() } });
  if (claimed.count !== 1) return;

  let notice;
  let statusBadge;

  try {
    if (String(process.env.DRY_RUN).toLowerCase() !== 'false') {
      await prisma.application.update({ where: { id }, data: { status: 'APPROVED_DRY_RUN' } });
      notice = `🧪 DRY RUN: Approved “${application.job.title}”. Set DRY_RUN=false in .env to send real emails.`;
      statusBadge = '🧪 Approved (Dry Run)';
    } else {
      const result = await sendViaAppsScript(application, application.job);
      await prisma.application.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), sendError: null } });
      notice = `✅ Email sent successfully for “${application.job.title}” at ${application.job.company}! Apps Script status: ${result.status || 'sent'}.`;
      statusBadge = '✅ Sent via Gmail';
    }
  } catch (e) {
    await prisma.application.update({ where: { id }, data: { status: 'SEND_FAILED', sendError: e.message } });
    await telegramCall('sendMessage', { chat_id: allowedChat, text: `⚠️ Send failed for “${application.job.title}”: ${e.message}. Check your Apps Script deployment.` });
    
    const errButtons = [];
    if (jobUrl) errButtons.push([{ text: '🔗 View Job Posting', url: jobUrl }]);
    errButtons.push([{ text: '⚠️ Send Failed (Tap to Retry)', callback_data: `approve:${application.id}` }]);
    
    await telegramCall('editMessageReplyMarkup', {
      chat_id: fromChat,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: errButtons }
    });
    return;
  }

  // Show a popup alert in Telegram to confirm action
  await safeAnswerCallback(query.id, statusBadge, true);

  // Post confirmation message
  await telegramCall('sendMessage', { chat_id: allowedChat, text: notice });

  // Update the button on the original message to show the completed status
  const finalButtons = [];
  if (jobUrl) finalButtons.push([{ text: '🔗 View Job Posting', url: jobUrl }]);
  finalButtons.push([{ text: statusBadge, callback_data: `done:${application.id}` }]);

  await telegramCall('editMessageReplyMarkup', {
    chat_id: fromChat,
    message_id: query.message.message_id,
    reply_markup: { inline_keyboard: finalButtons }
  });
}

async function handleMessage(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;
  const fromChat = String(msg.chat?.id ?? '');
  if (fromChat) addSubscriber(fromChat);

  const text = msg.text.trim().toLowerCase();
  if (text.startsWith('/get-one') || text.startsWith('/get_one') || text === '/get') {
    await telegramCall('sendMessage', {
      chat_id: fromChat,
      text: `🔍 Searching online for a new job matching ${profile.name || 'your'} profile now...`
    });

    try {
      const result = await processNextJob({ maxJobs: 1 });
      if (result.added === 0) {
        if (result.discovered > 0) {
          await telegramCall('sendMessage', {
            chat_id: fromChat,
            text: `ℹ️ Discovered ${result.discovered} listings, but they have already been saved. Will check again at 7:00 PM!`
          });
        } else {
          await telegramCall('sendMessage', {
            chat_id: fromChat,
            text: 'ℹ️ No new jobs found online at this moment. Will check again at 7:00 PM!'
          });
        }
      }
    } catch (err) {
      console.error('Manual /get-one search error:', err.message);
      await telegramCall('sendMessage', {
        chat_id: fromChat,
        text: `⚠️ Search error: ${err.message}`
      });
    }
  } else if (text === '/start') {
    await telegramCall('sendMessage', {
      chat_id: fromChat,
      text: `👋 Hello! I am your Job Assistant for ${profile.name || 'you'}.\n\n⏰ I automatically search and send 5 new jobs every day at 7:00 PM UAE time.\n\n⚡️ You can also trigger an immediate job search anytime by sending: /get-one`
    });
  }
}

async function telegramPoller() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram is not configured; skipping bot polling.');
    return;
  }

  // Register command in menu
  try {
    await telegramCall('setMyCommands', {
      commands: [
        { command: 'get_one', description: 'Fetch and process 1 new job now' },
        { command: 'start', description: 'Bot status and overview' }
      ]
    });
  } catch (e) {
    console.warn('Could not register bot commands menu:', e.message);
  }

  let offset = 0;
  while (true) {
    try {
      const updates = await telegramCall('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['callback_query', 'message']
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          if (update.callback_query) {
            await handleCallback(update);
          } else if (update.message) {
            await handleMessage(update);
          }
        } catch (e) {
          console.error('Telegram update handler failed:', e.message);
        }
      }
    } catch (e) {
      console.error('Telegram polling error:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// Schedule daily job search (defaults to 15:00 UTC = 7:00 PM UAE Time every day)
const cronSchedule = process.env.DAILY_CRON || '0 15 * * *';
const maxJobsDaily = Math.max(1, Number(process.env.MAX_JOBS_PER_RUN || 5));
cron.schedule(cronSchedule, async () => {
  console.log(`⏰ Running daily job search (${maxJobsDaily} jobs per day at 7:00 PM UAE)...`);
  try {
    const result = await processNextJob({ maxJobs: maxJobsDaily });
    console.log(`Daily run finished: Discovered ${result.discovered}, Added ${result.added}, Skipped ${result.skippedDuplicates}`);
  } catch (err) {
    console.error('Scheduled daily job search error:', err.message);
  }
});

app.listen(port, () => {
  console.log(`Worker listening on http://localhost:${port}`);
  console.log(`Daily cron active: "${cronSchedule}" (15:00 UTC / 7:00 PM UAE)`);
});
telegramPoller().catch(e => console.error('Telegram poller stopped:', e));

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

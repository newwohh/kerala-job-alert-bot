import fs from 'node:fs';
import path from 'node:path';

const apiBase = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function telegramCall(method, payload) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is missing');
  const response = await fetch(`${apiBase()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram API error: ${method}`);
  return data.result;
}

export async function sendTelegramDocument(filePath, caption = '') {
  if (!process.env.TELEGRAM_CHAT_ID || !process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    const fileBytes = fs.readFileSync(filePath);
    const blob = new Blob([fileBytes], { type: 'application/pdf' });
    const form = new FormData();
    form.append('chat_id', process.env.TELEGRAM_CHAT_ID);
    form.append('caption', caption);
    form.append('document', blob, path.basename(filePath));

    const res = await fetch(`${apiBase()}/sendDocument`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Could not send document to Telegram:', err.message);
  }
}

export async function sendApplicationPreview(app, job) {
  if (!process.env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is missing');
  const safe = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const emailReady = Boolean(app.recipientEmail);
  const jobLink = job.jobUrl
    ? `<a href="${job.jobUrl}">Open Job Posting ↗</a>`
    : 'None';

  let text = '';
  if (emailReady) {
    text = `🎯 <b>NEW JOB MATCH — EMAIL READY</b>\n` +
      `<b>${safe(job.title)}</b>\n` +
      `🏢 ${safe(job.company)} · 📍 ${safe(job.location)}\n` +
      `📊 <b>Match Score:</b> ${app.matchScore}%\n` +
      `🔗 <b>Job Link:</b> ${jobLink}\n\n` +
      `✉️ <b>To:</b> <code>${safe(app.recipientEmail)}</code>\n` +
      `📋 <b>Subject:</b> ${safe(app.emailSubject)}\n\n` +
      `📝 <b>Email / Cover Letter:</b> <i>(Tap to copy)</i>\n` +
      `<pre><code>${safe(app.emailBody)}</code></pre>\n\n` +
      `<i>Review the preview and attached resume below, then tap Approve to dispatch email from Gmail.</i>`;
  } else {
    text = `🎯 <b>NEW JOB MATCH — PORTAL APPLY</b>\n` +
      `<b>${safe(job.title)}</b>\n` +
      `🏢 ${safe(job.company)} · 📍 ${safe(job.location)}\n` +
      `📊 <b>Match Score:</b> ${app.matchScore}%\n` +
      `🔗 <b>Job Link:</b> ${jobLink}\n\n` +
      `ℹ️ <i>No direct email found. Use the 10-second apply flow:</i>\n` +
      `1️⃣ Tap the cover letter below to copy it.\n` +
      `2️⃣ Tap <b>Apply on Portal</b>.\n` +
      `3️⃣ Upload the attached tailored PDF.\n\n` +
      `📝 <b>Tailored Cover Letter:</b> <i>(Tap to copy)</i>\n` +
      `<pre><code>${safe(app.emailBody)}</code></pre>`;
  }

  const buttons = [];
  if (job.jobUrl) {
    buttons.push([{
      text: emailReady ? '🔗 View Job Posting' : '🔗 Apply on Portal ↗',
      url: job.jobUrl
    }]);
  }

  if (emailReady) {
    buttons.push([
      { text: '✅ Approve & Send', callback_data: `approve:${app.id}` },
      { text: '❌ Reject', callback_data: `reject:${app.id}` }
    ]);
  } else {
    buttons.push([
      { text: '🗑 Dismiss', callback_data: `reject:${app.id}` }
    ]);
  }

  // 1. Send the interactive preview
  await telegramCall('sendMessage', {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons }
  });

  // 2. Deliver the tailored PDF directly to Telegram
  if (app.resumeFile && fs.existsSync(app.resumeFile)) {
    await sendTelegramDocument(
      app.resumeFile,
      `📄 Tailored Resume: ${job.title} — ${job.company}`
    );
  }
}

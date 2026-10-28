/**
 * Deploy as a Web App. Set Script Property APPS_SCRIPT_SECRET to the same
 * long random secret used by Node's APPS_SCRIPT_SECRET. Execute as you.
 * Access can be set to Anyone because this endpoint is called server-to-server;
 * the secret is mandatory, must be long/random, and must never be committed.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    if (!expected || !constantTimeEquals(String(data.secret || ''), expected)) {
      return json({ ok: false, error: 'Unauthorized' });
    }
    const applicationId = String(data.applicationId || '');
    const to = String(data.to || '').trim();
    const subject = String(data.subject || '').trim();
    const body = String(data.body || '').trim();
    const filename = String(data.filename || 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const base64 = String(data.resumeBase64 || '');
    if (!applicationId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !body || !base64) {
      return json({ ok: false, error: 'Missing or invalid application fields' });
    }
    if (subject.length > 250 || body.length > 15000 || base64.length > 8 * 1024 * 1024) {
      return json({ ok: false, error: 'Payload exceeds allowed limits' });
    }
    const props = PropertiesService.getScriptProperties();
    const sentKey = 'sent_' + applicationId;
    const prior = props.getProperty(sentKey);
    if (prior) return json({ ok: true, status: 'already_sent', messageId: prior });
    const bytes = Utilities.base64Decode(base64);
    const attachment = Utilities.newBlob(bytes, 'application/pdf', filename);
    // Mark the operation as in progress before sending to reduce duplicate sends.
    props.setProperty(sentKey, 'SENDING');
    try {
      GmailApp.sendEmail(to, subject, body, {
        attachments: [attachment],
        name: 'Job Application'
      });
      props.setProperty(sentKey, 'SENT');
      return json({ ok: true, status: 'sent' });
    } catch (sendError) {
      props.deleteProperty(sentKey);
      throw sendError;
    }
  } catch (error) {
    return json({ ok: false, error: String(error && error.message || error) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

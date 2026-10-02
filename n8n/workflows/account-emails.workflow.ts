import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const emailWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Account Email Requested',
    parameters: { httpMethod: 'POST', path: 'lifelink/account-email', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
    credentials: { httpHeaderAuth: newCredential('Header Auth account') },
    position: [0, 300]
  },
  output: [{ body: { type: 'reset_code', to: 'asha@example.com', name: 'Asha Patil', code: '482913', minutes: 15, needs_authenticator: false } }]
});

const buildEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Account Email',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// One email per request from the backend: a password reset code, or a notice
// that the password was changed (sent after every reset, so a stranger's reset is noticed).
const body = $input.first().json.body || {};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const to = String(body.to || '').trim();
if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(to)) throw new Error('A valid recipient email is required');
const first = esc(String(body.name || 'there').trim().split(' ')[0]);
const frame = (inner) => '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">'
  + '<p style="font-size:20px;font-weight:800;margin:0 0 16px">Life<span style="color:#ee2b2b">Link</span></p>' + inner
  + '<p style="font-size:12px;color:#64748b;margin-top:24px">LifeLink blood donation network</p></div>';
let subject;
let html;
if (body.type === 'reset_code') {
  const code = String(body.code || '');
  if (!/^[0-9]{6}$/.test(code)) throw new Error('A 6-digit code is required');
  const minutes = Number(body.minutes) || 15;
  subject = 'Your LifeLink password reset code';
  html = frame('<p>Hi ' + first + ',</p><p>Use this code to reset your LifeLink password:</p>'
    + '<p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#ee2b2b;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:12px;text-align:center">' + code + '</p>'
    + '<p>It works once, for ' + minutes + ' minutes.' + (body.needs_authenticator ? ' You will also need the code from your authenticator app.' : '') + '</p>'
    + '<p style="color:#64748b">Did not ask for this? Ignore this email: your password stays the same. Never share this code. LifeLink staff will never ask for it.</p>');
} else if (body.type === 'password_changed') {
  subject = 'Your LifeLink password was changed';
  html = frame('<p>Hi ' + first + ',</p><p>Your LifeLink password was changed' + (body.when ? ' on ' + esc(body.when) + ' (IST)' : '') + ', and you were signed out on every device.</p>'
    + '<p>If this was you, there is nothing else to do.</p>'
    + '<p style="color:#b91c1c;font-weight:700">If it was not you, reset your password again straight away from the sign-in page, and tell your LifeLink admin.</p>');
} else {
  throw new Error('Unknown email type: ' + body.type);
}
return [{ json: { to, subject, html } }];`
    },
    position: [260, 300]
  },
  output: [{ to: 'asha@example.com', subject: 'Your LifeLink password reset code', html: '<p>Hi Asha</p>' }]
});

const sendEmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.1,
  config: {
    name: 'Send Account Email',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $json.to }}'),
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [520, 300]
  },
  output: [{ id: 'msg1' }]
});

// Successful runs are not saved, so reset codes do not sit in n8n's execution history
export default workflow('lifelink-account-emails', 'LifeLink – Account Emails')
  .add(emailWebhook)
  .to(buildEmail)
  .to(sendEmail)
  .settings({ saveDataSuccessExecution: 'none', saveManualExecutions: false, saveDataErrorExecution: 'all' });

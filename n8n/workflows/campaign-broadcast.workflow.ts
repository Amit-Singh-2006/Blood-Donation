import { workflow, node, trigger, newCredential, expr, placeholder } from '@n8n/workflow-sdk';

const campaignWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Campaign Announced',
    parameters: { httpMethod: 'POST', path: 'lifelink/campaign-broadcast', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
    credentials: { httpHeaderAuth: newCredential('Header Auth account') },
    position: [0, 300]
  },
  output: [{ body: { campaign: { name: 'Navratri Blood Donation Camp', city: 'Pune', venue: 'Community Hall', when: '12 Oct 2026, 9:00 am to 5:00 pm' }, register_url: 'https://blood-donation-frontend-delta.vercel.app/campaign/1', recipients: [{ name: 'Asha Patil', phone: '+915550000123', email: 'asha@example.com' }] } }]
});

const buildMessages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Campaign Messages',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// One item per donor with the SMS/WhatsApp text and the email, sent by the next three nodes.
const body = $input.first().json.body || {};
const c = body.campaign || {};
const url = String(body.register_url || '');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const where = c.venue + (c.address ? ', ' + c.address : '') + ', ' + c.city;
const extras = [];
if (c.rewards) extras.push('Rewards: ' + c.rewards);
if (c.refreshments) extras.push('Refreshments: ' + c.refreshments);
const recipients = Array.isArray(body.recipients) ? body.recipients.slice(0, 5000) : [];
return recipients.map((r) => {
  const first = String(r.name || 'there').split(' ')[0];
  const text = 'LifeLink: Blood donation camp "' + c.name + '" in ' + c.city + ', ' + c.when + ' at ' + where + '. ' + (extras.length ? extras.join('. ') + '. ' : '') + 'Register: ' + url;
  const html = '<p>Hi ' + esc(first) + ',</p><p>You are invited to <b>' + esc(c.name) + '</b>, a blood donation camp in ' + esc(c.city) + '.</p>'
    + '<p><b>When:</b> ' + esc(c.when) + '<br><b>Where:</b> ' + esc(where) + (extras.length ? '<br>' + extras.map(esc).join('<br>') : '')
    + (c.contact_phone ? '<br><b>Contact:</b> ' + esc(c.contact_phone) : '') + '</p>'
    + (c.description ? '<p>' + esc(c.description) + '</p>' : '')
    + '<p><a href="' + esc(url) + '">Register for the camp</a></p><p>One donation can save up to three lives. Thank you!<br>LifeLink</p>';
  return { json: { name: r.name || '', phone: r.phone || '', email: r.email || '', sms_text: text, email_subject: 'Blood donation camp: ' + c.name + ' (' + c.city + ')', email_html: html } };
});`
    },
    position: [260, 300]
  },
  output: [{ name: 'Asha Patil', phone: '+915550000123', email: 'asha@example.com', sms_text: 'LifeLink: Blood donation camp', email_subject: 'Blood donation camp', email_html: '<p>Hi</p>' }]
});

const sendSms = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'Send Campaign SMS',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Your Twilio sender number, e.g. +14155550100'),
      to: expr("{{ $('Build Campaign Messages').item.json.phone }}"),
      toWhatsapp: false,
      message: expr("{{ $('Build Campaign Messages').item.json.sms_text }}"),
      options: {}
    },
    credentials: { twilioApi: newCredential('Twilio account') },
    position: [520, 300]
  },
  output: [{ sid: 'SM1', status: 'queued' }]
});

const sendWhatsApp = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'Send Campaign WhatsApp',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: placeholder('Meta WhatsApp phone number ID'),
      recipientPhoneNumber: expr("{{ $('Build Campaign Messages').item.json.phone }}"),
      messageType: 'text',
      textBody: expr("{{ $('Build Campaign Messages').item.json.sms_text }}"),
      additionalFields: {}
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account') },
    position: [780, 300]
  },
  output: [{ messages: [{ id: 'wamid.1' }] }]
});

const sendEmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.1,
  config: {
    name: 'Send Campaign Email',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $('Build Campaign Messages').item.json.email }}"),
      subject: expr("{{ $('Build Campaign Messages').item.json.email_subject }}"),
      emailType: 'html',
      message: expr("{{ $('Build Campaign Messages').item.json.email_html }}"),
      options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [1040, 300]
  },
  output: [{ id: 'msg1' }]
});

export default workflow('lifelink-campaign-broadcast', 'LifeLink – Campaign Broadcast')
  .add(campaignWebhook)
  .to(buildMessages)
  .to(sendSms)
  .to(sendWhatsApp)
  .to(sendEmail);

import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const ussdWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'USSD Session Update',
    parameters: { httpMethod: 'POST', path: 'lifelink/ussd', responseMode: 'responseNode', options: {} },
    position: [0, 300]
  },
  output: [{ body: { sessionId: 'ATUid_1', serviceCode: '*384*2580#', phoneNumber: '+915550000105', text: '1*1*1' } }]
});

const parseSession = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse USSD Session',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Africa's Talking-style callback: the mobile network supplies the caller's
// number (that is the "login"), and text holds every menu choice so far ("1*2").
const b = $input.first().json.body ?? {};
const raw = String(b.phoneNumber ?? '').replace(/[\\s()-]/g, '');
const phone = /^\\+\\d{10,15}$/.test(raw) ? raw : /^\\d{10}$/.test(raw) ? '+91' + raw : null;
const text = String(b.text ?? '').trim();
return [{
  json: {
    session_id: String(b.sessionId ?? ''),
    service_code: String(b.serviceCode ?? ''),
    phone: phone ?? 'invalid',
    steps: text === '' ? [] : text.split('*').map((s) => s.trim()),
  },
}];`
    },
    position: [220, 300]
  },
  output: [{ session_id: 'ATUid_1', service_code: '*384*2580#', phone: '+915550000105', steps: ['1', '1', '1'] }]
});

const findDonor = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Donor by Phone',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.phone }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [440, 300]
  },
  output: [{ id: 5, name: 'Vikram Singh', phone: '+915550000105', blood_group: 'B+', gender: 'male', available: true, last_donation_date: '2026-06-20', committed_until: null }]
});

const loadAlerts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Pending Alerts',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'donor_id', condition: 'eq', keyValue: expr('{{ $json.id || 0 }}') },
          { keyName: 'status', condition: 'eq', keyValue: 'notified' }
        ]
      },
      returnAll: true
    },
    position: [660, 300]
  },
  output: [{ id: 9, request_id: 1, donor_id: 5, status: 'notified', response_token: 'c10a893e-c001-45a6-a6d6-cb5319951683', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', request_blood_group: 'AB+', urgency: 'Emergency', distance_miles: 41.7, notified_at: '2026-09-29T10:00:00.000Z' }]
});

const ussdMenu = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'USSD Menu',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Replies start with CON (show a menu and keep the session open) or END.
// Registered donors: see and answer blood requests, check eligibility, turn
// alerts on/off. Unknown numbers: register with blood group and city.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;
const s = $('Parse USSD Session').first().json;
const donor = $('Find Donor by Phone').first().json;
const alerts = $('Load Pending Alerts').all().map((i) => i.json).filter((m) => m.id)
  .sort((a, b) => String(b.notified_at).localeCompare(String(a.notified_at))).slice(0, 3);
const steps = s.steps;
const now = Date.now();
const invalid = 'END Invalid choice. Please dial again.';
const firstName = (n) => String(n ?? '').trim().split(' ')[0] || 'donor';
const out = { action: 'none', reply: invalid };

if (s.phone === 'invalid') {
  out.reply = 'END Sorry, we could not read your phone number.';
} else if (!donor.id) {
  if (steps.length === 0) {
    out.reply = 'CON Welcome to LifeLink.\\nThis number is not registered as a blood donor.\\n1. Register now\\n2. Exit';
  } else if (steps[0] === '2' && steps.length === 1) {
    out.reply = 'END Thank you. Dial again any time to register.';
  } else if (steps[0] === '1' && steps.length === 1) {
    out.reply = 'CON Select your blood group:\\n' + BLOOD_GROUPS.map((g, i) => (i + 1) + '. ' + g).join('\\n') + '\\n9. Not sure';
  } else if (steps[0] === '1' && steps.length === 2) {
    const g = Number(steps[1]);
    if (g === 9) out.reply = 'END Please get your blood group tested at any blood bank or hospital, then dial again to register.';
    else if (g >= 1 && g <= 8) out.reply = 'CON Enter your city or town:';
  } else if (steps[0] === '1' && steps.length >= 3) {
    const g = Number(steps[1]);
    const cityRaw = steps.slice(2).join(' ').trim();
    if (g >= 1 && g <= 8 && cityRaw.length >= 2 && cityRaw.length <= 60) {
      const city = cityRaw.charAt(0).toUpperCase() + cityRaw.slice(1);
      out.action = 'register';
      out.register = { phone: s.phone, blood_group: BLOOD_GROUPS[g - 1], city };
      out.reply = 'END Registered as ' + (/^[AO]/.test(BLOOD_GROUPS[g - 1]) ? 'an ' : 'a ') + BLOOD_GROUPS[g - 1] + ' donor in ' + city + '. We will text you when your blood can help a patient nearby. Thank you!';
    }
  }
} else {
  const committed = donor.committed_until && Date.parse(donor.committed_until) > now;
  const eligibleFrom = donor.last_donation_date
    ? Date.parse(donor.last_donation_date + 'T00:00:00Z') + (DEFERRAL_DAYS[donor.gender] ?? DEFERRAL_DAYS.female) * DAY
    : null;
  const describe = (m) => m.urgency + ' ' + m.request_blood_group + ' - ' + m.hospital_name + (m.distance_miles != null ? ' (' + m.distance_miles + ' mi)' : '');

  if (steps.length === 0) {
    out.reply = 'CON Welcome ' + (donor.source === 'ussd' ? 'back' : firstName(donor.name)) + ' (' + donor.blood_group + ' donor)\\n1. Blood requests for you (' + alerts.length + ')\\n2. My eligibility\\n3. Alerts: ' + (donor.available ? 'ON' : 'OFF');
  } else if (steps[0] === '1') {
    const m = steps.length >= 2 ? alerts[Number(steps[1]) - 1] : null;
    if (steps.length === 1) {
      out.reply = alerts.length
        ? 'CON Requests needing you:\\n' + alerts.map((a, i) => (i + 1) + '. ' + describe(a)).join('\\n')
        : 'END No blood requests need you right now. Thank you for staying available!';
    } else if (m && steps.length === 2) {
      out.reply = 'CON ' + m.hospital_name + ' (' + m.hospital_city + ') needs ' + m.request_blood_group + ' blood (' + m.urgency + ').\\n1. Yes, I can donate today\\n2. No, not this time';
    } else if (m && steps.length === 3 && ['1', '2'].includes(steps[2])) {
      out.action = 'respond';
      out.respond = { match_id: m.id, token: m.response_token, action: steps[2] === '1' ? 'accept' : 'decline', hospital_name: m.hospital_name };
      out.reply = '';
    }
  } else if (steps[0] === '2' && steps.length === 1) {
    out.reply = 'END ' + donor.blood_group + ' donor. '
      + (donor.last_donation_date ? 'Last donation ' + donor.last_donation_date + '. ' : 'No donation recorded yet. ')
      + (committed ? 'You are booked for a request today.'
        : eligibleFrom && eligibleFrom > now ? 'You can donate again from ' + new Date(eligibleFrom).toISOString().slice(0, 10) + '.'
          : 'You can donate now.');
  } else if (steps[0] === '3') {
    if (steps.length === 1) {
      out.reply = 'CON Alerts are ' + (donor.available ? 'ON' : 'OFF') + '.\\n1. Turn alerts ON\\n2. Turn alerts OFF';
    } else if (steps.length === 2 && ['1', '2'].includes(steps[1])) {
      out.action = 'set_availability';
      out.availability = { id: donor.id, available: steps[1] === '1' };
      out.reply = steps[1] === '1'
        ? 'END Alerts turned ON. We will text you when your blood is needed nearby.'
        : 'END Alerts turned OFF. Dial again to turn them back on.';
    }
  }
}
return [{ json: out }];`
    },
    position: [880, 300]
  },
  output: [{ action: 'respond', reply: '', respond: { match_id: 9, token: 'c10a893e-c001-45a6-a6d6-cb5319951683', action: 'accept', hospital_name: 'AIIMS Trauma Centre' } }]
});

const routeAction = switchCase({
  version: 3.4,
  config: {
    name: 'Apply USSD Action',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { renameOutput: true, outputKey: 'register', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'register' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'availability', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'set_availability' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'respond', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'respond' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'menu only' }
    },
    position: [1100, 300]
  }
});

const registerDonor = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Register USSD Donor',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.register.phone }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          name: 'LifeLink donor (USSD)',
          phone: expr('{{ $json.register.phone }}'),
          blood_group: expr('{{ $json.register.blood_group }}'),
          gender: 'unspecified',
          city: expr('{{ $json.register.city }}'),
          available: true,
          total_donations: 0,
          preferred_channel: 'sms',
          xp_points: 0,
          source: 'ussd'
        },
        matchingColumns: [],
        schema: [
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'blood_group', displayName: 'blood_group', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'gender', displayName: 'gender', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'city', displayName: 'city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'available', displayName: 'available', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'total_donations', displayName: 'total_donations', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'preferred_channel', displayName: 'preferred_channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'xp_points', displayName: 'xp_points', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1320, 100]
  },
  output: [{ id: 16, phone: '+915550000301' }]
});

const setAvailability = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Availability',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.availability.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { available: expr('{{ $json.availability.available }}') },
        matchingColumns: [],
        schema: [
          { id: 'available', displayName: 'available', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1320, 260]
  },
  output: [{ id: 5, available: false }]
});

const recordResponse = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Record Donor Reply',
    parameters: {
      method: 'GET',
      url: 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'm', value: expr('{{ $json.respond.match_id }}') },
          { name: 't', value: expr('{{ $json.respond.token }}') },
          { name: 'a', value: expr('{{ $json.respond.action }}') },
          { name: 'format', value: 'json' }
        ]
      },
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Linux; Android 10; LifeLink USSD Gateway) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }] },
      options: { timeout: 8000, response: { response: { neverError: true, responseFormat: 'json' } } }
    },
    position: [1320, 420]
  },
  output: [{ outcome: 'accepted', title: 'Thank you, Vikram!' }]
});

const replyToGateway = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reply to USSD Gateway',
    executeOnce: true,
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ $("USSD Menu").first().json.reply }}'),
      options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }] } }
    },
    position: [1540, 200]
  },
  output: [{ reply: 'END ...' }]
});

const replyAfterResponse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reply With Outcome',
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ ({ accepted: "END Thank you! " + $("USSD Menu").first().json.respond.hospital_name + " has been told you are coming. Please carry a photo ID.", declined: "END Thanks for letting us know. We will ask another donor.", withdrawn: "END Thanks for letting us know. The hospital has been told.", not_needed: "END Thank you! Enough donors have already confirmed for this request.", committed_elsewhere: "END You are already booked for another request. Thank you!", already_accepted: "END You are already confirmed. Thank you!", already_declined: "END Noted. Thank you." })[$json.outcome] ?? "END Sorry, we could not record your reply. Please try again." }}'),
      options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }] } }
    },
    position: [1540, 420]
  },
  output: [{ reply: 'END Thank you!' }]
});

const note = sticky("## USSD gateway for basic phones (spec stage 1)\nPoint an Africa's Talking (or similar) USSD service code at **POST /webhook/lifelink/ussd**. The network supplies the caller's number, so it doubles as login.\n\n**Registered donors:** 1 = blood requests (answer YES/NO, same logic as the one-tap links), 2 = eligibility, 3 = alerts on/off.\n**New numbers:** register with blood group + city in three steps.\n\nIn production, restrict this webhook to the gateway's IP range (webhook option *IP whitelist*).", [ussdWebhook, parseSession], { color: 5, position: [-40, -60], width: 600, height: 280 });

export default workflow('lifelink-ussd-gateway', 'LifeLink – USSD Gateway')
  .add(ussdWebhook)
  .to(parseSession.to(findDonor.to(loadAlerts.to(ussdMenu.to(routeAction
    .onCase(0, registerDonor.to(replyToGateway))
    .onCase(1, setAvailability.to(replyToGateway))
    .onCase(2, recordResponse.to(replyAfterResponse))
    .onCase(3, replyToGateway))))))
  .add(note)
  .group('Identify caller', [parseSession, findDonor, loadAlerts, ussdMenu], { description: 'Reads the network-supplied number and menu path, looks up the donor and their open alerts, builds the next screen.' })
  .group('Apply choice', [registerDonor, setAvailability, recordResponse], { description: 'Registers new donors, toggles alerts, or records a YES/NO through the donor-response workflow.' });

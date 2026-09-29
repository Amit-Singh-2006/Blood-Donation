import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const portalWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Donor Portal Request',
    parameters: { httpMethod: 'POST', path: 'lifelink/donor-portal', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
    credentials: { httpHeaderAuth: newCredential('Header Auth account') },
    position: [0, 300]
  },
  output: [{ body: { phone: '+915550000103', action: 'update', available: true, preferred_channel: 'whatsapp' } }]
});

const parseRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Portal Request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// The website backend calls this for the logged-in donor: action "status"
// reads their profile, live alerts and history; "update" changes availability
// and/or alert channel without resending the whole profile.
const CHANNELS = ['sms', 'whatsapp', 'in_app'];
const body = $input.first().json.body ?? {};
const errors = [];

const raw = String(body.phone ?? '').replace(/[\\s()-]/g, '');
const phone = /^\\+\\d{10,15}$/.test(raw) ? raw : /^\\d{10}$/.test(raw) ? '+91' + raw : null;
if (!phone) errors.push({ path: 'phone', message: 'Use a mobile number with country code, e.g. +919876543210' });

const action = body.action ?? 'status';
if (!['status', 'update'].includes(action)) errors.push({ path: 'action', message: 'Must be status or update' });

let available = null;
if (body.available !== undefined) {
  if (typeof body.available !== 'boolean') errors.push({ path: 'available', message: 'Must be true or false' });
  else available = body.available;
}
let channel = null;
if (body.preferred_channel !== undefined) {
  channel = String(body.preferred_channel).toLowerCase();
  if (!CHANNELS.includes(channel)) errors.push({ path: 'preferred_channel', message: 'Must be one of ' + CHANNELS.join(', ') });
}
if (action === 'update' && available === null && channel === null) errors.push({ path: 'action', message: 'Send available and/or preferred_channel to update' });

return [{ json: { valid: errors.length === 0, errors, phone, action, available, preferred_channel: channel } }];`
    },
    position: [220, 300]
  },
  output: [{ valid: true, errors: [], phone: '+915550000103', action: 'update', available: true, preferred_channel: 'whatsapp' }]
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Is Request Valid?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.valid }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [440, 300]
  }
});

const rejectRequest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Invalid Request',
    parameters: { respondWith: 'json', responseBody: expr('{{ { status: "rejected", errors: $json.errors } }}'), options: { responseCode: 400 } },
    position: [660, 500]
  },
  output: [{ status: 'rejected' }]
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
    position: [660, 200]
  },
  output: [{ id: 3, name: 'Rohan Gupta', phone: '+915550000103', blood_group: 'O+', gender: 'male', city: 'Gurugram', available: true, last_donation_date: null, total_donations: 1, preferred_channel: 'whatsapp', xp_points: 190, committed_until: null }]
});

const loadAlerts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Donor Alerts',
    alwaysOutputData: true,
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'donor_id', condition: 'eq', keyValue: expr('{{ $json.id || 0 }}') }] },
      returnAll: true
    },
    position: [880, 200]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, request_blood_group: 'AB+', distance_km: 14.3, status: 'notified', response_token: 'c3', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', urgency: 'Emergency', units_required: 2, notified_at: '2026-09-29T10:00:00.000Z', responded_at: null }]
});

const buildView = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Donor View',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// The donor's own view: profile, live alerts with their one-tap links, and
// donation history. Only the backend can call this (header key), and only for
// the logged-in donor's phone, so the links never reach anyone else.
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;
const BASE = 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response';

const p = $('Parse Portal Request').first().json;
const donor = $('Find Donor by Phone').first().json;
const matches = $('Load Donor Alerts').all().map((i) => i.json).filter((m) => m.id);

if (!donor.id) {
  return [{ json: { updates: [], http_status: 404, response: { registered: false, message: 'No donor with this phone number is on the LifeLink network yet.' } } }];
}

const updates = [];
let available = donor.available;
let channel = donor.preferred_channel;
if (p.action === 'update') {
  if (p.available !== null) available = p.available;
  if (p.preferred_channel !== null) channel = p.preferred_channel;
  updates.push({ id: donor.id, available, preferred_channel: channel });
}

const now = Date.now();
const deferral = DEFERRAL_DAYS[donor.gender] ?? DEFERRAL_DAYS.female;
const eligibleFrom = donor.last_donation_date
  ? new Date(Date.parse(donor.last_donation_date + 'T00:00:00Z') + deferral * DAY).toISOString().slice(0, 10)
  : null;
const link = (m, a) => BASE + '?m=' + m.id + '&t=' + m.response_token + '&a=' + a;
const time = (m) => Date.parse(m.responded_at || m.notified_at || m.updatedAt || m.createdAt) || 0;

const alerts = matches
  .filter((m) => ['notified', 'accepted'].includes(m.status))
  .sort((a, b) => time(b) - time(a))
  .map((m) => ({
    match_id: m.id,
    request_id: m.request_id,
    status: m.status === 'accepted' ? 'accepted' : 'awaiting_reply',
    hospital_name: m.hospital_name,
    hospital_city: m.hospital_city,
    blood_group_needed: m.request_blood_group,
    urgency: m.urgency,
    units_required: m.units_required,
    distance_km: m.distance_km,
    alerted_at: m.notified_at,
    accept_url: m.status === 'notified' ? link(m, 'accept') : null,
    // After accepting, the decline link withdraws and alerts the next donor
    decline_url: link(m, 'decline'),
  }));

const history = matches
  .filter((m) => m.status === 'donated')
  .sort((a, b) => time(b) - time(a))
  .map((m) => ({
    request_id: m.request_id,
    hospital_name: m.hospital_name,
    hospital_city: m.hospital_city,
    blood_group_needed: m.request_blood_group,
    donated_on: String(m.responded_at || m.updatedAt || '').slice(0, 10),
  }));

const committed = donor.committed_until && Date.parse(donor.committed_until) > now ? donor.committed_until : null;

return [{
  json: {
    updates,
    http_status: 200,
    response: {
      registered: true,
      donor: {
        name: donor.name,
        blood_group: donor.blood_group,
        city: donor.city,
        available,
        preferred_channel: channel,
        total_donations: donor.total_donations ?? 0,
        xp_points: donor.xp_points ?? 0,
        last_donation_date: donor.last_donation_date ?? null,
        eligible_from: eligibleFrom,
        eligible_now: !eligibleFrom || Date.parse(eligibleFrom + 'T00:00:00Z') <= now,
        committed_until: committed,
      },
      alerts,
      history,
      stats: {
        alerts_received: matches.filter((m) => m.notified_at).length,
        accepted: matches.filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status)).length,
        donations_via_lifelink: history.length,
      },
    },
  },
}];`
    },
    position: [1100, 200]
  },
  output: [{ updates: [{ id: 3, available: true, preferred_channel: 'whatsapp' }], http_status: 200, response: { registered: true } }]
});

const splitUpdates = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Preference Changes', parameters: { fieldToSplitOut: 'updates', include: 'noOtherFields', options: {} }, position: [1320, 100] },
  output: [{ id: 3, available: true, preferred_channel: 'whatsapp' }]
});

const updatePreferences = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Donor Preferences',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { available: expr('{{ $json.available }}'), preferred_channel: expr('{{ $json.preferred_channel }}') },
        matchingColumns: [],
        schema: [
          { id: 'available', displayName: 'available', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'preferred_channel', displayName: 'preferred_channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1540, 100]
  },
  output: [{ id: 3, available: true, preferred_channel: 'whatsapp' }]
});

const respondView = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Return Donor View',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.response }}'),
      options: { responseCode: expr('{{ $json.http_status }}') }
    },
    position: [1320, 300]
  },
  output: [{ registered: true }]
});

const note = sticky("## Donor portal (website / app)\nThe backend calls this with the logged-in donor's phone and the `X-LifeLink-Key` header.\n- `action: \"status\"` returns the profile, eligibility, live alerts (with their one-tap YES/NO links) and donation history.\n- `action: \"update\"` changes `available` and/or `preferred_channel` (sms, whatsapp, in_app) and returns the new view.\n\nFull profile edits still go through **LifeLink – Donor Registry**.", [portalWebhook, parseRequest], { color: 5, position: [-40, -80], width: 600, height: 260 });

export default workflow('lifelink-donor-portal', 'LifeLink – Donor Portal')
  .add(portalWebhook)
  .to(parseRequest)
  .to(isValid
    .onTrue(findDonor.to(loadAlerts.to(buildView)))
    .onFalse(rejectRequest))
  .add(buildView)
  .to(splitUpdates.to(updatePreferences))
  .add(buildView)
  .to(respondView)
  .add(note)
  .group('Validate request', [parseRequest, isValid], { description: 'Normalises the phone and checks the action, availability and channel.' })
  .group('Load donor', [findDonor, loadAlerts, buildView], { description: 'Loads the donor by phone and their alerts, and builds their view.' })
  .group('Save preferences', [splitUpdates, updatePreferences], { description: 'Applies availability / channel changes to the registry.' });

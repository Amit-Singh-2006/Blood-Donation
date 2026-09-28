import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const registryWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Donor Profile Submitted',
    parameters: { httpMethod: 'POST', path: 'lifelink/donors', responseMode: 'responseNode', options: {} },
    position: [0, 300]
  },
  output: [{ body: { name: 'Riya Sharma', phone: '5550000201', blood_group: 'O-', gender: 'female', city: 'Delhi', latitude: 28.6139, longitude: 77.209, available: true, last_donation_date: '2026-03-15', total_donations: 3, preferred_channel: 'sms' } }]
});

const validateProfile = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Donor Profile',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Spec stage 2 (registry capture): blood group, location, availability and
// donation history. The phone number is the donor's identity (it is also how
// USSD recognises them), so a second submission updates the same profile.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CHANNELS = ['push', 'sms', 'whatsapp', 'in_app'];
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;

const input = $input.first().json;
const body = input.body && typeof input.body === 'object' ? input.body : input;
const errors = [];
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';

const phoneRaw = String(body.phone ?? '').replace(/[\\s()-]/g, '');
const phone = /^\\+\\d{10,15}$/.test(phoneRaw) ? phoneRaw : /^\\d{10}$/.test(phoneRaw) ? '+91' + phoneRaw : null;
if (!phone) errors.push({ path: 'phone', message: 'Use a mobile number with country code, e.g. +919876543210' });

const name = text(body.name);
if (name.length < 2 || name.length > 100) errors.push({ path: 'name', message: 'Name is required (2-100 characters)' });
if (!BLOOD_GROUPS.includes(body.blood_group)) errors.push({ path: 'blood_group', message: 'Must be one of ' + BLOOD_GROUPS.join(', ') });
const city = text(body.city);
if (city.length < 2 || city.length > 100) errors.push({ path: 'city', message: 'City is required (2-100 characters)' });

const gender = has('gender') ? String(body.gender).toLowerCase() : 'unspecified';
if (!['male', 'female', 'other', 'unspecified'].includes(gender)) errors.push({ path: 'gender', message: 'Must be male, female or other' });

const hasLat = has('latitude');
const hasLng = has('longitude');
const validCoord = (v, max) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
if (hasLat !== hasLng) errors.push({ path: 'latitude', message: 'Send both latitude and longitude, or neither' });
else if (hasLat && !(validCoord(body.latitude, 90) && validCoord(body.longitude, 180))) errors.push({ path: 'latitude', message: 'Latitude/longitude must be valid decimal degrees' });

let lastDonation = null;
if (has('last_donation_date')) {
  const s = String(body.last_donation_date);
  const t = Date.parse(s + 'T00:00:00Z');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(s) || Number.isNaN(t)) errors.push({ path: 'last_donation_date', message: 'Use YYYY-MM-DD' });
  else if (t > Date.now()) errors.push({ path: 'last_donation_date', message: 'Cannot be in the future' });
  else lastDonation = s;
}
let totalDonations = null;
if (has('total_donations')) {
  const n = Number(body.total_donations);
  if (!Number.isInteger(n) || n < 0 || n > 500) errors.push({ path: 'total_donations', message: 'Must be a whole number from 0 to 500' });
  else totalDonations = n;
}
let available = true;
if (has('available')) {
  if (typeof body.available !== 'boolean') errors.push({ path: 'available', message: 'Must be true or false' });
  else available = body.available;
}
let channel = has('preferred_channel') ? String(body.preferred_channel).toLowerCase() : 'sms';
if (!CHANNELS.includes(channel)) errors.push({ path: 'preferred_channel', message: 'Must be one of ' + CHANNELS.join(', ') });
const fcmToken = has('fcm_token') ? String(body.fcm_token).slice(0, 4096) : null;
const warnings = [];
if (channel === 'push' && !fcmToken) {
  channel = 'sms';
  warnings.push('Push needs an fcm_token from the app; alerts will go by SMS until one is registered.');
}

const deferral = DEFERRAL_DAYS[gender] ?? DEFERRAL_DAYS.female;
const eligibleFrom = lastDonation ? new Date(Date.parse(lastDonation + 'T00:00:00Z') + deferral * DAY).toISOString().slice(0, 10) : null;

return [{
  json: {
    valid: errors.length === 0,
    errors,
    warnings,
    profile: {
      name, phone, blood_group: body.blood_group ?? null, gender, city,
      latitude: hasLat ? body.latitude : null,
      longitude: hasLng ? body.longitude : null,
      available,
      last_donation_date: lastDonation,
      total_donations: totalDonations,
      preferred_channel: channel,
      fcm_token: fcmToken,
    },
    eligibility: {
      deferral_days: deferral,
      eligible_from: eligibleFrom,
      eligible_now: !eligibleFrom || Date.parse(eligibleFrom + 'T00:00:00Z') <= Date.now(),
    },
  },
}];`
    },
    position: [220, 300]
  },
  output: [{ valid: true, errors: [], warnings: [], profile: { name: 'Riya Sharma', phone: '+915550000201', blood_group: 'O-', gender: 'female', city: 'Delhi', latitude: 28.6139, longitude: 77.209, available: true, last_donation_date: '2026-03-15', total_donations: 3, preferred_channel: 'sms', fcm_token: null }, eligibility: { deferral_days: 120, eligible_from: '2026-07-13', eligible_now: true } }]
});

const isProfileValid = ifElse({
  version: 2.3,
  config: {
    name: 'Is Profile Valid?',
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

const rejectProfile = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Invalid Profile',
    parameters: { respondWith: 'json', responseBody: expr('{{ { status: "rejected", errors: $json.errors } }}'), options: { responseCode: 400 } },
    position: [660, 500]
  },
  output: [{ status: 'rejected' }]
});

const findExisting = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Existing Donor',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.profile.phone }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [660, 200]
  },
  output: [{ id: 15, phone: '+915550000201', total_donations: 3, xp_points: 0, last_donation_date: '2026-03-15', committed_until: null, source: 'web' }]
});

const mergeProfile = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Merge With Donation History',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Keeps donation history, XP and the push token the form did not resend, and
// works out when the donor is next eligible and whom their blood can help.
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;
const CAN_HELP = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], 'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'], 'A+': ['A+', 'AB+'], 'B-': ['B-', 'B+', 'AB-', 'AB+'], 'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'], 'AB+': ['AB+'],
};
const validated = $('Validate Donor Profile').first().json;
const p = validated.profile;
const existing = $input.first().json;

const last = p.last_donation_date ?? existing.last_donation_date ?? null;
const deferral = DEFERRAL_DAYS[p.gender] ?? DEFERRAL_DAYS.female;
const eligibleFrom = last ? new Date(Date.parse(last + 'T00:00:00Z') + deferral * DAY).toISOString().slice(0, 10) : null;

return [{
  json: {
    is_new: !existing.id,
    row: {
      name: p.name,
      phone: p.phone,
      blood_group: p.blood_group,
      gender: p.gender,
      city: p.city,
      latitude: p.latitude,
      longitude: p.longitude,
      available: p.available,
      last_donation_date: last,
      total_donations: p.total_donations ?? existing.total_donations ?? 0,
      preferred_channel: p.preferred_channel,
      fcm_token: p.fcm_token ?? existing.fcm_token ?? null,
      xp_points: existing.xp_points ?? 0,
      source: existing.source ?? 'web',
    },
    reply: {
      status: existing.id ? 'updated' : 'registered',
      blood_group: p.blood_group,
      available: p.available,
      alerts_via: p.preferred_channel,
      eligibility: {
        deferral_days: deferral,
        last_donation_date: last,
        eligible_from: eligibleFrom,
        eligible_now: !eligibleFrom || Date.parse(eligibleFrom + 'T00:00:00Z') <= Date.now(),
      },
      your_blood_can_help: CAN_HELP[p.blood_group],
      warnings: validated.warnings,
    },
  },
}];`
    },
    position: [880, 200]
  },
  output: [{ is_new: true, row: { name: 'Riya Sharma', phone: '+915550000201', blood_group: 'O-', gender: 'female', city: 'Delhi', latitude: 28.6139, longitude: 77.209, available: true, last_donation_date: '2026-03-15', total_donations: 3, preferred_channel: 'sms', fcm_token: null, xp_points: 0, source: 'web' }, reply: { status: 'registered' } }]
});

const upsertDonor = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save to Donor Registry',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.row.phone }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          name: expr('{{ $json.row.name }}'),
          phone: expr('{{ $json.row.phone }}'),
          blood_group: expr('{{ $json.row.blood_group }}'),
          gender: expr('{{ $json.row.gender }}'),
          city: expr('{{ $json.row.city }}'),
          latitude: expr('{{ $json.row.latitude }}'),
          longitude: expr('{{ $json.row.longitude }}'),
          available: expr('{{ $json.row.available }}'),
          last_donation_date: expr('{{ $json.row.last_donation_date }}'),
          total_donations: expr('{{ $json.row.total_donations }}'),
          preferred_channel: expr('{{ $json.row.preferred_channel }}'),
          fcm_token: expr('{{ $json.row.fcm_token }}'),
          xp_points: expr('{{ $json.row.xp_points }}'),
          source: expr('{{ $json.row.source }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'blood_group', displayName: 'blood_group', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'gender', displayName: 'gender', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'city', displayName: 'city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'latitude', displayName: 'latitude', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'longitude', displayName: 'longitude', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'available', displayName: 'available', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'last_donation_date', displayName: 'last_donation_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'total_donations', displayName: 'total_donations', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'preferred_channel', displayName: 'preferred_channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fcm_token', displayName: 'fcm_token', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'xp_points', displayName: 'xp_points', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1100, 200]
  },
  output: [{ id: 15, name: 'Riya Sharma', phone: '+915550000201', blood_group: 'O-' }]
});

const respondSaved = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Confirm Registration',
    executeOnce: true,
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ Object.assign({ donor_id: $json.id }, $("Merge With Donation History").first().json.reply) }}'),
      options: { responseCode: expr('{{ $("Merge With Donation History").first().json.is_new ? 201 : 200 }}') }
    },
    position: [1320, 200]
  },
  output: [{ status: 'registered', donor_id: 15 }]
});

const note = sticky("## Donor onboarding & registry (spec stages 1-2)\nWeb/app onboarding posts here after login. Captures blood group, location, availability and donation history; the phone number is the donor's identity, so re-submitting updates the profile (history the form omits is kept).\n\nThe response tells the donor when they are next eligible (90 days men / 120 days women after a donation) and which patient groups their blood can help. Basic-phone donors use **LifeLink – USSD Gateway** instead.", [registryWebhook, validateProfile], { color: 5, position: [-40, -60], width: 600, height: 260 });

export default workflow('lifelink-donor-registry', 'LifeLink – Donor Registry')
  .add(registryWebhook)
  .to(validateProfile)
  .to(isProfileValid
    .onTrue(findExisting.to(mergeProfile.to(upsertDonor.to(respondSaved))))
    .onFalse(rejectProfile))
  .add(note)
  .group('Validate profile', [validateProfile, isProfileValid], { description: 'Normalises the phone to E.164 and checks blood group, location, availability and donation history.' })
  .group('Save to registry', [findExisting, mergeProfile, upsertDonor, respondSaved], { description: 'Upserts by phone, keeping donation history and XP the form did not send, and returns eligibility.' });

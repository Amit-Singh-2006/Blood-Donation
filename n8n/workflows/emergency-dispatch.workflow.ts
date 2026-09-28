import { workflow, node, trigger, sticky, ifElse, switchCase, placeholder, newCredential, expr } from '@n8n/workflow-sdk';

const requestWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Blood Request Received',
    parameters: { httpMethod: 'POST', path: 'lifelink/emergency-request', responseMode: 'responseNode', options: {} },
    position: [0, 400]
  },
  output: [{ body: { hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', hospital_contact: '+915550000900', patient_ref: 'ICU-7', blood_group: 'AB+', units_required: 2, urgency: 'critical', latitude: 28.5672, longitude: 77.21 } }]
});

const validateRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate & Normalize Request',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Request rules shared with server/src/schemas/hospitalSchemas.ts, plus the
// dispatch settings the escalation loop uses.
const crypto = require('crypto');
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCY_TO_DB = {
  standard: 'Normal', low: 'Normal', medium: 'Normal', Normal: 'Normal',
  high: 'Urgent', Urgent: 'Urgent',
  critical: 'Emergency', Emergency: 'Emergency',
};
// Minutes to wait for replies before alerting the next ranked donors
const ESCALATION_MINUTES = { Emergency: 10, Urgent: 20, Normal: 60 };
// Not everyone answers, so alert more donors up front for emergencies
const waveSize = (units, urgency) => urgency === 'Emergency' ? Math.min(10, Math.max(3, units * 3))
  : urgency === 'Urgent' ? Math.min(8, Math.max(2, units * 2))
  : Math.min(6, Math.max(2, units + 1));

const input = $input.first().json;
const body = input.body && typeof input.body === 'object' ? input.body : input;
const errors = [];
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePhone = (v) => {
  const s = String(v).replace(/[\\s()-]/g, '');
  if (/^\\+\\d{10,15}$/.test(s)) return s;
  if (/^\\d{10}$/.test(s)) return '+91' + s;
  return null;
};

const hospitalName = text(body.hospital_name);
if (hospitalName.length < 2 || hospitalName.length > 200) errors.push({ path: 'hospital_name', message: 'Hospital name is required (2-200 characters)' });
const hospitalCity = text(body.hospital_city);
if (hospitalCity.length < 2 || hospitalCity.length > 100) errors.push({ path: 'hospital_city', message: 'Hospital city is required (2-100 characters)' });

let hospitalContact = null;
if (body.hospital_contact != null && body.hospital_contact !== '') {
  hospitalContact = normalizePhone(body.hospital_contact);
  if (!hospitalContact) errors.push({ path: 'hospital_contact', message: 'Use a phone number with country code, e.g. +919876543210' });
}
const patientRef = text(body.patient_ref);
if (patientRef.length > 40) errors.push({ path: 'patient_ref', message: 'Use a short ward/bed reference (max 40 characters), not the patient name' });

if (!BLOOD_GROUPS.includes(body.blood_group)) errors.push({ path: 'blood_group', message: 'Must be one of ' + BLOOD_GROUPS.join(', ') });

// The hospital dashboard posts units as a string: coerce like z.coerce.number().int().positive()
const units = body.units_required === '' || body.units_required == null ? NaN : Number(body.units_required);
if (!Number.isInteger(units) || units <= 0 || units > 20) errors.push({ path: 'units_required', message: 'Units required must be a whole number from 1 to 20' });

const urgency = Object.prototype.hasOwnProperty.call(URGENCY_TO_DB, body.urgency) ? URGENCY_TO_DB[body.urgency] : null;
if (!urgency) errors.push({ path: 'urgency', message: 'Must be one of ' + Object.keys(URGENCY_TO_DB).join(', ') });

const hasLat = body.latitude != null;
const hasLng = body.longitude != null;
const validCoord = (v, max) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
if (hasLat !== hasLng) errors.push({ path: 'latitude', message: 'Send both latitude and longitude, or neither' });
else if (hasLat && !(validCoord(body.latitude, 90) && validCoord(body.longitude, 180))) errors.push({ path: 'latitude', message: 'Latitude/longitude must be valid decimal degrees' });

let requiredBy = null;
if (body.required_by != null && body.required_by !== '') {
  const t = Date.parse(body.required_by);
  if (Number.isNaN(t)) errors.push({ path: 'required_by', message: 'Use an ISO date-time, e.g. 2026-09-30T14:00:00+05:30' });
  else requiredBy = new Date(t).toISOString();
}

let escalationMinutes = urgency ? ESCALATION_MINUTES[urgency] : 60;
// Blood needed within 2 hours: escalate at the emergency pace whatever the label
if (requiredBy && Date.parse(requiredBy) - Date.now() < 2 * 3600000) escalationMinutes = Math.min(escalationMinutes, 10);
// Optional override for drills and testing
if (body.escalation_minutes != null) {
  const m = Number(body.escalation_minutes);
  if (!Number.isInteger(m) || m < 1 || m > 60) errors.push({ path: 'escalation_minutes', message: 'Must be a whole number of minutes from 1 to 60' });
  else escalationMinutes = m;
}

const valid = errors.length === 0;
return [{
  json: {
    valid,
    errors,
    received_at_ms: Date.now(),
    request: {
      hospital_name: hospitalName,
      hospital_city: hospitalCity,
      hospital_contact: hospitalContact,
      patient_ref: patientRef || null,
      blood_group: typeof body.blood_group === 'string' ? body.blood_group : null,
      units_required: Number.isInteger(units) ? units : null,
      urgency,
      latitude: hasLat ? body.latitude : null,
      longitude: hasLng ? body.longitude : null,
      required_by: requiredBy,
      escalation_minutes: escalationMinutes,
      wave_size: valid ? waveSize(units, urgency) : null,
      status_token: crypto.randomUUID(),
      hospital_token: crypto.randomUUID(),
    },
  },
}];`
    },
    position: [220, 400]
  },
  output: [{ valid: true, errors: [], received_at_ms: 1790629345206, request: { hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', hospital_contact: '+915550000900', patient_ref: 'ICU-7', blood_group: 'AB+', units_required: 2, urgency: 'Emergency', latitude: 28.5672, longitude: 77.21, required_by: null, escalation_minutes: 10, wave_size: 6, status_token: 'a1', hospital_token: 'b2' } }]
});

const isRequestValid = ifElse({
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
    position: [440, 400]
  }
});

const rejectInvalid = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Invalid Request',
    parameters: { respondWith: 'json', responseBody: expr('{{ { status: "rejected", errors: $json.errors } }}'), options: { responseCode: 400 } },
    position: [660, 620]
  },
  output: [{ status: 'rejected' }]
});

const createRequest = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Create Request',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          hospital_name: expr('{{ $json.request.hospital_name }}'),
          hospital_city: expr('{{ $json.request.hospital_city }}'),
          hospital_contact: expr('{{ $json.request.hospital_contact }}'),
          patient_ref: expr('{{ $json.request.patient_ref }}'),
          blood_group: expr('{{ $json.request.blood_group }}'),
          units_required: expr('{{ $json.request.units_required }}'),
          urgency: expr('{{ $json.request.urgency }}'),
          latitude: expr('{{ $json.request.latitude }}'),
          longitude: expr('{{ $json.request.longitude }}'),
          required_by: expr('{{ $json.request.required_by }}'),
          status: 'Open',
          units_confirmed: 0,
          units_donated: 0,
          compatible_donors: 0,
          donors_notified: 0,
          wave_size: expr('{{ $json.request.wave_size }}'),
          escalation_minutes: expr('{{ $json.request.escalation_minutes }}'),
          escalation_rounds: 0,
          status_token: expr('{{ $json.request.status_token }}'),
          hospital_token: expr('{{ $json.request.hospital_token }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'hospital_name', displayName: 'hospital_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hospital_city', displayName: 'hospital_city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hospital_contact', displayName: 'hospital_contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'patient_ref', displayName: 'patient_ref', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'blood_group', displayName: 'blood_group', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'units_required', displayName: 'units_required', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'urgency', displayName: 'urgency', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'latitude', displayName: 'latitude', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'longitude', displayName: 'longitude', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'required_by', displayName: 'required_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'units_confirmed', displayName: 'units_confirmed', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'units_donated', displayName: 'units_donated', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'compatible_donors', displayName: 'compatible_donors', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'donors_notified', displayName: 'donors_notified', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'wave_size', displayName: 'wave_size', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'escalation_minutes', displayName: 'escalation_minutes', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'escalation_rounds', displayName: 'escalation_rounds', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'status_token', displayName: 'status_token', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hospital_token', displayName: 'hospital_token', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [660, 300]
  },
  output: [{ id: 1, hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', blood_group: 'AB+', units_required: 2, urgency: 'Emergency', latitude: 28.5672, longitude: 77.21, status: 'Open', wave_size: 6, escalation_minutes: 10, status_token: 'a1', hospital_token: 'b2', createdAt: '2026-09-29T10:00:00.000Z' }]
});

const loadRegistry = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Available Donors',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'available', condition: 'isTrue' }] },
      returnAll: true
    },
    position: [880, 300]
  },
  output: [{ id: 3, name: 'Rohan Gupta', phone: '+915550000103', blood_group: 'O+', gender: 'male', city: 'Gurugram', latitude: 28.495, longitude: 77.0895, available: true, last_donation_date: null, total_donations: 0, preferred_channel: 'whatsapp', fcm_token: null, xp_points: 180, committed_until: null }]
});

const compatibilityEngine = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Compatibility Engine',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Same rules as server/src/utils/bloodCompatibility.ts: ABO/Rh-compatible,
// available donors past their deferral window and not already committed to
// another request, within 50 miles (or the hospital's city). Ranked by
// proximity (10-mile bands), then ABO-identical donors first and universal O-
// last (O- is kept for patients who can only take O-), then longest since
// eligible, then XP. The top wave is alerted now; the rest wait in the queue.
const crypto = require('crypto');
const validated = $('Validate & Normalize Request').first().json;
const request = validated.request;
const saved = $('Create Request').first().json;

const COMPATIBLE_DONORS = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};
const DEFERRAL_DAYS = { male: 90, female: 120 };
const RADIUS_MILES = 50;
const CITY_ESTIMATE_MILES = 10;
const DAY = 86400000;
const now = Date.now();

const toRad = (deg) => (deg * Math.PI) / 180;
const distanceMiles = (lat1, lon1, lat2, lon2) => {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const eligibleFrom = (d) => d.last_donation_date
  ? Date.parse(d.last_donation_date + 'T00:00:00Z') + (DEFERRAL_DAYS[d.gender] ?? DEFERRAL_DAYS.female) * DAY
  : null;
const channelFor = (d) => {
  if (d.preferred_channel === 'push' && d.fcm_token) return 'push';
  if (['sms', 'whatsapp', 'push'].includes(d.preferred_channel) && d.phone) return d.preferred_channel === 'push' ? 'sms' : d.preferred_channel;
  return 'in_app';
};
const contactFor = (d, channel) => channel === 'push' ? d.fcm_token : channel === 'in_app' ? null : d.phone;

const compatible = COMPATIBLE_DONORS[request.blood_group] ?? [];
const hasCoords = request.latitude != null && request.longitude != null;
const sameCity = (city) => String(city ?? '').trim().toLowerCase() === request.hospital_city.toLowerCase();

const candidates = [];
for (const item of $input.all()) {
  const d = item.json;
  if (!d.id || d.available !== true || !compatible.includes(d.blood_group)) continue;
  if (d.committed_until && Date.parse(d.committed_until) > now) continue;
  const from = eligibleFrom(d);
  if (from !== null && from > now) continue;

  let distance = null;
  if (hasCoords && d.latitude != null && d.longitude != null) {
    distance = distanceMiles(d.latitude, d.longitude, request.latitude, request.longitude);
    if (distance >= RADIUS_MILES) continue;
  } else if (!sameCity(d.city)) {
    continue;
  }
  const tier = d.blood_group === request.blood_group ? 0 : d.blood_group === 'O-' ? 2 : 1;
  candidates.push({
    d,
    distance,
    tier,
    band: Math.floor((distance ?? CITY_ESTIMATE_MILES) / 10),
    daysEligible: from === null ? 3650 : Math.floor((now - from) / DAY),
  });
}
candidates.sort((a, b) => a.band - b.band || a.tier - b.tier || b.daysEligible - a.daysEligible || (b.d.xp_points ?? 0) - (a.d.xp_points ?? 0));

const summary = {
  request_id: saved.id,
  compatible_groups: compatible,
  compatible_donors: candidates.length,
  match_rule: hasCoords ? 'within ' + RADIUS_MILES + ' miles' : 'same city',
  matched_in_ms: Date.now() - validated.received_at_ms,
};
if (candidates.length === 0) return [{ json: { matched: false, ...summary } }];

const nowIso = new Date(now).toISOString();
return candidates.map((c, i) => {
  const channel = channelFor(c.d);
  const alertNow = i < saved.wave_size;
  return {
    json: {
      matched: true,
      ...summary,
      donor_id: c.d.id,
      donor_blood_group: c.d.blood_group,
      request_blood_group: request.blood_group,
      rank: i + 1,
      distance_miles: c.distance === null ? null : Math.round(c.distance * 10) / 10,
      exact_match: c.tier === 0,
      status: alertNow ? 'notified' : 'queued',
      response_token: crypto.randomUUID(),
      channel,
      contact: contactFor(c.d, channel),
      hospital_name: request.hospital_name,
      hospital_city: request.hospital_city,
      urgency: request.urgency,
      units_required: request.units_required,
      notified_at: alertNow ? nowIso : null,
    },
  };
});`
    },
    position: [1100, 300]
  },
  output: [{ matched: true, request_id: 1, compatible_groups: ['O-', 'O+'], compatible_donors: 9, match_rule: 'within 50 miles', matched_in_ms: 420, donor_id: 3, donor_blood_group: 'O+', request_blood_group: 'AB+', rank: 1, distance_miles: 8.9, exact_match: false, status: 'notified', response_token: 'c3', channel: 'whatsapp', contact: '+915550000103', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', urgency: 'Emergency', units_required: 2, notified_at: '2026-09-29T10:00:00.000Z' }]
});

const anyDonors = ifElse({
  version: 2.3,
  config: {
    name: 'Any Compatible Donors?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.matched }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [1320, 300]
  }
});

const markNoDonors = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Request: No Donors',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.request_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { status: 'Exhausted', closed_reason: 'no_compatible_donors' },
        matchingColumns: [],
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'closed_reason', displayName: 'closed_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1540, 700]
  },
  output: [{ id: 1, status: 'Exhausted' }]
});

const alertNoDonors = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Alert Hospital: No Donors',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'XMjdXMGSnaoeulqE', cachedResultName: 'lifelink_notifications' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          request_id: expr('{{ $("Compatibility Engine").first().json.request_id }}'),
          title: expr('No compatible donors for {{ $("Create Request").first().json.blood_group }} ({{ $("Create Request").first().json.hospital_name }})'),
          message: expr('No available, eligible donors compatible with {{ $("Create Request").first().json.blood_group }} were found {{ $("Compatibility Engine").first().json.match_rule }}. Contact the regional blood bank; the request stays visible on the tracking page.'),
          type: 'no_donors',
          is_read: false,
          channel: 'in_app',
          recipient: expr('hospital:{{ $("Create Request").first().json.hospital_name }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'request_id', displayName: 'request_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'type', displayName: 'type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'is_read', displayName: 'is_read', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'recipient', displayName: 'recipient', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1760, 700]
  },
  output: [{ id: 9, type: 'no_donors' }]
});

const respondNoDonors = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond: No Compatible Donors',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { status: "no_compatible_donors", request_id: $("Create Request").first().json.id, blood_group: $("Create Request").first().json.blood_group, compatible_groups: $("Compatibility Engine").first().json.compatible_groups, match_rule: $("Compatibility Engine").first().json.match_rule, tracking_url: "https://amitsingh7291.app.n8n.cloud/webhook/lifelink/request-status?token=" + $("Create Request").first().json.status_token, message: "No available, eligible compatible donors right now. The hospital has been alerted to contact the regional blood bank." } }}'),
      options: { responseCode: 201 }
    },
    position: [1980, 700]
  },
  output: [{ status: 'no_compatible_donors' }]
});

const saveMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Ranked Matches',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          request_id: expr('{{ $json.request_id }}'),
          donor_id: expr('{{ $json.donor_id }}'),
          donor_blood_group: expr('{{ $json.donor_blood_group }}'),
          request_blood_group: expr('{{ $json.request_blood_group }}'),
          rank: expr('{{ $json.rank }}'),
          distance_miles: expr('{{ $json.distance_miles }}'),
          exact_match: expr('{{ $json.exact_match }}'),
          status: expr('{{ $json.status }}'),
          response_token: expr('{{ $json.response_token }}'),
          channel: expr('{{ $json.channel }}'),
          contact: expr('{{ $json.contact }}'),
          hospital_name: expr('{{ $json.hospital_name }}'),
          hospital_city: expr('{{ $json.hospital_city }}'),
          urgency: expr('{{ $json.urgency }}'),
          units_required: expr('{{ $json.units_required }}'),
          notified_at: expr('{{ $json.notified_at }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'request_id', displayName: 'request_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'donor_id', displayName: 'donor_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'donor_blood_group', displayName: 'donor_blood_group', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'request_blood_group', displayName: 'request_blood_group', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'rank', displayName: 'rank', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'distance_miles', displayName: 'distance_miles', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'exact_match', displayName: 'exact_match', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'response_token', displayName: 'response_token', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'contact', displayName: 'contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hospital_name', displayName: 'hospital_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hospital_city', displayName: 'hospital_city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'urgency', displayName: 'urgency', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'units_required', displayName: 'units_required', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'notified_at', displayName: 'notified_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1540, 200]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, donor_blood_group: 'O+', request_blood_group: 'AB+', rank: 1, distance_miles: 8.9, status: 'notified', response_token: 'c3', channel: 'whatsapp', contact: '+915550000103', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', urgency: 'Emergency', units_required: 2, notified_at: '2026-09-29T10:00:00.000Z' }]
});

const firstWave = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: {
    name: 'First Wave Only',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.status }}'), rightValue: 'notified', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      }
    },
    position: [1760, 100]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, donor_blood_group: 'O+', request_blood_group: 'AB+', rank: 1, distance_miles: 8.9, status: 'notified', response_token: 'c3', channel: 'whatsapp', contact: '+915550000103', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', urgency: 'Emergency', units_required: 2, notified_at: '2026-09-29T10:00:00.000Z' }]
});

const composeAlert = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Compose Donor Alert',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'a-match', name: 'match_id', value: expr('{{ $json.id }}'), type: 'number' },
          { id: 'a-donor', name: 'donor_id', value: expr('{{ $json.donor_id }}'), type: 'number' },
          { id: 'a-request', name: 'request_id', value: expr('{{ $json.request_id }}'), type: 'number' },
          { id: 'a-channel', name: 'channel', value: expr('{{ $json.channel }}'), type: 'string' },
          { id: 'a-contact', name: 'contact', value: expr('{{ $json.contact }}'), type: 'string' },
          { id: 'a-accept', name: 'accept_url', value: expr('https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m={{ $json.id }}&t={{ $json.response_token }}&a=accept'), type: 'string' },
          { id: 'a-decline', name: 'decline_url', value: expr('https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m={{ $json.id }}&t={{ $json.response_token }}&a=decline'), type: 'string' },
          { id: 'a-title', name: 'title', value: expr('{{ $json.urgency }}: {{ $json.request_blood_group }} blood needed at {{ $json.hospital_name }}'), type: 'string' },
          { id: 'a-message', name: 'message', value: expr('{{ $json.hospital_name }} ({{ $json.hospital_city }}) needs {{ $json.units_required }} unit(s) for a {{ $json.request_blood_group }} patient{{ $json.distance_miles != null ? ", " + $json.distance_miles + " miles from you" : "" }}. Your {{ $json.donor_blood_group }} blood is compatible. Can you donate today? Tap YES or NO.'), type: 'string' },
          { id: 'a-sms', name: 'sms_text', value: expr('LifeLink {{ $json.urgency }}: {{ $json.request_blood_group }} blood needed at {{ $json.hospital_name }}{{ $json.distance_miles != null ? " (" + $json.distance_miles + " mi)" : "" }}. Can you donate today? YES: https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m={{ $json.id }}&t={{ $json.response_token }}&a=accept NO: https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m={{ $json.id }}&t={{ $json.response_token }}&a=decline'), type: 'string' },
          { id: 'a-hospital', name: 'hospital_name', value: expr('{{ $json.hospital_name }}'), type: 'string' },
          { id: 'a-group', name: 'request_blood_group', value: expr('{{ $json.request_blood_group }}'), type: 'string' }
        ]
      },
      options: {}
    },
    position: [1980, 100]
  },
  output: [{ match_id: 11, donor_id: 3, request_id: 1, channel: 'whatsapp', contact: '+915550000103', accept_url: 'https://x/accept', decline_url: 'https://x/decline', title: 'Emergency: AB+ blood needed at AIIMS Trauma Centre', message: 'm', sms_text: 's', hospital_name: 'AIIMS Trauma Centre', request_blood_group: 'AB+' }]
});

const createInApp = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Create In-App Notifications',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'XMjdXMGSnaoeulqE', cachedResultName: 'lifelink_notifications' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          user_id: expr('{{ $json.donor_id }}'),
          request_id: expr('{{ $json.request_id }}'),
          match_id: expr('{{ $json.match_id }}'),
          title: expr('{{ $json.title }}'),
          message: expr('{{ $json.message }} YES: {{ $json.accept_url }} NO: {{ $json.decline_url }}'),
          type: 'blood_request',
          is_read: false,
          channel: expr('{{ $json.channel }}'),
          recipient: expr('donor:{{ $json.donor_id }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'user_id', displayName: 'user_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'request_id', displayName: 'request_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'match_id', displayName: 'match_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'type', displayName: 'type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'is_read', displayName: 'is_read', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'recipient', displayName: 'recipient', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [2200, 0]
  },
  output: [{ id: 20, user_id: 3, request_id: 1, match_id: 11, type: 'blood_request' }]
});

const routeChannel = switchCase({
  version: 3.4,
  config: {
    name: 'Route by Channel',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { renameOutput: true, outputKey: 'sms', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.channel }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'sms' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'whatsapp', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.channel }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'whatsapp' }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'push', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.channel }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'push' }], combinator: 'and' } }
        ]
      },
      options: {}
    },
    position: [2200, 220]
  }
});

const sendSms = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'Send SMS (Twilio)',
    disabled: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Your Twilio sender number, e.g. +14155550100'),
      to: expr('{{ $json.contact }}'),
      toWhatsapp: false,
      message: expr('{{ $json.sms_text }}'),
      options: {}
    },
    credentials: { twilioApi: newCredential('Twilio') },
    position: [2420, 120]
  },
  output: [{ sid: 'SM1', status: 'queued' }]
});

const sendWhatsApp = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'Send WhatsApp (Business API)',
    disabled: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendTemplate',
      phoneNumberId: placeholder('WhatsApp Business phone number ID'),
      recipientPhoneNumber: expr('{{ $json.contact }}'),
      template: placeholder('Approved template, e.g. lifelink_blood_request|en'),
      components: {
        component: [
          {
            type: 'body',
            bodyParameters: {
              parameter: [
                { type: 'text', text: expr('{{ $json.request_blood_group }}') },
                { type: 'text', text: expr('{{ $json.hospital_name }}') },
                { type: 'text', text: expr('{{ $json.accept_url }}') },
                { type: 'text', text: expr('{{ $json.decline_url }}') }
              ]
            }
          }
        ]
      }
    },
    credentials: { whatsAppApi: newCredential('WhatsApp Business') },
    position: [2420, 240]
  },
  output: [{ messaging_product: 'whatsapp' }]
});

const sendPush = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Send Push (Firebase FCM)',
    disabled: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: placeholder('https://fcm.googleapis.com/v1/projects/<firebase-project-id>/messages:send'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { message: { token: $json.contact, notification: { title: $json.title, body: $json.message }, data: { match_id: String($json.match_id), accept_url: $json.accept_url, decline_url: $json.decline_url } } } }}'),
      options: {}
    },
    credentials: { googleApi: newCredential('Firebase service account') },
    position: [2420, 360]
  },
  output: [{ name: 'projects/x/messages/1' }]
});

const recordDispatch = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Record Dispatch Counts',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Create Request").first().json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          compatible_donors: expr('{{ $("Compatibility Engine").all().length }}'),
          donors_notified: expr('{{ $("Save Ranked Matches").all().filter(i => i.json.status === "notified").length }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'compatible_donors', displayName: 'compatible_donors', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'donors_notified', displayName: 'donors_notified', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1760, 420]
  },
  output: [{ id: 1, compatible_donors: 9, donors_notified: 6 }]
});

const respondDispatched = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond: Request Dispatched',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { status: "dispatched", request_id: $("Create Request").first().json.id, blood_group: $("Create Request").first().json.blood_group, urgency: $("Create Request").first().json.urgency, units_required: $("Create Request").first().json.units_required, compatible_groups: $("Compatibility Engine").first().json.compatible_groups, match_rule: $("Compatibility Engine").first().json.match_rule, matched_in_ms: $("Compatibility Engine").first().json.matched_in_ms, compatible_donors: $("Compatibility Engine").all().length, donors_alerted: $("Save Ranked Matches").all().filter(i => i.json.status === "notified").map(i => ({ rank: i.json.rank, blood_group: i.json.donor_blood_group, distance_miles: i.json.distance_miles, channel: i.json.channel })), donors_on_standby: $("Save Ranked Matches").all().filter(i => i.json.status === "queued").length, escalation_minutes: $("Create Request").first().json.escalation_minutes, next_escalation_at: $now.plus({ minutes: $("Create Request").first().json.escalation_minutes }).toISO(), tracking_url: "https://amitsingh7291.app.n8n.cloud/webhook/lifelink/request-status?token=" + $("Create Request").first().json.status_token, hospital_token: $("Create Request").first().json.hospital_token, hospital_actions: "Confirm a donation: GET /webhook/lifelink/donor-response?m=<match_id>&h=<hospital_token>&a=donated (or a=no_show). Cancel: /webhook/lifelink/donor-response?r=<request_id>&h=<hospital_token>&a=cancel" } }}'),
      options: { responseCode: 201 }
    },
    position: [1980, 420]
  },
  output: [{ status: 'dispatched' }]
});

const waitForResponses = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Wait for Donor Responses',
    parameters: {
      resume: 'timeInterval',
      amount: expr('{{ $("Plan Escalation").isExecuted && $("Plan Escalation").first().json.action === "watch" && $("Plan Escalation").first().json.reason === "enough donors committed" ? Math.max(30, $("Create Request").first().json.escalation_minutes) : $("Create Request").first().json.escalation_minutes }}'),
      unit: 'minutes'
    },
    position: [2200, 520]
  },
  output: [{ id: 1 }]
});

const loadRequestState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Request State',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Create Request").first().json.id }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [2420, 520]
  },
  output: [{ id: 1, status: 'Open', units_required: 2, urgency: 'Emergency', escalation_minutes: 10, wave_size: 6, donors_notified: 6, createdAt: '2026-09-29T10:00:00.000Z' }]
});

const loadMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Request Matches',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'request_id', condition: 'eq', keyValue: expr('{{ $("Create Request").first().json.id }}') }] },
      returnAll: true
    },
    position: [2640, 520]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, rank: 1, status: 'notified', notified_at: '2026-09-29T10:00:00.000Z', channel: 'whatsapp', contact: '+915550000103' }]
});

const reloadRegistry = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Reload Donor Registry',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      returnAll: true
    },
    position: [2860, 520]
  },
  output: [{ id: 3, available: true, gender: 'male', last_donation_date: null, committed_until: null, preferred_channel: 'whatsapp', phone: '+915550000103', fcm_token: null }]
});

const planEscalation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan Escalation',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// One escalation round: expire alerts nobody answered within the window,
// then alert the next ranked queued donors who are still available, eligible
// and not committed elsewhere, keeping one wave of alerts outstanding for the
// units still needed. Stops once the request is completed, cancelled or
// exhausted, or after MAX_HOURS.
const MAX_HOURS = 12;
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;
const waveSize = (units, urgency) => urgency === 'Emergency' ? Math.min(10, Math.max(3, units * 3))
  : urgency === 'Urgent' ? Math.min(8, Math.max(2, units * 2))
  : Math.min(6, Math.max(2, units + 1));

const req = $('Load Request State').first().json;
const matches = $('Load Request Matches').all().map((i) => i.json).filter((m) => m.id);
const donors = new Map($input.all().map((i) => i.json).filter((d) => d.id).map((d) => [d.id, d]));
const now = Date.now();
const nowIso = new Date(now).toISOString();
const round = $runIndex + 1;
const base = { request_id: req.id, round, updates: [], notified_now: 0, expired_now: 0 };

const eligibleNow = (d) => {
  if (!d || d.available !== true) return false;
  if (d.committed_until && Date.parse(d.committed_until) > now) return false;
  if (!d.last_donation_date) return true;
  return Date.parse(d.last_donation_date + 'T00:00:00Z') + (DEFERRAL_DAYS[d.gender] ?? DEFERRAL_DAYS.female) * DAY <= now;
};
const channelFor = (d) => {
  if (d.preferred_channel === 'push' && d.fcm_token) return 'push';
  if (['sms', 'whatsapp', 'push'].includes(d.preferred_channel) && d.phone) return d.preferred_channel === 'push' ? 'sms' : d.preferred_channel;
  return 'in_app';
};
const contactFor = (d, channel) => channel === 'push' ? d.fcm_token : channel === 'in_app' ? null : d.phone;

if (!req.id || ['Completed', 'Cancelled', 'Exhausted'].includes(req.status)) {
  return [{ json: { ...base, action: 'stop', reason: 'request ' + (req.status || 'missing') } }];
}

const committed = matches.filter((m) => m.status === 'accepted' || m.status === 'donated').length;
const need = req.units_required - committed;
const ageHours = (now - Date.parse(req.createdAt)) / 3600000;
if (ageHours >= MAX_HOURS) {
  return [{ json: { ...base, action: need > 0 ? 'exhausted' : 'stop', reason: 'timed_out' } }];
}
// Enough donors have committed: keep watching (a withdrawal or no-show reopens the request)
if (need <= 0) return [{ json: { ...base, action: 'watch', reason: 'enough donors committed', donors_notified_total: req.donors_notified } }];

const windowMs = req.escalation_minutes * 60000;
const stale = matches.filter((m) => m.status === 'notified' && now - Date.parse(m.notified_at) >= windowMs);
const outstanding = matches.filter((m) => m.status === 'notified').length - stale.length;
const queued = matches.filter((m) => m.status === 'queued').sort((a, b) => a.rank - b.rank);
const skipped = queued.filter((m) => !eligibleNow(donors.get(m.donor_id)));
const next = queued.filter((m) => eligibleNow(donors.get(m.donor_id)))
  .slice(0, Math.max(0, waveSize(need, req.urgency) - outstanding));

const updates = [
  ...stale.map((m) => ({ id: m.id, status: 'expired', notified_at: m.notified_at, channel: m.channel, contact: m.contact })),
  ...skipped.map((m) => ({ id: m.id, status: 'skipped', notified_at: m.notified_at, channel: m.channel, contact: m.contact })),
  ...next.map((m) => {
    const d = donors.get(m.donor_id);
    const channel = channelFor(d);
    return { id: m.id, status: 'notified', notified_at: nowIso, channel, contact: contactFor(d, channel) };
  }),
];
const result = {
  ...base,
  updates,
  notified_now: next.length,
  expired_now: stale.length,
  need,
  outstanding: outstanding + next.length,
  donors_notified_total: (req.donors_notified ?? 0) + next.length,
};
if (outstanding + next.length === 0) return [{ json: { ...result, action: 'exhausted', reason: 'all_compatible_donors_asked' } }];
return [{ json: { ...result, action: next.length > 0 || stale.length > 0 ? 'escalate' : 'watch' } }];`
    },
    position: [3080, 520]
  },
  output: [{ request_id: 1, round: 1, action: 'escalate', reason: '', updates: [{ id: 12, status: 'expired', notified_at: '2026-09-29T10:00:00.000Z', channel: 'sms', contact: '+915550000101' }], notified_now: 1, expired_now: 1, need: 1, outstanding: 3, donors_notified_total: 7 }]
});

const splitUpdates = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'One Item per Match Update',
    parameters: { fieldToSplitOut: 'updates', include: 'noOtherFields', options: {} },
    position: [3300, 380]
  },
  output: [{ id: 12, status: 'expired', notified_at: '2026-09-29T10:00:00.000Z', channel: 'sms', contact: '+915550000101' }]
});

const applyUpdates = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Apply Match Updates',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: expr('{{ $json.status }}'),
          notified_at: expr('{{ $json.notified_at }}'),
          channel: expr('{{ $json.channel }}'),
          contact: expr('{{ $json.contact }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notified_at', displayName: 'notified_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'contact', displayName: 'contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [3520, 380]
  },
  output: [{ id: 17, request_id: 1, donor_id: 9, status: 'notified', response_token: 'd4', urgency: 'Emergency', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', request_blood_group: 'AB+', donor_blood_group: 'A+', units_required: 2, distance_miles: null, channel: 'sms', contact: '+915550000109' }]
});

const newlyNotified = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: {
    name: 'Newly Alerted Donors',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.status }}'), rightValue: 'notified', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      }
    },
    position: [3740, 380]
  },
  output: [{ id: 17, request_id: 1, donor_id: 3, donor_blood_group: 'O+', request_blood_group: 'AB+', rank: 1, distance_miles: 8.9, status: 'notified', response_token: 'c3', channel: 'whatsapp', contact: '+915550000103', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', urgency: 'Emergency', units_required: 2, notified_at: '2026-09-29T10:00:00.000Z' }]
});

const nextStep = switchCase({
  version: 3.4,
  config: {
    name: 'Next Step',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { renameOutput: true, outputKey: 'keep waiting', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ ["escalate", "watch"].includes($json.action) }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'exhausted', conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'exhausted' }], combinator: 'and' } }
        ]
      },
      options: {}
    },
    position: [3300, 680]
  }
});

const recordRound = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Record Escalation Round',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.request_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          escalation_rounds: expr('{{ $json.round }}'),
          donors_notified: expr('{{ $json.donors_notified_total }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'escalation_rounds', displayName: 'escalation_rounds', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'donors_notified', displayName: 'donors_notified', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [3520, 620]
  },
  output: [{ id: 1, escalation_rounds: 1 }]
});

const closeExhausted = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Close Request: Exhausted',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.request_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: 'Exhausted',
          closed_reason: expr('{{ $json.reason }}'),
          escalation_rounds: expr('{{ $json.round }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'closed_reason', displayName: 'closed_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'escalation_rounds', displayName: 'escalation_rounds', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [3520, 820]
  },
  output: [{ id: 1, status: 'Exhausted' }]
});

const alertExhausted = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Alert Hospital: Donors Exhausted',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'XMjdXMGSnaoeulqE', cachedResultName: 'lifelink_notifications' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          request_id: expr('{{ $("Load Request State").first().json.id }}'),
          title: expr('Donor search exhausted: {{ $("Load Request State").first().json.blood_group }} for {{ $("Load Request State").first().json.hospital_name }}'),
          message: expr('Every compatible donor in range has been alerted without covering all {{ $("Load Request State").first().json.units_required }} unit(s) ({{ $("Plan Escalation").first().json.reason }}). Contact the regional blood bank; late donor replies will still be recorded.'),
          type: 'donors_exhausted',
          is_read: false,
          channel: 'in_app',
          recipient: expr('hospital:{{ $("Load Request State").first().json.hospital_name }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'request_id', displayName: 'request_id', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'type', displayName: 'type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'is_read', displayName: 'is_read', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'recipient', displayName: 'recipient', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [3740, 820]
  },
  output: [{ id: 30, type: 'donors_exhausted' }]
});

const overview = sticky("## LifeLink emergency dispatch (spec stages 3-6)\n1. **Request initiation** – hospital posts the request (dashboard, AI agent or API).\n2. **Compatibility engine** – ABO/Rh rules, deferral window, availability, ranked by proximity then eligibility.\n3. **Notification engine** – in-app always; SMS / WhatsApp / push nodes are ready but **disabled until you add their credentials**.\n4. **Auto-escalation** – waits the urgency window, expires silent alerts and alerts the next ranked donors; alerts the hospital when nobody is left.\n\nDonor replies, fulfilment and donation logging live in **LifeLink – Donor Response & Fulfilment**.", [requestWebhook, validateRequest], { color: 5, position: [-40, -40], width: 640, height: 320 });

const channelNote = sticky("### Enable real delivery\nAdd a Twilio, WhatsApp Business or Google service-account (FCM) credential, fill the placeholder, then enable the node. Seed donors use invalid +91 555… numbers so tests can never text a real person.", [sendSms, sendWhatsApp, sendPush], { color: 4, position: [2380, -120], width: 360, height: 180 });

export default workflow('lifelink-emergency-dispatch-v2', 'LifeLink – Emergency Blood Request Dispatch')
  .add(requestWebhook)
  .to(validateRequest)
  .to(isRequestValid
    .onTrue(createRequest.to(loadRegistry.to(compatibilityEngine.to(anyDonors
      .onTrue(saveMatches)
      .onFalse(markNoDonors.to(alertNoDonors.to(respondNoDonors)))))))
    .onFalse(rejectInvalid))
  .add(saveMatches)
  .to(firstWave.to(composeAlert))
  .add(saveMatches)
  .to(recordDispatch.to(respondDispatched.to(waitForResponses.to(loadRequestState.to(loadMatches.to(reloadRegistry.to(planEscalation)))))))
  .add(composeAlert)
  .to(createInApp)
  .add(composeAlert)
  .to(routeChannel
    .onCase(0, sendSms)
    .onCase(1, sendWhatsApp)
    .onCase(2, sendPush))
  .add(planEscalation)
  .to(splitUpdates.to(applyUpdates.to(newlyNotified.to(composeAlert))))
  .add(planEscalation)
  .to(nextStep
    .onCase(0, recordRound.to(waitForResponses))
    .onCase(1, closeExhausted.to(alertExhausted)))
  .add(overview)
  .add(channelNote)
  .group('Validate request', [validateRequest, isRequestValid], { description: 'Backend schema rules plus hospital contact, patient reference, deadline and escalation window.' })
  .group('Compatibility engine', [createRequest, loadRegistry, compatibilityEngine], { description: 'Stores the request, then ranks ABO/Rh-compatible, eligible, available donors by proximity and eligibility.' })
  .group('No compatible donors', [markNoDonors, alertNoDonors, respondNoDonors], { description: 'Closes the request as exhausted, alerts the hospital and answers 201 with the tracking link.' })
  .group('Notification engine', [composeAlert, createInApp, routeChannel, sendSms, sendWhatsApp, sendPush], { description: 'One-tap YES/NO alert per donor: in-app always, plus SMS / WhatsApp / push once credentials exist.' })
  .group('Confirm dispatch', [recordDispatch, respondDispatched], { description: 'Records how many donors were found and alerted, and returns 201 with the tracking link.' })
  .group('Auto-escalation loop', [loadRequestState, loadMatches, reloadRegistry, planEscalation], { description: 'After each window, re-reads replies and availability and plans who to alert next.' })
  .group('Apply escalation', [splitUpdates, applyUpdates, newlyNotified], { description: 'Expires silent alerts, skips donors no longer eligible, and alerts the next ranked donors.' })
  .group('Next round or exhausted', [nextStep, recordRound, closeExhausted, alertExhausted], { description: 'Loops back to wait, or closes the request and tells the hospital to contact the blood bank.' });

import { workflow, node, trigger, sticky, placeholder, newCredential, expr } from '@n8n/workflow-sdk';

const responseWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Response Link Opened',
    parameters: { httpMethod: 'GET', path: 'lifelink/donor-response', responseMode: 'responseNode', options: { ignoreBots: true } },
    position: [0, 400]
  },
  output: [{ query: { m: '11', t: '6f1c2b3a-1111-4222-8333-944455556666', a: 'accept' } }]
});

const parseLink = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Link',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Donor links carry the match id + its response token; hospital links carry
// the request's hospital token (never shown to donors or on the tracking page).
const q = $input.first().json.query ?? {};
const action = String(q.a ?? '').toLowerCase();
const isInt = (v) => /^\\d{1,9}$/.test(String(v ?? ''));
const isToken = (v) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));

let kind = 'invalid';
if (['accept', 'decline'].includes(action) && isInt(q.m) && isToken(q.t)) kind = 'donor';
else if (['donated', 'no_show'].includes(action) && isInt(q.m) && isToken(q.h)) kind = 'hospital_match';
else if (action === 'cancel' && isInt(q.r) && isToken(q.h)) kind = 'hospital_request';

return [{
  json: {
    kind,
    action,
    format: q.format === 'json' ? 'json' : 'html',
    match_id: isInt(q.m) ? Number(q.m) : 0,
    request_id: isInt(q.r) ? Number(q.r) : 0,
    token: isToken(q.t) ? String(q.t).toLowerCase() : null,
    hospital_token: isToken(q.h) ? String(q.h).toLowerCase() : null,
  },
}];`
    },
    position: [220, 400]
  },
  output: [{ kind: 'donor', action: 'accept', format: 'html', match_id: 11, request_id: 0, token: '6f1c2b3a-1111-4222-8333-944455556666', hospital_token: null }]
});

const findMatch = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Match',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.match_id }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [440, 400]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, donor_blood_group: 'O+', request_blood_group: 'AB+', rank: 1, distance_miles: 8.9, status: 'notified', response_token: '6f1c2b3a-1111-4222-8333-944455556666', hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi' }]
});

const findRequest = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Request',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Parse Link").first().json.request_id || $("Find Match").first().json.request_id || 0 }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [660, 400]
  },
  output: [{ id: 1, hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', hospital_contact: '+915550000900', blood_group: 'AB+', units_required: 2, status: 'Open', units_confirmed: 0, units_donated: 0, hospital_token: '7a1c2b3a-1111-4222-8333-944455556666', createdAt: '2026-09-29T10:00:00.000Z' }]
});

const loadRequestMatches = node({
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
      filters: { conditions: [{ keyName: 'request_id', condition: 'eq', keyValue: expr('{{ $("Find Request").first().json.id || 0 }}') }] },
      returnAll: true
    },
    position: [880, 400]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, status: 'notified' }]
});

const findDonor = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Donor',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Find Match").first().json.donor_id || 0 }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [1100, 400]
  },
  output: [{ id: 3, name: 'Rohan Gupta', phone: '+915550000103', total_donations: 0, xp_points: 180, committed_until: null }]
});

const loadDonorMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Donor Matches',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'donor_id', condition: 'eq', keyValue: expr('{{ $("Find Match").first().json.donor_id || 0 }}') }] },
      returnAll: true
    },
    position: [1320, 400]
  },
  output: [{ id: 11, request_id: 1, donor_id: 3, status: 'notified', hospital_name: 'AIIMS Trauma Centre' }]
});

const decideOutcome = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Outcome',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Applies one donor reply or hospital confirmation to the request state and
// renders the reply page. Every write is returned as a list so the branches
// after this node only run for the changes that are actually needed.
const HOURS_COMMITTED = 24;
const XP_PER_DONATION = 10;
const BASE = 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink';

const p = $('Parse Link').first().json;
const match = $('Find Match').first().json;
const req = $('Find Request').first().json;
const reqMatches = $('Load Request Matches').all().map((i) => i.json).filter((m) => m.id);
const donor = $('Find Donor').first().json;
const donorMatches = $('Load Donor Matches').all().map((i) => i.json).filter((m) => m.id);
const now = new Date();
const nowIso = now.toISOString();
const today = nowIso.slice(0, 10);

const out = { match_updates: [], request_updates: [], donor_commitments: [], donations: [], notifications: [], hospital_sms: [] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (n) => String(n ?? '').trim().split(/\\s+/)[0] || 'there';

const statusOf = (m, overrides) => overrides[m.id] ?? m.status;
const committedCount = (overrides) => reqMatches.filter((m) => ['accepted', 'donated'].includes(statusOf(m, overrides))).length;
const donatedCount = (overrides) => reqMatches.filter((m) => statusOf(m, overrides) === 'donated').length;
const setMatch = (m, s) => out.match_updates.push({ id: m.id, status: s, responded_at: nowIso });
const requestUpdate = (fields) => out.request_updates.push({
  id: req.id,
  status: req.status,
  units_confirmed: req.units_confirmed ?? 0,
  units_donated: req.units_donated ?? 0,
  first_accept_at: req.first_accept_at ?? null,
  fulfilled_at: req.fulfilled_at ?? null,
  closed_reason: req.closed_reason ?? null,
  ...fields,
});
// Fulfilment stands down only donors already alerted; standby donors stay
// queued so a withdrawal or no-show can still escalate to them.
const closeOutstanding = (overrides, statuses) => {
  for (const m of reqMatches) {
    if (statuses.includes(statusOf(m, overrides))) {
      overrides[m.id] = 'not_needed';
      setMatch(m, 'not_needed');
    }
  }
};
const hospitalNote = (type, title, message) => {
  out.notifications.push({ user_id: null, request_id: req.id, match_id: match.id ?? null, title, message, type, channel: 'in_app', recipient: 'hospital:' + req.hospital_name });
  if (req.hospital_contact) out.hospital_sms.push({ to: req.hospital_contact, text: 'LifeLink: ' + title + '. ' + message });
};
const hospitalLinks = (m) => ' Confirm donation: ' + BASE + '/donor-response?m=' + m.id + '&h=' + req.hospital_token + '&a=donated | No-show: '
  + BASE + '/donor-response?m=' + m.id + '&h=' + req.hospital_token + '&a=no_show';

const donorLinkOk = p.kind === 'donor' && match.id && req.id && match.request_id === req.id && match.response_token === p.token;
const hospitalLinkOk = req.id && req.hospital_token === p.hospital_token
  && (p.kind === 'hospital_request' || (p.kind === 'hospital_match' && match.id && match.request_id === req.id));

let outcome;
let httpStatus = 200;
let tone = 'ok';
let title;
let message;
const overrides = {};

if (!donorLinkOk && !hospitalLinkOk) {
  outcome = 'invalid_link';
  httpStatus = p.kind === 'invalid' ? 400 : 404;
  tone = 'warn';
  title = 'This link is not valid';
  message = 'It may be mistyped or out of date. To help, open the LifeLink app or dial the LifeLink USSD code.';
} else if (p.kind === 'donor' && p.action === 'accept') {
  const elsewhere = donorMatches.find((m) => m.request_id !== req.id && m.status === 'accepted');
  if (['accepted', 'donated'].includes(match.status)) {
    outcome = 'already_accepted';
    title = 'You are already confirmed';
    message = req.hospital_name + ' is expecting you. Thank you!';
  } else if (['Fulfilled', 'Completed', 'Cancelled'].includes(req.status)) {
    outcome = 'not_needed';
    title = 'Thank you, this request is covered';
    message = 'Enough donors have already confirmed for ' + req.hospital_name + '. We will alert you the next time your blood group is needed.';
    if (!['not_needed', 'superseded'].includes(match.status)) setMatch(match, 'not_needed');
  } else if (elsewhere) {
    outcome = 'committed_elsewhere';
    tone = 'warn';
    title = 'You are already booked';
    message = 'You have already accepted a request from ' + elsewhere.hospital_name + '. Thank you for helping!';
  } else {
    outcome = 'accepted';
    overrides[match.id] = 'accepted';
    setMatch(match, 'accepted');
    const committed = committedCount(overrides);
    const fulfilled = committed >= req.units_required;
    if (fulfilled) closeOutstanding(overrides, ['notified']);
    requestUpdate({
      status: fulfilled ? 'Fulfilled' : req.status,
      units_confirmed: committed,
      first_accept_at: req.first_accept_at || nowIso,
      fulfilled_at: fulfilled ? nowIso : null,
    });
    out.donor_commitments.push({ id: donor.id, committed_until: new Date(now.getTime() + HOURS_COMMITTED * 3600000).toISOString() });
    for (const m of donorMatches) {
      if (m.request_id !== req.id && ['notified', 'queued'].includes(m.status)) setMatch(m, 'superseded');
    }
    const minutes = Math.max(0, Math.round((now - Date.parse(req.createdAt)) / 60000));
    hospitalNote(
      'donor_accepted',
      'Donor confirmed for ' + req.blood_group + ' (' + committed + '/' + req.units_required + ' units)',
      firstName(donor.name) + ' (' + match.donor_blood_group + (match.distance_miles != null ? ', ' + match.distance_miles + ' mi away' : '')
        + ', phone ' + (donor.phone || 'n/a') + ') accepted ' + minutes + ' min after the request.'
        + (fulfilled ? ' All units are now covered.' : '') + hospitalLinks(match),
    );
    title = 'Thank you, ' + firstName(donor.name) + '!';
    message = req.hospital_name + ' (' + req.hospital_city + ') has been told you are coming. Please go today with a photo ID and eat a light meal first. If your plans change, open the NO link so we can alert someone else.';
  }
} else if (p.kind === 'donor') {
  if (match.status === 'donated') {
    outcome = 'already_donated';
    title = 'Your donation is recorded';
    message = 'Thank you for donating!';
  } else if (match.status === 'accepted' && !['Completed', 'Cancelled'].includes(req.status)) {
    outcome = 'withdrawn';
    tone = 'warn';
    overrides[match.id] = 'declined';
    setMatch(match, 'declined');
    const committed = committedCount(overrides);
    const reopened = req.status === 'Fulfilled' && committed < req.units_required;
    requestUpdate({ status: reopened ? 'Open' : req.status, units_confirmed: committed, fulfilled_at: reopened ? null : req.fulfilled_at ?? null });
    out.donor_commitments.push({ id: donor.id, committed_until: null });
    hospitalNote(
      'donor_withdrew',
      'A donor withdrew for ' + req.blood_group + ' (' + committed + '/' + req.units_required + ' units)',
      firstName(donor.name) + ' can no longer come.' + (reopened || req.status === 'Open' ? ' LifeLink is alerting the next ranked donors.' : ''),
    );
    title = 'Thanks for letting us know';
    message = 'We have told ' + req.hospital_name + ' and will alert the next donor.';
  } else if (match.status === 'declined') {
    outcome = 'already_declined';
    title = 'No problem';
    message = 'We have already noted that you cannot donate this time.';
  } else {
    outcome = 'declined';
    setMatch(match, 'declined');
    title = 'No problem, thank you';
    message = 'We will alert the next donor. You stay on the list for future requests.';
  }
} else if (p.kind === 'hospital_match' && p.action === 'donated') {
  if (match.status === 'donated') {
    outcome = 'already_recorded';
    title = 'Donation already recorded';
    message = 'Nothing else to do.';
  } else {
    outcome = 'donation_recorded';
    overrides[match.id] = 'donated';
    setMatch(match, 'donated');
    const donated = donatedCount(overrides);
    const committed = committedCount(overrides);
    const completed = donated >= req.units_required;
    if (completed) closeOutstanding(overrides, ['notified', 'queued']);
    requestUpdate({
      status: completed ? 'Completed' : committed >= req.units_required ? 'Fulfilled' : req.status,
      units_confirmed: committed,
      units_donated: donated,
      first_accept_at: req.first_accept_at || nowIso,
      fulfilled_at: req.fulfilled_at || (committed >= req.units_required ? nowIso : null),
      closed_reason: completed ? 'all_units_donated' : req.closed_reason ?? null,
    });
    out.donations.push({
      id: donor.id,
      last_donation_date: today,
      total_donations: (donor.total_donations ?? 0) + 1,
      xp_points: (donor.xp_points ?? 0) + XP_PER_DONATION,
      committed_until: null,
    });
    out.notifications.push({
      user_id: donor.id, request_id: req.id, match_id: match.id, type: 'donation_recorded', channel: 'in_app', recipient: 'donor:' + donor.id,
      title: 'Thank you for donating!',
      message: 'Your donation at ' + req.hospital_name + ' is recorded (+' + XP_PER_DONATION + ' XP). You can donate again after your rest period.',
    });
    title = 'Donation recorded';
    message = donated + ' of ' + req.units_required + ' units donated for this request.' + (completed ? ' The request is now complete.' : '');
  }
} else if (p.kind === 'hospital_match') {
  if (match.status !== 'accepted') {
    outcome = 'not_applicable';
    tone = 'warn';
    title = 'Nothing to change';
    message = 'This donor is not currently confirmed (status: ' + match.status + ').';
  } else {
    outcome = 'no_show_recorded';
    tone = 'warn';
    overrides[match.id] = 'no_show';
    setMatch(match, 'no_show');
    const committed = committedCount(overrides);
    const reopened = req.status === 'Fulfilled' && committed < req.units_required;
    requestUpdate({ status: reopened ? 'Open' : req.status, units_confirmed: committed, fulfilled_at: reopened ? null : req.fulfilled_at ?? null });
    out.donor_commitments.push({ id: donor.id, committed_until: null });
    title = 'No-show recorded';
    message = committed + ' of ' + req.units_required + ' units still confirmed.' + (reopened ? ' The request is reopened and LifeLink is alerting the next donors.' : '');
  }
} else if (['Cancelled', 'Completed'].includes(req.status)) {
  outcome = 'already_closed';
  title = 'Request already ' + req.status.toLowerCase();
  message = 'Nothing else to do.';
} else {
  outcome = 'cancelled';
  for (const m of reqMatches) {
    if (!['notified', 'queued', 'accepted'].includes(m.status)) continue;
    setMatch(m, 'not_needed');
    if (m.status === 'accepted') {
      out.donor_commitments.push({ id: m.donor_id, committed_until: null });
      out.notifications.push({
        user_id: m.donor_id, request_id: req.id, match_id: m.id, type: 'request_cancelled', channel: 'in_app', recipient: 'donor:' + m.donor_id,
        title: 'No need to come in',
        message: req.hospital_name + ' no longer needs this donation. Thank you for being ready to help!',
      });
    }
  }
  // Stood-down donors no longer count; only units already donated remain
  requestUpdate({ status: 'Cancelled', units_confirmed: donatedCount(overrides), closed_reason: 'cancelled_by_hospital' });
  title = 'Request cancelled';
  message = 'All alerted donors have been stood down.';
}

const after = out.request_updates[0] ?? req;
const payload = { outcome, title, message };
// An invalid link reveals nothing about the request it points at
const showRequest = req.id && outcome !== 'invalid_link';
if (showRequest) Object.assign(payload, { request_status: after.status, units_required: req.units_required, units_confirmed: after.units_confirmed ?? 0 });

const accent = tone === 'ok' ? '#16a34a' : '#d97706';
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LifeLink</title>'
  + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff5f5;color:#1f2937}main{max-width:480px;margin:10vh auto;padding:16px}'
  + '.card{background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08);border-top:6px solid ' + accent + '}'
  + 'h1{font-size:1.4rem;margin:0 0 12px}p{line-height:1.5;margin:0 0 12px}.meta{color:#6b7280;font-size:.9rem}.brand{color:#dc2626;font-weight:700;margin-bottom:12px}</style></head>'
  + '<body><main><div class="card"><div class="brand">LifeLink</div><h1>' + esc(title) + '</h1><p>' + esc(message) + '</p>'
  + (showRequest ? '<p class="meta">' + esc(payload.units_confirmed) + ' of ' + esc(req.units_required) + ' units confirmed &middot; ' + esc(after.status) + '</p>' : '')
  + '</div></main></body></html>';

return [{
  json: {
    ...out,
    outcome,
    http_status: httpStatus,
    content_type: p.format === 'json' ? 'application/json' : 'text/html; charset=utf-8',
    response_body: p.format === 'json' ? JSON.stringify(payload) : html,
  },
}];`
    },
    position: [1540, 400]
  },
  output: [{ outcome: 'accepted', http_status: 200, content_type: 'text/html; charset=utf-8', response_body: '<html></html>', match_updates: [{ id: 11, status: 'accepted', responded_at: '2026-09-29T10:05:00.000Z' }], request_updates: [{ id: 1, status: 'Open', units_confirmed: 1, units_donated: 0, first_accept_at: '2026-09-29T10:05:00.000Z', fulfilled_at: null, closed_reason: null }], donor_commitments: [{ id: 3, committed_until: '2026-09-30T10:05:00.000Z' }], donations: [], notifications: [{ user_id: null, request_id: 1, match_id: 11, title: 't', message: 'm', type: 'donor_accepted', channel: 'in_app', recipient: 'hospital:AIIMS Trauma Centre' }], hospital_sms: [{ to: '+915550000900', text: 'LifeLink: ...' }] }]
});

const splitMatchUpdates = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Match Changes', parameters: { fieldToSplitOut: 'match_updates', include: 'noOtherFields', options: {} }, position: [1760, 0] },
  output: [{ id: 11, status: 'accepted', responded_at: '2026-09-29T10:05:00.000Z' }]
});

const updateMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Match Status',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { status: expr('{{ $json.status }}'), responded_at: expr('{{ $json.responded_at }}') },
        matchingColumns: [],
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'responded_at', displayName: 'responded_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1980, 0]
  },
  output: [{ id: 11, status: 'accepted' }]
});

const splitRequestUpdates = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Request Changes', parameters: { fieldToSplitOut: 'request_updates', include: 'noOtherFields', options: {} }, position: [1760, 200] },
  output: [{ id: 1, status: 'Open', units_confirmed: 1, units_donated: 0, first_accept_at: '2026-09-29T10:05:00.000Z', fulfilled_at: null, closed_reason: null }]
});

const updateRequest = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Request Fulfilment',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: expr('{{ $json.status }}'),
          units_confirmed: expr('{{ $json.units_confirmed }}'),
          units_donated: expr('{{ $json.units_donated }}'),
          first_accept_at: expr('{{ $json.first_accept_at }}'),
          fulfilled_at: expr('{{ $json.fulfilled_at }}'),
          closed_reason: expr('{{ $json.closed_reason }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'units_confirmed', displayName: 'units_confirmed', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'units_donated', displayName: 'units_donated', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'first_accept_at', displayName: 'first_accept_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fulfilled_at', displayName: 'fulfilled_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'closed_reason', displayName: 'closed_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1980, 200]
  },
  output: [{ id: 1, status: 'Open' }]
});

const splitCommitments = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Donor Commitment Changes', parameters: { fieldToSplitOut: 'donor_commitments', include: 'noOtherFields', options: {} }, position: [1760, 400] },
  output: [{ id: 3, committed_until: '2026-09-30T10:05:00.000Z' }]
});

const updateCommitment = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Donor Commitment',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { committed_until: expr('{{ $json.committed_until }}') },
        matchingColumns: [],
        schema: [
          { id: 'committed_until', displayName: 'committed_until', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1980, 400]
  },
  output: [{ id: 3, committed_until: '2026-09-30T10:05:00.000Z' }]
});

const splitDonations = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Donations to Log', parameters: { fieldToSplitOut: 'donations', include: 'noOtherFields', options: {} }, position: [1760, 600] },
  output: [{ id: 3, last_donation_date: '2026-09-29', total_donations: 1, xp_points: 190, committed_until: null }]
});

const recordDonation = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Record Donation in History',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          last_donation_date: expr('{{ $json.last_donation_date }}'),
          total_donations: expr('{{ $json.total_donations }}'),
          xp_points: expr('{{ $json.xp_points }}'),
          committed_until: expr('{{ $json.committed_until }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'last_donation_date', displayName: 'last_donation_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'total_donations', displayName: 'total_donations', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'xp_points', displayName: 'xp_points', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'committed_until', displayName: 'committed_until', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1980, 600]
  },
  output: [{ id: 3, total_donations: 1 }]
});

const splitNotifications = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Notifications to Send', parameters: { fieldToSplitOut: 'notifications', include: 'noOtherFields', options: {} }, position: [1760, 800] },
  output: [{ user_id: null, request_id: 1, match_id: 11, title: 'Donor confirmed for AB+ (1/2 units)', message: 'm', type: 'donor_accepted', channel: 'in_app', recipient: 'hospital:AIIMS Trauma Centre' }]
});

const insertNotifications = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Notify Hospital / Donor (In-App)',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'XMjdXMGSnaoeulqE', cachedResultName: 'lifelink_notifications' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          user_id: expr('{{ $json.user_id }}'),
          request_id: expr('{{ $json.request_id }}'),
          match_id: expr('{{ $json.match_id }}'),
          title: expr('{{ $json.title }}'),
          message: expr('{{ $json.message }}'),
          type: expr('{{ $json.type }}'),
          is_read: false,
          channel: expr('{{ $json.channel }}'),
          recipient: expr('{{ $json.recipient }}'),
          confirm_donation_url: expr('{{ $json.type === "donor_accepted" ? "https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m=" + $json.match_id + "&h=" + $("Find Request").first().json.hospital_token + "&a=donated" : null }}'),
          no_show_url: expr('{{ $json.type === "donor_accepted" ? "https://amitsingh7291.app.n8n.cloud/webhook/lifelink/donor-response?m=" + $json.match_id + "&h=" + $("Find Request").first().json.hospital_token + "&a=no_show" : null }}')
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
          { id: 'recipient', displayName: 'recipient', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'confirm_donation_url', displayName: 'confirm_donation_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'no_show_url', displayName: 'no_show_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [1980, 800]
  },
  output: [{ id: 40, type: 'donor_accepted' }]
});

const splitHospitalSms = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Hospital Texts', parameters: { fieldToSplitOut: 'hospital_sms', include: 'noOtherFields', options: {} }, position: [1760, 1000] },
  output: [{ to: '+915550000900', text: 'LifeLink: Donor confirmed' }]
});

const textHospital = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'Text Hospital (Twilio)',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: placeholder('Your Twilio sender number, e.g. +14155550100'),
      to: expr('{{ $json.to }}'),
      toWhatsapp: false,
      message: expr('{{ $json.text }}'),
      options: {}
    },
    credentials: { twilioApi: newCredential('Twilio account') },
    position: [1980, 1000]
  },
  output: [{ sid: 'SM2', status: 'queued' }]
});

const respondToLink = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Show Confirmation Page',
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ $json.response_body }}'),
      options: {
        responseCode: expr('{{ $json.http_status }}'),
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: expr('{{ $json.content_type }}') },
            { name: 'Cache-Control', value: 'no-store' }
          ]
        }
      }
    },
    position: [1760, 1200]
  },
  output: [{ outcome: 'accepted' }]
});

const overview = sticky("## Donor response & fulfilment (spec stages 6-7)\n**Donor one-tap links** (`m` + `t` token): `a=accept` / `a=decline` (declining after accepting withdraws and reopens the request).\n**Hospital links** (`h` = hospital token from the dispatch response): `a=donated` logs the donation in the donor's history, `a=no_show` reopens, `r=<request>&a=cancel` stands everyone down.\n\nAccepting holds the donor for 24h, withdraws their alerts for other requests and notifies the hospital immediately. Link previewers are ignored so a preview can't accept on someone's behalf. Add `&format=json` for API/USSD callers.", [responseWebhook, parseLink], { color: 5, position: [-40, -120], width: 600, height: 300 });

export default workflow('lifelink-donor-response', 'LifeLink – Donor Response & Fulfilment')
  .add(responseWebhook)
  .to(parseLink.to(findMatch.to(findRequest.to(loadRequestMatches.to(findDonor.to(loadDonorMatches.to(decideOutcome)))))))
  .add(decideOutcome)
  .to(splitMatchUpdates.to(updateMatches))
  .add(decideOutcome)
  .to(splitRequestUpdates.to(updateRequest))
  .add(decideOutcome)
  .to(splitCommitments.to(updateCommitment))
  .add(decideOutcome)
  .to(splitDonations.to(recordDonation))
  .add(decideOutcome)
  .to(splitNotifications.to(insertNotifications))
  .add(decideOutcome)
  .to(splitHospitalSms.to(textHospital))
  .add(decideOutcome)
  .to(respondToLink)
  .add(overview)
  .group('Load link context', [parseLink, findMatch, findRequest, loadRequestMatches, findDonor, loadDonorMatches, decideOutcome], { description: 'Validates the link token, loads the match, request, donor and their other alerts, then decides the state change.' })
  .group('Update match & request', [splitMatchUpdates, updateMatches], { description: 'Accepted / declined / donated / no-show / not needed / superseded.' })
  .group('Fulfilment', [splitRequestUpdates, updateRequest], { description: 'Recounts confirmed and donated units; marks Fulfilled, Completed, reopened or Cancelled.' })
  .group('Donor commitment', [splitCommitments, updateCommitment], { description: 'Holds an accepting donor for 24h so they are not alerted for other requests; releases on withdraw/no-show/cancel.' })
  .group('Donation history', [splitDonations, recordDonation], { description: 'Logs the donation: last donation date, total donations and XP (drives the eligibility window).' })
  .group('Hospital & donor alerts', [splitNotifications, insertNotifications], { description: 'In-app alerts: hospital on accept/withdraw, donor on donation or cancellation.' })
  .group('Hospital SMS', [splitHospitalSms, textHospital], { description: 'Texts the hospital contact once a Twilio credential is added (disabled until then).' });

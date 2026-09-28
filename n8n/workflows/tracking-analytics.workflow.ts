import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const trackingWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Tracking Page Opened',
    parameters: { httpMethod: 'GET', path: 'lifelink/request-status', responseMode: 'responseNode', options: {} },
    position: [0, 200]
  },
  output: [{ query: { token: '4e88c541-125a-4c9d-8d4f-897c37f075eb' } }]
});

const parseTracking = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Tracking Query',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const q = $input.first().json.query ?? {};
const token = /^[0-9a-f-]{36}$/i.test(String(q.token ?? '')) ? String(q.token).toLowerCase() : 'invalid';
return [{ json: { token, format: q.format === 'json' ? 'json' : 'html' } }];`
    },
    position: [220, 200]
  },
  output: [{ token: '4e88c541-125a-4c9d-8d4f-897c37f075eb', format: 'html' }]
});

const findByToken = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Request by Token',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status_token', condition: 'eq', keyValue: expr('{{ $json.token }}') }] },
      returnAll: false,
      limit: 1
    },
    position: [440, 200]
  },
  output: [{ id: 1, hospital_name: 'AIIMS Trauma Centre', hospital_city: 'Delhi', patient_ref: 'ICU-7', blood_group: 'AB+', units_required: 2, urgency: 'Emergency', status: 'Open', units_confirmed: 1, units_donated: 0, compatible_donors: 9, donors_notified: 6, escalation_minutes: 10, escalation_rounds: 0, first_accept_at: '2026-09-29T10:05:00.000Z', fulfilled_at: null, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:05:00.000Z' }]
});

const loadTrackingMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Tracking Matches',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'request_id', condition: 'eq', keyValue: expr('{{ $json.id || 0 }}') }] },
      returnAll: true
    },
    position: [660, 200]
  },
  output: [{ id: 1, request_id: 1, donor_blood_group: 'O+', distance_miles: 8.9, status: 'accepted', notified_at: '2026-09-29T10:00:00.000Z', responded_at: '2026-09-29T10:05:00.000Z' }]
});

const buildTracking = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Tracking View',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Progress view for the hospital and the patient's family. It shows counts,
// blood groups and distances only: no donor names, phones or tokens.
const p = $('Parse Tracking Query').first().json;
const req = $('Find Request by Token').first().json;
const matches = $('Load Tracking Matches').all().map((i) => i.json).filter((m) => m.id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '';
const minutesBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

const page = (title, body, refresh) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + (refresh ? '<meta http-equiv="refresh" content="60">' : '') + '<title>' + esc(title) + '</title>'
  + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff5f5;color:#1f2937}main{max-width:560px;margin:0 auto;padding:24px 16px}'
  + '.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08);margin-bottom:16px}.brand{color:#dc2626;font-weight:700}'
  + 'h1{font-size:1.35rem;margin:6px 0 4px}.sub{color:#6b7280;margin:0 0 16px}.bar{height:14px;background:#fee2e2;border-radius:999px;overflow:hidden}.fill{height:100%;background:#dc2626}'
  + '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:16px}.stat{background:#f9fafb;border-radius:12px;padding:12px}.stat b{display:block;font-size:1.4rem}'
  + '.pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:.8rem;font-weight:600;background:#fee2e2;color:#991b1b}ol{padding-left:18px;margin:0}li{margin:6px 0}.muted{color:#6b7280;font-size:.85rem}</style></head>'
  + '<body><main>' + body + '</main></body></html>';

if (!req.id) {
  const payload = { status: 'not_found', message: 'No blood request matches this tracking link.' };
  return [{ json: {
    http_status: 404,
    content_type: p.format === 'json' ? 'application/json' : 'text/html; charset=utf-8',
    response_body: p.format === 'json' ? JSON.stringify(payload) : page('LifeLink tracking', '<div class="card"><div class="brand">LifeLink</div><h1>Tracking link not found</h1><p>Please check the link from the hospital.</p></div>', false),
  } }];
}

const count = (...statuses) => matches.filter((m) => statuses.includes(m.status)).length;
const alerted = matches.filter((m) => m.notified_at);
const confirmed = count('accepted', 'donated');
const donated = count('donated');
const lastAlert = alerted.map((m) => m.notified_at).sort().pop();
const nextCheck = req.status === 'Open' && lastAlert ? new Date(Date.parse(lastAlert) + (req.escalation_minutes ?? 10) * 60000).toISOString() : null;

const NEXT_STEP = {
  Open: 'We are alerting compatible donors near ' + req.hospital_name + ' and alert the next ranked donors every ' + req.escalation_minutes + ' minutes until ' + req.units_required + ' unit(s) are confirmed.',
  Fulfilled: 'Enough donors have confirmed and are on their way to ' + req.hospital_name + '. The hospital confirms each donation on arrival.',
  Completed: 'All ' + req.units_required + ' unit(s) have been donated. Thank you for your patience.',
  Exhausted: 'Every compatible donor in range has been asked. The hospital has been told to contact the regional blood bank; late donor replies are still counted here.',
  Cancelled: 'The hospital cancelled this request.',
};

const timeline = [{ at: req.createdAt, event: 'Request raised by ' + req.hospital_name }];
if (alerted.length) timeline.push({ at: alerted.map((m) => m.notified_at).sort()[0], event: 'First compatible donors alerted' });
if ((req.escalation_rounds ?? 0) > 0 && alerted.length > (req.donors_notified ?? 0) - 1) timeline.push({ at: lastAlert, event: 'More donors alerted (escalation round ' + req.escalation_rounds + ')' });
if (req.first_accept_at) timeline.push({ at: req.first_accept_at, event: 'First donor confirmed (' + minutesBetween(req.createdAt, req.first_accept_at) + ' min after the request)' });
if (req.fulfilled_at) timeline.push({ at: req.fulfilled_at, event: 'All units covered by confirmed donors' });
if (['Completed', 'Exhausted', 'Cancelled'].includes(req.status)) timeline.push({ at: req.updatedAt, event: 'Request ' + req.status.toLowerCase() });
timeline.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

const summary = {
  request_id: req.id,
  status: req.status,
  hospital_name: req.hospital_name,
  hospital_city: req.hospital_city,
  patient_ref: req.patient_ref ?? null,
  blood_group: req.blood_group,
  urgency: req.urgency,
  units_required: req.units_required,
  units_confirmed: confirmed,
  units_donated: donated,
  compatible_donors_found: req.compatible_donors ?? matches.length,
  donors_alerted: alerted.length,
  donors_declined: count('declined'),
  donors_no_response: count('expired'),
  donors_on_standby: count('queued'),
  confirmed_donors: matches.filter((m) => ['accepted', 'donated'].includes(m.status))
    .map((m) => ({ blood_group: m.donor_blood_group, distance_miles: m.distance_miles, state: m.status === 'donated' ? 'donated' : 'on the way' })),
  next_check_at: nextCheck,
  next_step: NEXT_STEP[req.status] ?? '',
  timeline,
};

const pct = Math.min(100, Math.round((confirmed / req.units_required) * 100));
const body = '<div class="card"><div class="brand">LifeLink</div><h1>' + esc(req.blood_group) + ' blood for ' + esc(req.hospital_name) + '</h1>'
  + '<p class="sub">' + esc(req.urgency) + (req.patient_ref ? ' &middot; ' + esc(req.patient_ref) : '') + ' &middot; <span class="pill">' + esc(req.status) + '</span></p>'
  + '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>'
  + '<p class="muted">' + confirmed + ' of ' + esc(req.units_required) + ' unit(s) confirmed &middot; ' + donated + ' donated</p>'
  + '<div class="grid"><div class="stat"><b>' + summary.compatible_donors_found + '</b>compatible donors found</div><div class="stat"><b>' + alerted.length + '</b>alerted so far</div>'
  + '<div class="stat"><b>' + summary.donors_on_standby + '</b>on standby</div><div class="stat"><b>' + summary.donors_no_response + '</b>no reply yet</div></div></div>'
  + '<div class="card"><b>What happens next</b><p>' + esc(summary.next_step) + '</p>' + (nextCheck ? '<p class="muted">Next check: ' + esc(fmt(nextCheck)) + ' IST</p>' : '') + '</div>'
  + (summary.confirmed_donors.length ? '<div class="card"><b>Confirmed donors</b><ol>' + summary.confirmed_donors.map((d) => '<li>' + esc(d.blood_group) + ' donor' + (d.distance_miles != null ? ', ' + esc(d.distance_miles) + ' mi away' : '') + ' &middot; ' + esc(d.state) + '</li>').join('') + '</ol></div>' : '')
  + '<div class="card"><b>Timeline</b><ol>' + timeline.map((t) => '<li>' + esc(t.event) + '<br><span class="muted">' + esc(fmt(t.at)) + ' IST</span></li>').join('') + '</ol>'
  + '<p class="muted">This page refreshes every minute and never shows donor identities.</p></div>';

return [{ json: {
  http_status: 200,
  content_type: p.format === 'json' ? 'application/json' : 'text/html; charset=utf-8',
  response_body: p.format === 'json' ? JSON.stringify(summary) : page('LifeLink: ' + req.blood_group + ' request', body, ['Open', 'Fulfilled'].includes(req.status)),
} }];`
    },
    position: [880, 200]
  },
  output: [{ http_status: 200, content_type: 'text/html; charset=utf-8', response_body: '<html></html>' }]
});

const respondTracking = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Show Tracking Page',
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ $json.response_body }}'),
      options: {
        responseCode: expr('{{ $json.http_status }}'),
        responseHeaders: { entries: [{ name: 'Content-Type', value: expr('{{ $json.content_type }}') }, { name: 'Cache-Control', value: 'no-store' }] }
      }
    },
    position: [1100, 200]
  },
  output: [{ http_status: 200 }]
});

const analyticsWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Analytics Requested',
    parameters: { httpMethod: 'GET', path: 'lifelink/analytics', responseMode: 'responseNode', options: {} },
    position: [0, 600]
  },
  output: [{ query: { format: 'html' } }]
});

const loadAllRequests = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load All Requests',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '9V3yanItFZmzrY2z', cachedResultName: 'lifelink_requests' },
      returnAll: true
    },
    position: [220, 600]
  },
  output: [{ id: 1, status: 'Open', units_required: 2, first_accept_at: '2026-09-29T10:05:00.000Z', createdAt: '2026-09-29T10:00:00.000Z' }]
});

const loadAllMatches = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load All Matches',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'gF5uzzKWNIUnqLoO', cachedResultName: 'lifelink_request_matches' },
      returnAll: true
    },
    position: [440, 600]
  },
  output: [{ id: 1, request_id: 1, status: 'accepted', exact_match: false, channel: 'sms', notified_at: '2026-09-29T10:00:00.000Z', responded_at: '2026-09-29T10:05:00.000Z' }]
});

const loadAllDonors = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Donor Pool',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'ersGoimf2UobyyTc', cachedResultName: 'lifelink_donor_registry' },
      returnAll: true
    },
    position: [660, 600]
  },
  output: [{ id: 1, blood_group: 'O-', gender: 'male', available: true, last_donation_date: '2026-04-10', committed_until: null }]
});

const computeMetrics = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Compute Network Metrics',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Spec stage 8: open vs fulfilled requests, donor pool size and response
// rates, plus the 15-minute first-donor target and compatibility impact.
const DEFERRAL_DAYS = { male: 90, female: 120 };
const DAY = 86400000;
const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const now = Date.now();
const format = ($('Analytics Requested').first().json.query ?? {}).format === 'html' ? 'html' : 'json';

const requests = $('Load All Requests').all().map((i) => i.json).filter((r) => r.id);
const matches = $('Load All Matches').all().map((i) => i.json).filter((m) => m.id);
const donors = $input.all().map((i) => i.json).filter((d) => d.id);

const round1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => (b ? round1((a / b) * 100) : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round1(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};
const minutes = (from, to) => (Date.parse(to) - Date.parse(from)) / 60000;
const committedNow = (d) => d.committed_until && Date.parse(d.committed_until) > now;
const eligibleNow = (d) => d.available === true && !committedNow(d)
  && (!d.last_donation_date || Date.parse(d.last_donation_date + 'T00:00:00Z') + (DEFERRAL_DAYS[d.gender] ?? DEFERRAL_DAYS.female) * DAY <= now);

const byStatus = {};
for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
const covered = (byStatus.Fulfilled ?? 0) + (byStatus.Completed ?? 0);
const firstDonor = requests.filter((r) => r.first_accept_at).map((r) => minutes(r.createdAt, r.first_accept_at));

const alerted = matches.filter((m) => m.notified_at);
const responded = alerted.filter((m) => ['accepted', 'declined', 'donated', 'no_show'].includes(m.status));
const accepted = alerted.filter((m) => ['accepted', 'donated', 'no_show'].includes(m.status));
const byChannel = {};
for (const m of alerted) byChannel[m.channel || 'in_app'] = (byChannel[m.channel || 'in_app'] ?? 0) + 1;

const metrics = {
  generated_at: new Date(now).toISOString(),
  requests: {
    total: requests.length,
    open: byStatus.Open ?? 0,
    fulfilled: byStatus.Fulfilled ?? 0,
    completed: byStatus.Completed ?? 0,
    exhausted: byStatus.Exhausted ?? 0,
    cancelled: byStatus.Cancelled ?? 0,
    covered_pct: pct(covered, requests.length - (byStatus.Cancelled ?? 0)),
    median_minutes_to_first_donor: median(firstDonor),
    first_donor_within_15_min_pct: pct(firstDonor.filter((x) => x <= 15).length, firstDonor.length),
  },
  donor_pool: {
    registered: donors.length,
    available: donors.filter((d) => d.available === true).length,
    eligible_now: donors.filter(eligibleNow).length,
    committed_now: donors.filter(committedNow).length,
    by_blood_group: Object.fromEntries(GROUPS.map((g) => [g, {
      registered: donors.filter((d) => d.blood_group === g).length,
      eligible_now: donors.filter((d) => d.blood_group === g && eligibleNow(d)).length,
    }])),
  },
  responses: {
    alerts_sent: alerted.length,
    responded: responded.length,
    response_rate_pct: pct(responded.length, alerted.length),
    accepted: accepted.length,
    acceptance_rate_pct: pct(accepted.length, alerted.length),
    declined: alerted.filter((m) => m.status === 'declined').length,
    no_response: alerted.filter((m) => m.status === 'expired').length,
    median_response_minutes: median(responded.filter((m) => m.responded_at).map((m) => minutes(m.notified_at, m.responded_at))),
    donations_logged: matches.filter((m) => m.status === 'donated').length,
    no_shows: matches.filter((m) => m.status === 'no_show').length,
    alerts_by_channel: byChannel,
  },
  compatibility: {
    accepted_from_other_compatible_groups: accepted.filter((m) => m.exact_match === false).length,
    share_of_accepted_pct: pct(accepted.filter((m) => m.exact_match === false).length, accepted.length),
  },
};

if (format === 'json') return [{ json: { content_type: 'application/json', response_body: JSON.stringify(metrics) } }];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = (v, unit) => (v === null || v === undefined ? '–' : esc(v) + (unit ?? ''));
const stat = (label, value, unit) => '<div class="stat"><b>' + show(value, unit) + '</b>' + esc(label) + '</div>';
const maxRegistered = Math.max(1, ...GROUPS.map((g) => metrics.donor_pool.by_blood_group[g].registered));
const bars = GROUPS.map((g) => {
  const row = metrics.donor_pool.by_blood_group[g];
  return '<div class="row"><span class="lbl">' + g + '</span><div class="track"><div class="reg" style="width:' + (row.registered / maxRegistered) * 100 + '%"></div>'
    + '<div class="elig" style="width:' + (row.eligible_now / maxRegistered) * 100 + '%"></div></div><span class="num">' + row.eligible_now + ' / ' + row.registered + '</span></div>';
}).join('');
const r = metrics.requests;
const s = metrics.responses;
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="120"><title>LifeLink network analytics</title>'
  + '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}main{max-width:960px;margin:0 auto;padding:24px 16px}'
  + 'h1{margin:0 0 4px}.muted{color:#64748b;font-size:.85rem}.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 20px rgba(15,23,42,.06);margin-top:16px}'
  + '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat{background:#f1f5f9;border-radius:12px;padding:14px}.stat b{display:block;font-size:1.6rem}'
  + '.row{display:flex;align-items:center;gap:10px;margin:8px 0}.lbl{width:36px;font-weight:700}.track{position:relative;flex:1;height:14px;background:#f1f5f9;border-radius:999px;overflow:hidden}'
  + '.reg{position:absolute;inset:0 auto 0 0;background:#fecaca}.elig{position:absolute;inset:0 auto 0 0;background:#dc2626}.num{width:64px;text-align:right;font-variant-numeric:tabular-nums}</style></head>'
  + '<body><main><h1>LifeLink network analytics</h1><p class="muted">Generated ' + esc(metrics.generated_at) + ' &middot; refreshes every 2 minutes</p>'
  + '<div class="card"><b>Requests: open vs fulfilled</b><div class="grid">' + stat('open', r.open) + stat('fulfilled (donors on the way)', r.fulfilled) + stat('completed (donated)', r.completed)
  + stat('exhausted', r.exhausted) + stat('covered', r.covered_pct, '%') + stat('median minutes to first donor', r.median_minutes_to_first_donor) + stat('first donor within 15 min', r.first_donor_within_15_min_pct, '%') + '</div></div>'
  + '<div class="card"><b>Donor pool</b><div class="grid">' + stat('registered', metrics.donor_pool.registered) + stat('available', metrics.donor_pool.available)
  + stat('eligible now', metrics.donor_pool.eligible_now) + stat('committed to a request', metrics.donor_pool.committed_now) + '</div>'
  + '<p class="muted">Eligible now (dark) vs registered (light), by blood group</p>' + bars + '</div>'
  + '<div class="card"><b>Donor responses</b><div class="grid">' + stat('alerts sent', s.alerts_sent) + stat('response rate', s.response_rate_pct, '%') + stat('acceptance rate', s.acceptance_rate_pct, '%')
  + stat('median minutes to reply', s.median_response_minutes) + stat('no reply', s.no_response) + stat('donations logged', s.donations_logged) + '</div>'
  + '<p class="muted">Accepted donors from a compatible but different blood group: ' + show(metrics.compatibility.accepted_from_other_compatible_groups) + ' (' + show(metrics.compatibility.share_of_accepted_pct, '%') + ') &middot; alerts by channel: '
  + esc(Object.entries(s.alerts_by_channel).map(([k, v]) => k + ' ' + v).join(', ') || 'none') + '</p></div></main></body></html>';
return [{ json: { content_type: 'text/html; charset=utf-8', response_body: html } }];`
    },
    position: [880, 600]
  },
  output: [{ content_type: 'application/json', response_body: '{}' }]
});

const respondAnalytics = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Return Analytics',
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ $json.response_body }}'),
      options: {
        responseCode: 200,
        responseHeaders: { entries: [{ name: 'Content-Type', value: expr('{{ $json.content_type }}') }, { name: 'Cache-Control', value: 'no-store' }] }
      }
    },
    position: [1100, 600]
  },
  output: [{ content_type: 'application/json' }]
});

const note = sticky("## Tracking & analytics (patient side + spec stage 8)\n**GET /webhook/lifelink/request-status?token=…** – the tracking link returned when a request is raised. Safe to share with the patient's family: progress, counts and timeline only, never donor identities. Add `&format=json` for the hospital dashboard.\n\n**GET /webhook/lifelink/analytics** – open vs fulfilled requests, donor pool, response rates, time to first donor. JSON by default (for the website's Analytics page), `?format=html` for a dashboard.", [trackingWebhook, parseTracking], { color: 5, position: [-40, -140], width: 620, height: 300 });

export default workflow('lifelink-tracking-analytics', 'LifeLink – Request Tracking & Analytics')
  .add(trackingWebhook)
  .to(parseTracking.to(findByToken.to(loadTrackingMatches.to(buildTracking.to(respondTracking)))))
  .add(analyticsWebhook)
  .to(loadAllRequests.to(loadAllMatches.to(loadAllDonors.to(computeMetrics.to(respondAnalytics)))))
  .add(note)
  .group('Request tracking', [parseTracking, findByToken, loadTrackingMatches, buildTracking, respondTracking], { description: 'Looks up the request by its tracking token and renders progress without donor identities.' })
  .group('Network analytics', [loadAllRequests, loadAllMatches, loadAllDonors, computeMetrics, respondAnalytics], { description: 'Open vs fulfilled, donor pool, response rates and time-to-first-donor, as JSON or a dashboard.' });
